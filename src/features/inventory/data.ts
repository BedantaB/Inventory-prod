import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { items, orders, profiles, stockEntries, stockMovements, units } from "@/db/schema";
import type { Database } from "@/db/types";
import { PAGE_SIZE } from "@/lib/list-params";
import { qtyFromDb, qtyToDb, QTY_SCALE } from "@/lib/qty";

// Stock-in ("Add Stock") and stock history. Takes `db` so it can be tested with PGlite.

export type StockLine = { itemId: string; qtyMilli: number; unitCostPaise: number };

export type LineProblem = {
  line: number;
  field: "itemId" | "quantity";
  key: "stock.itemArchived" | "items.decimalNotAllowed";
};

export class StockEntryProblem extends Error {
  constructor(public problems: LineProblem[]) {
    super("Stock entry has problems");
  }
}

/**
 * Saves one "Add Stock" bill: an entry plus one IN movement per line, in ONE transaction.
 * The database trigger raises each item's stock and recalculates its average cost.
 */
export async function createStockEntry(
  db: Database,
  input: { reference: string | null; note: string | null; lines: StockLine[] },
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const ids = [...new Set(input.lines.map((l) => l.itemId))];
    const found = await tx
      .select({ id: items.id, archivedAt: items.archivedAt, allowsDecimal: units.allowsDecimal })
      .from(items)
      .innerJoin(units, eq(items.unitId, units.id))
      .where(inArray(items.id, ids));
    const byId = new Map(found.map((i) => [i.id, i]));

    const problems: LineProblem[] = [];
    input.lines.forEach((line, index) => {
      const item = byId.get(line.itemId);
      if (!item || item.archivedAt)
        problems.push({ line: index, field: "itemId", key: "stock.itemArchived" });
      else if (!item.allowsDecimal && line.qtyMilli % QTY_SCALE !== 0) {
        problems.push({ line: index, field: "quantity", key: "items.decimalNotAllowed" });
      }
    });
    if (problems.length > 0) throw new StockEntryProblem(problems);

    const [entry] = await tx
      .insert(stockEntries)
      .values({ reference: input.reference, note: input.note, createdBy: actorId })
      .returning({ id: stockEntries.id });

    for (const line of input.lines) {
      await tx.insert(stockMovements).values({
        type: "IN",
        itemId: line.itemId,
        quantityChange: qtyToDb(line.qtyMilli),
        unitCostPaise: line.unitCostPaise,
        stockEntryId: entry.id,
        createdBy: actorId,
      });
    }
    return entry;
  });
}

export async function getStockEntry(db: Database, id: string) {
  const [entry] = await db
    .select({
      id: stockEntries.id,
      reference: stockEntries.reference,
      note: stockEntries.note,
      createdAt: stockEntries.createdAt,
      createdByName: profiles.fullName,
    })
    .from(stockEntries)
    .innerJoin(profiles, eq(stockEntries.createdBy, profiles.id))
    .where(eq(stockEntries.id, id));
  if (!entry) return null;

  const lines = await db
    .select({
      movementId: stockMovements.id,
      itemId: items.id,
      name: items.name,
      variant: items.variant,
      packSize: items.packSize,
      unitName: units.name,
      quantity: stockMovements.quantityChange,
      unitCostPaise: stockMovements.unitCostPaise,
      stockAfter: stockMovements.stockAfter,
    })
    .from(stockMovements)
    .innerJoin(items, eq(stockMovements.itemId, items.id))
    .innerJoin(units, eq(items.unitId, units.id))
    .where(eq(stockMovements.stockEntryId, id))
    .orderBy(stockMovements.seq);

  return {
    ...entry,
    lines: lines.map(({ quantity, stockAfter, unitCostPaise, ...line }) => ({
      ...line,
      qtyMilli: qtyFromDb(quantity),
      stockAfterMilli: qtyFromDb(stockAfter),
      unitCostPaise: unitCostPaise ?? 0,
    })),
  };
}

/** Everything that changed one item's stock, newest first. */
export async function listItemMovements(db: Database, itemId: string, page = 1) {
  const where = eq(stockMovements.itemId, itemId);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantityChange,
        stockAfter: stockMovements.stockAfter,
        unitCostPaise: stockMovements.unitCostPaise,
        unitPricePaise: stockMovements.unitPricePaise,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
        createdByName: profiles.fullName,
        stockEntryId: stockMovements.stockEntryId,
        entryReference: stockEntries.reference,
        orderId: stockMovements.orderId,
        orderNumber: orders.orderNumber,
      })
      .from(stockMovements)
      .innerJoin(profiles, eq(stockMovements.createdBy, profiles.id))
      .leftJoin(stockEntries, eq(stockMovements.stockEntryId, stockEntries.id))
      .leftJoin(orders, eq(stockMovements.orderId, orders.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.seq))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(stockMovements)
      .where(where),
  ]);
  return {
    rows: rows.map(({ quantity, stockAfter, ...row }) => ({
      ...row,
      qtyMilli: qtyFromDb(quantity),
      stockAfterMilli: qtyFromDb(stockAfter),
    })),
    total,
    page,
  };
}

/** Cost of the most recent stock-in for each item (pre-fills the cost box for the owner). */
export async function lastCosts(db: Database, itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([stockMovements.itemId], {
      itemId: stockMovements.itemId,
      unitCostPaise: stockMovements.unitCostPaise,
    })
    .from(stockMovements)
    .where(and(inArray(stockMovements.itemId, itemIds), eq(stockMovements.type, "IN")))
    .orderBy(stockMovements.itemId, desc(stockMovements.createdAt));
  return new Map(rows.map((r) => [r.itemId, r.unitCostPaise ?? 0]));
}
