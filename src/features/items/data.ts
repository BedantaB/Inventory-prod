import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { brands, categories, items, stockEntries, stockMovements, units } from "@/db/schema";
import type { Database } from "@/db/types";
import { PAGE_SIZE, searchPatterns } from "@/lib/list-params";
import { qtyFromDb, qtyToDb } from "@/lib/qty";
import { itemKey, type ImportRow } from "./import";

// Database access for items, categories, brands and units. Takes `db` so it can be tested with PGlite;
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

const byName = [
  asc(sql`lower(${items.name})`),
  asc(sql`lower(coalesce(${items.packSize}, ''))`),
  asc(sql`lower(coalesce(${items.variant}, ''))`),
];

const sortOrder: Record<ItemSort, SQL[]> = {
  name: byName,
  "stock-asc": [asc(items.currentStock), ...byName],
  "stock-desc": [desc(items.currentStock), ...byName],
  recent: [desc(items.createdAt)],
};

const itemColumns = {
  id: items.id,
  name: items.name,
  variant: items.variant,
  sku: items.sku,
  packSize: items.packSize,
  categoryId: items.categoryId,
  categoryName: categories.name,
  brandId: items.brandId,
  brandName: brands.name,
  unitId: items.unitId,
  unitName: units.name,
  unitAllowsDecimal: units.allowsDecimal,
  currentStock: items.currentStock,
  lowStockThreshold: items.lowStockThreshold,
  mrpPaise: items.mrpPaise,
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
    .leftJoin(brands, eq(items.brandId, brands.id))
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

/** "Permanent Marker – Blue": the name people see everywhere. */
export function itemDisplayName(item: { name: string; variant: string | null }): string {
  return item.variant ? `${item.name} – ${item.variant}` : item.name;
}

export type ItemListParams = {
  q?: string;
  categoryId?: string;
  brandId?: string;
  stock?: StockFilter;
  sort?: ItemSort;
  page?: number;
  archived?: boolean;
  /** Rows per page (default PAGE_SIZE). */
  limit?: number;
};

export async function listItems(db: Database, params: ItemListParams) {
  const page = params.page ?? 1;
  const limit = params.limit ?? PAGE_SIZE;
  const conditions: (SQL | undefined)[] = [
    params.archived ? isNotNull(items.archivedAt) : isNull(items.archivedAt),
  ];
  // Every word must appear in the name, SKU, colour, pack size or brand ("marker blue", "glue 45").
  for (const pattern of searchPatterns(params.q)) {
    conditions.push(
      or(
        ilike(items.name, pattern),
        ilike(items.sku, pattern),
        ilike(items.variant, pattern),
        ilike(items.packSize, pattern),
        ilike(brands.name, pattern),
      ),
    );
  }
  if (params.categoryId) conditions.push(eq(items.categoryId, params.categoryId));
  if (params.brandId) conditions.push(eq(items.brandId, params.brandId));
  if (params.stock && params.stock !== "all") conditions.push(stockCondition[params.stock]);

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    selectItems(db)
      .where(where)
      .orderBy(...sortOrder[params.sort ?? "name"])
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(items)
      .leftJoin(brands, eq(items.brandId, brands.id))
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
  variant: string | null;
  sku: string;
  categoryId: string | null;
  brandId: string | null;
  unitId: string;
  packSize: string | null;
  mrpPaise: number | null;
  sellingPricePaise: number | null;
  lowStockMilli: number;
  photoPath: string | null;
};

export async function createItem(db: Database, input: ItemWrite, actorId: string) {
  const [item] = await db
    .insert(items)
    .values({
      name: input.name,
      variant: input.variant,
      sku: input.sku,
      categoryId: input.categoryId,
      brandId: input.brandId,
      unitId: input.unitId,
      packSize: input.packSize,
      mrpPaise: input.mrpPaise,
      sellingPricePaise: input.sellingPricePaise,
      lowStockThreshold: qtyToDb(input.lowStockMilli),
      photoPath: input.photoPath,
      createdBy: actorId,
    })
    .returning({ id: items.id, name: items.name, sku: items.sku });
  return item;
}

/** Prices left `undefined` stay unchanged (staff edits). */
export async function updateItem(
  db: Database,
  id: string,
  input: Omit<ItemWrite, "sellingPricePaise" | "mrpPaise" | "photoPath"> & {
    sellingPricePaise?: number | null;
    mrpPaise?: number | null;
    photoPath?: string | null;
  },
) {
  const [item] = await db
    .update(items)
    .set({
      name: input.name,
      variant: input.variant,
      sku: input.sku,
      categoryId: input.categoryId,
      brandId: input.brandId,
      unitId: input.unitId,
      packSize: input.packSize,
      lowStockThreshold: qtyToDb(input.lowStockMilli),
      ...(input.sellingPricePaise !== undefined && { sellingPricePaise: input.sellingPricePaise }),
      ...(input.mrpPaise !== undefined && { mrpPaise: input.mrpPaise }),
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

// ---- Categories and brands (simple named lists) ----

type LookupTable = typeof categories | typeof brands;

function listLookup(db: Database, table: LookupTable) {
  return db
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(isNull(table.archivedAt))
    .orderBy(asc(sql`lower(${table.name})`));
}

/** Creates an entry, or returns the existing one with the same name (any capitalisation). */
async function findOrCreateLookup(db: Database, table: LookupTable, name: string, actorId: string) {
  const [created] = await db
    .insert(table)
    .values({ name, createdBy: actorId })
    .onConflictDoNothing()
    .returning({ id: table.id, name: table.name });
  if (created) return { ...created, existed: false };
  const [existing] = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(sql`lower(${table.name}) = lower(${name})`);
  // An archived entry with this name comes back into use.
  await db.update(table).set({ archivedAt: null }).where(eq(table.id, existing.id));
  return { ...existing, existed: true };
}

export const listCategories = (db: Database) => listLookup(db, categories);
export const listBrands = (db: Database) => listLookup(db, brands);
export const findOrCreateCategory = (db: Database, name: string, actorId: string) =>
  findOrCreateLookup(db, categories, name, actorId);
export const findOrCreateBrand = (db: Database, name: string, actorId: string) =>
  findOrCreateLookup(db, brands, name, actorId);

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

// ---- Import ----

/** What checkImport() needs to know about items already in the app. */
export async function importContext(db: Database) {
  const [unitRows, existing] = await Promise.all([
    db
      .select({
        id: units.id,
        name: units.name,
        label: units.label,
        allowsDecimal: units.allowsDecimal,
      })
      .from(units)
      .where(isNull(units.archivedAt))
      .orderBy(asc(units.name)),
    db
      .select({
        sku: items.sku,
        name: items.name,
        variant: items.variant,
        packSize: items.packSize,
      })
      .from(items),
  ]);
  return {
    units: unitRows,
    existingSkus: new Set(existing.map((i) => i.sku)),
    existingKeys: new Set(existing.map((i) => itemKey(i.name, i.variant, i.packSize))),
  };
}

/**
 * Adds all rows in ONE transaction: either every item is added or none is. Brands and
 * categories are created as needed. Rows with opening stock get one shared stock entry.
 */
export async function importItems(
  db: Database,
  rows: ImportRow[],
  actorId: string,
  openingStockNote: string,
) {
  return db.transaction(async (tx) => {
    const brandIds = new Map<string, string>();
    const categoryIds = new Map<string, string>();
    const newNames = { brands: 0, categories: 0 };
    const lookup = async (
      name: string | null,
      cache: Map<string, string>,
      create: typeof findOrCreateBrand,
      kind: "brands" | "categories",
    ) => {
      if (!name) return null;
      const key = name.toLowerCase();
      if (!cache.has(key)) {
        const found = await create(tx, name, actorId);
        if (!found.existed) newNames[kind]++;
        cache.set(key, found.id);
      }
      return cache.get(key)!;
    };

    const created: { id: string; row: ImportRow }[] = [];
    for (const row of rows) {
      const item = await createItem(
        tx,
        {
          name: row.name,
          variant: row.variant,
          sku: row.sku,
          categoryId: await lookup(row.category, categoryIds, findOrCreateCategory, "categories"),
          brandId: await lookup(row.brand, brandIds, findOrCreateBrand, "brands"),
          unitId: row.unitId,
          packSize: row.packSize,
          mrpPaise: row.mrpPaise,
          sellingPricePaise: row.sellingPricePaise,
          lowStockMilli: row.lowStockMilli,
          photoPath: null,
        },
        actorId,
      );
      created.push({ id: item.id, row });
    }

    const withStock = created.filter((c) => c.row.openingStockMilli > 0);
    if (withStock.length > 0) {
      const [entry] = await tx
        .insert(stockEntries)
        .values({ reference: "IMPORT", note: openingStockNote, createdBy: actorId })
        .returning({ id: stockEntries.id });
      for (const { id, row } of withStock) {
        await tx.insert(stockMovements).values({
          type: "IN",
          itemId: id,
          quantityChange: qtyToDb(row.openingStockMilli),
          unitCostPaise: row.costPaise ?? 0,
          stockEntryId: entry.id,
          createdBy: actorId,
        });
      }
    }

    return { items: created.length, withStock: withStock.length, ...newNames };
  });
}
