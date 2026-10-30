import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdBy, paise, quantity, shopRef, timestamps } from "./columns";
import { items } from "./items";
import { orders } from "./orders";

export const movementType = pgEnum("movement_type", ["IN", "OUT", "ADJUST", "RETURN"]);

/** Why the owner corrected the stock (ADJUST movements). OTHER needs a note. */
export const adjustReason = pgEnum("adjust_reason", ["COUNT", "DAMAGED", "LOST", "OTHER"]);

/** One "Add Stock" save (a supplier bill). Its lines are IN movements. */
export const stockEntries = pgTable(
  "stock_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    reference: text(),
    note: text(),
    ...timestamps(),
    ...createdBy(),
  },
  (t) => [
    unique("stock_entries_shop_id_key").on(t.shopId, t.id),
    index("stock_entries_shop_idx").on(t.shopId),
  ],
);

/**
 * The stock ledger. Inserting a row is the ONLY way items.current_stock changes:
 * trigger apply_stock_movement updates the item (stock + average cost) in the same
 * transaction, and fills stock_after. Rows can never be updated or deleted.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Running number in the order rows were written. Lines saved in one transaction share
    // the same created_at, so this keeps them in the order they were entered.
    seq: bigint({ mode: "number" }).generatedAlwaysAsIdentity(),
    ...shopRef(),
    type: movementType().notNull(),
    // Item, bill and order must belong to the same shop (composite foreign keys below).
    itemId: uuid().notNull(),
    // Signed: IN and RETURN > 0, OUT < 0, ADJUST either way.
    quantityChange: quantity().notNull(),
    // IN: cost entered by the user. RETURN: the cost recorded when it was sold.
    // OUT and ADJUST: the item's average cost at that moment (set by trigger).
    unitCostPaise: paise(),
    // OUT and RETURN: selling price.
    unitPricePaise: paise(),
    // Stock level right after this movement (set by trigger).
    stockAfter: quantity().notNull().default("0"),
    stockEntryId: uuid(),
    // OUT: the sale. RETURN: the cancelled order the stock came back from.
    orderId: uuid(),
    // ADJUST only.
    reason: adjustReason(),
    note: text(),
    // No updated_at / archived_at: ledger rows are immutable.
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...createdBy(),
  },
  (t) => [
    foreignKey({
      name: "stock_movements_item_fk",
      columns: [t.shopId, t.itemId],
      foreignColumns: [items.shopId, items.id],
    }),
    foreignKey({
      name: "stock_movements_stock_entry_fk",
      columns: [t.shopId, t.stockEntryId],
      foreignColumns: [stockEntries.shopId, stockEntries.id],
    }),
    foreignKey({
      name: "stock_movements_order_fk",
      columns: [t.shopId, t.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    index("stock_movements_shop_created_idx").on(t.shopId, t.createdAt.desc()),
    index("stock_movements_item_created_idx").on(t.itemId, t.createdAt.desc()),
    index("stock_movements_created_idx").on(t.createdAt.desc()),
    index("stock_movements_stock_entry_idx").on(t.stockEntryId),
    index("stock_movements_order_idx").on(t.orderId),
    // Compared as text: enum values added in a migration can't be used in the same transaction.
    check(
      "stock_movements_shape",
      sql`(
        ${t.type}::text = 'IN' AND ${t.quantityChange} > 0 AND ${t.unitCostPaise} >= 0
          AND ${t.stockEntryId} IS NOT NULL AND ${t.orderId} IS NULL
      ) OR (
        ${t.type}::text = 'OUT' AND ${t.quantityChange} < 0 AND ${t.unitPricePaise} >= 0
          AND ${t.orderId} IS NOT NULL AND ${t.stockEntryId} IS NULL
      ) OR (
        ${t.type}::text = 'ADJUST' AND ${t.quantityChange} <> 0
          AND ${t.orderId} IS NULL AND ${t.stockEntryId} IS NULL
      ) OR (
        ${t.type}::text = 'RETURN' AND ${t.quantityChange} > 0 AND ${t.unitCostPaise} >= 0
          AND ${t.orderId} IS NOT NULL AND ${t.stockEntryId} IS NULL
      )`,
    ),
    check(
      "stock_movements_reason",
      sql`(${t.type}::text = 'ADJUST') = (${t.reason} IS NOT NULL)
        AND (${t.reason}::text <> 'OTHER' OR nullif(btrim(${t.note}), '') IS NOT NULL)`,
    ),
  ],
);
