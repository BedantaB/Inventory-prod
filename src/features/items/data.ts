import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { categories, items, units } from "@/db/schema";
import type { Database } from "@/db/types";
import { PAGE_SIZE, searchPatterns } from "@/lib/list-params";
import { qtyFromDb, qtyToDb } from "@/lib/qty";

// Database access for items, categories and units. Takes `db` so it can be tested with PGlite;
// server code calls these through ./queries.ts and ./actions.ts.

export const STOCK_FILTERS = ["all", "in", "low", "out"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];
export const ITEM_SORTS = ["name", "stock-asc", "stock-desc", "recent"] as const;
export type ItemSort = (typeof ITEM_SORTS)[number];

export type StockStatus = "in" | "low" | "out";

/** Out: nothing left. Low: at or below the warning level. In: everything else. */
export function stockStatus(stockMilli: number, thresholdMilli: number): StockStatus {
  if (stockMilli <= 0) return "out";
  if (stockMilli <= thresholdMilli) return "low";
  return "in";
}

const stockCondition: Record<Exclude<StockFilter, "all">, SQL> = {
  out: sql`${items.currentStock} <= 0`,
  low: sql`${items.currentStock} > 0 AND ${items.currentStock} <= ${items.lowStockThreshold}`,
  in: sql`${items.currentStock} > 0 AND ${items.currentStock} > ${items.lowStockThreshold}`,
};

const sortOrder: Record<ItemSort, SQL[]> = {
  name: [asc(sql`lower(${items.name})`)],
  "stock-asc": [asc(items.currentStock), asc(sql`lower(${items.name})`)],
  "stock-desc": [desc(items.currentStock), asc(sql`lower(${items.name})`)],
  recent: [desc(items.createdAt)],
};

const itemColumns = {
  id: items.id,
  name: items.name,
  sku: items.sku,
  packSize: items.packSize,
  categoryId: items.categoryId,
  categoryName: categories.name,
  unitId: items.unitId,
  unitName: units.name,
  unitAllowsDecimal: units.allowsDecimal,
  currentStock: items.currentStock,
  lowStockThreshold: items.lowStockThreshold,
  sellingPricePaise: items.sellingPricePaise,
  avgCostPaise: items.avgCostPaise,
  photoPath: items.photoPath,
  archivedAt: items.archivedAt,
  createdAt: items.createdAt,
};

function selectItems(db: Database) {
  return db
    .select(itemColumns)
    .from(items)
    .innerJoin(units, eq(items.unitId, units.id))
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .$dynamic();
}

type ItemRowRaw = Awaited<ReturnType<typeof selectItems>>[number];

export type ItemView = Omit<ItemRowRaw, "currentStock" | "lowStockThreshold"> & {
  /** milli-units */
  stockMilli: number;
  /** milli-units */
  lowStockMilli: number;
  status: StockStatus;
};

function toView(row: ItemRowRaw): ItemView {
  const { currentStock, lowStockThreshold, ...rest } = row;
  const stockMilli = qtyFromDb(currentStock);
  const lowStockMilli = qtyFromDb(lowStockThreshold);
  return { ...rest, stockMilli, lowStockMilli, status: stockStatus(stockMilli, lowStockMilli) };
}

export type ItemListParams = {
  q?: string;
  categoryId?: string;
  stock?: StockFilter;
  sort?: ItemSort;
  page?: number;
  archived?: boolean;
};

export async function listItems(db: Database, params: ItemListParams) {
  const page = params.page ?? 1;
  const conditions: (SQL | undefined)[] = [
    params.archived ? isNotNull(items.archivedAt) : isNull(items.archivedAt),
  ];
  for (const pattern of searchPatterns(params.q)) {
    conditions.push(or(ilike(items.name, pattern), ilike(items.sku, pattern)));
  }
  if (params.categoryId) conditions.push(eq(items.categoryId, params.categoryId));
  if (params.stock && params.stock !== "all") conditions.push(stockCondition[params.stock]);

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    selectItems(db)
      .where(where)
      .orderBy(...sortOrder[params.sort ?? "name"])
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(items)
      .where(where),
  ]);

  return { rows: rows.map(toView), total, page };
}

export async function getItem(db: Database, id: string): Promise<ItemView | null> {
  const [row] = await selectItems(db).where(eq(items.id, id));
  return row ? toView(row) : null;
}

export type ItemWrite = {
  name: string;
  sku: string;
  categoryId: string | null;
  unitId: string;
  packSize: string | null;
  sellingPricePaise: number | null;
  lowStockMilli: number;
  photoPath: string | null;
};

export async function createItem(db: Database, input: ItemWrite, actorId: string) {
  const [item] = await db
    .insert(items)
    .values({
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      unitId: input.unitId,
      packSize: input.packSize,
      sellingPricePaise: input.sellingPricePaise,
      lowStockThreshold: qtyToDb(input.lowStockMilli),
      photoPath: input.photoPath,
      createdBy: actorId,
    })
    .returning({ id: items.id, name: items.name, sku: items.sku });
  return item;
}

/** `sellingPricePaise: undefined` leaves the price unchanged (used for staff edits). */
export async function updateItem(
  db: Database,
  id: string,
  input: Omit<ItemWrite, "sellingPricePaise" | "photoPath"> & {
    sellingPricePaise?: number | null;
    photoPath?: string | null;
  },
) {
  const [item] = await db
    .update(items)
    .set({
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      unitId: input.unitId,
      packSize: input.packSize,
      lowStockThreshold: qtyToDb(input.lowStockMilli),
      ...(input.sellingPricePaise !== undefined && { sellingPricePaise: input.sellingPricePaise }),
      ...(input.photoPath !== undefined && { photoPath: input.photoPath }),
    })
    .where(eq(items.id, id))
    .returning({ id: items.id, name: items.name, sku: items.sku });
  return item ?? null;
}

export async function setItemArchived(db: Database, id: string, archived: boolean) {
  const [item] = await db
    .update(items)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(items.id, id))
    .returning({ id: items.id, name: items.name });
  return item ?? null;
}

// ---- Categories ----

export async function listCategories(db: Database) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(isNull(categories.archivedAt))
    .orderBy(asc(sql`lower(${categories.name})`));
}

/** Creates a category, or returns the existing one with the same name (any capitalisation). */
export async function findOrCreateCategory(db: Database, name: string, actorId: string) {
  const [created] = await db
    .insert(categories)
    .values({ name, createdBy: actorId })
    .onConflictDoNothing()
    .returning({ id: categories.id, name: categories.name });
  if (created) return { ...created, existed: false };
  const [existing] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name})`);
  if (existing) {
    // An archived category with this name comes back into use.
    await db.update(categories).set({ archivedAt: null }).where(eq(categories.id, existing.id));
  }
  return { ...existing, existed: true };
}

// ---- Units ----

export async function listUnits(db: Database) {
  return db
    .select({
      id: units.id,
      name: units.name,
      label: units.label,
      allowsDecimal: units.allowsDecimal,
      // Written out in full: Drizzle drops table names in single-table queries.
      itemCount: sql<number>`(SELECT count(*) FROM items WHERE items.unit_id = units.id)`.mapWith(
        Number,
      ),
    })
    .from(units)
    .where(isNull(units.archivedAt))
    .orderBy(asc(units.name));
}

export async function getUnit(db: Database, id: string) {
  const [unit] = await db.select().from(units).where(eq(units.id, id));
  return unit ?? null;
}

export async function createUnit(
  db: Database,
  input: { name: string; label: string; allowsDecimal: boolean },
  actorId: string,
) {
  const [unit] = await db
    .insert(units)
    .values({ ...input, createdBy: actorId })
    .returning({ id: units.id, name: units.name });
  return unit;
}

export type UnitUpdateResult = "ok" | "not-found" | "decimal-locked";

/** Decimals can only be switched while no item uses the unit (stock may already have decimals). */
export async function updateUnit(
  db: Database,
  id: string,
  input: { name: string; label: string; allowsDecimal: boolean },
): Promise<UnitUpdateResult> {
  return db.transaction(async (tx) => {
    const [unit] = await tx.select().from(units).where(eq(units.id, id)).for("update");
    if (!unit) return "not-found";
    if (unit.allowsDecimal !== input.allowsDecimal) {
      const [used] = await tx
        .select({ id: items.id })
        .from(items)
        .where(eq(items.unitId, id))
        .limit(1);
      if (used) return "decimal-locked";
    }
    await tx.update(units).set(input).where(eq(units.id, id));
    return "ok";
  });
}
