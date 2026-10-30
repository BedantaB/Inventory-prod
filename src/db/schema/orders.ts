import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { archivedAt, createdBy, paise, quantity, shopRef, timestamps } from "./columns";
import { items } from "./items";
import { profiles } from "./profiles";
import { vendors } from "./vendors";

export const orderStatus = pgEnum("order_status", ["DRAFT", "COMPLETED", "CANCELLED"]);
export const discountKind = pgEnum("discount_kind", ["AMOUNT", "PERCENT"]);

/**
 * A DRAFT order is the cart (survives refresh). Checkout turns it into COMPLETED,
 * assigns order_number and fixes the totals. Completed orders cannot be changed
 * (trigger protect_completed_orders), except that the owner may CANCEL one: the stock comes
 * back (RETURN movements) and the order keeps its number. Cancelled orders are final.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    status: orderStatus().notNull().default("DRAFT"),
    // ORD-2026-27-00001 (numbered per shop); null while DRAFT.
    orderNumber: text(),
    // The customer must belong to the same shop (composite foreign key below).
    vendorId: uuid(),
    // AMOUNT: discountValue is paise. PERCENT: discountValue is basis points (10% = 1000).
    discountKind: discountKind().notNull().default("AMOUNT"),
    discountValue: paise().notNull().default(0),
    // Set by the server at checkout.
    subtotalPaise: paise(),
    discountPaise: paise(),
    totalPaise: paise(),
    completedAt: timestamp({ withTimezone: true }),
    completedBy: uuid().references(() => profiles.id),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledBy: uuid().references(() => profiles.id),
    cancelReason: text(),
    ...archivedAt(),
    ...timestamps(),
    ...createdBy(),
  },
  (t) => [
    unique("orders_order_number_key").on(t.shopId, t.orderNumber),
    unique("orders_shop_id_key").on(t.shopId, t.id),
    foreignKey({
      name: "orders_vendor_fk",
      columns: [t.shopId, t.vendorId],
      foreignColumns: [vendors.shopId, vendors.id],
    }),
    index("orders_shop_status_completed_idx").on(t.shopId, t.status, t.completedAt.desc()),
    index("orders_status_completed_at_idx").on(t.status, t.completedAt.desc()),
    index("orders_vendor_idx").on(t.vendorId),
    index("orders_order_number_trgm_idx").using("gin", t.orderNumber.op("gin_trgm_ops")),
    check("orders_discount_value_nonneg", sql`${t.discountValue} >= 0`),
    check(
      "orders_discount_percent_max",
      sql`${t.discountKind} <> 'PERCENT' OR ${t.discountValue} <= 10000`,
    ),
    check(
      "orders_completed_fields",
      sql`${t.status} = 'DRAFT' OR (
        ${t.orderNumber} IS NOT NULL AND ${t.vendorId} IS NOT NULL
        AND ${t.completedAt} IS NOT NULL AND ${t.completedBy} IS NOT NULL
        AND ${t.subtotalPaise} IS NOT NULL AND ${t.discountPaise} IS NOT NULL
        AND ${t.totalPaise} IS NOT NULL
      )`,
    ),
    check(
      "orders_cancelled_fields",
      sql`(${t.status}::text = 'CANCELLED') = (
        ${t.cancelledAt} IS NOT NULL AND ${t.cancelledBy} IS NOT NULL
        AND nullif(btrim(${t.cancelReason}), '') IS NOT NULL
      )`,
    ),
    check(
      "orders_totals_consistent",
      sql`${t.totalPaise} IS NULL OR (
        ${t.discountPaise} >= 0 AND ${t.discountPaise} <= ${t.subtotalPaise}
        AND ${t.totalPaise} = ${t.subtotalPaise} - ${t.discountPaise}
      )`,
    ),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    // Order and item must belong to the same shop (composite foreign keys below).
    orderId: uuid().notNull(),
    itemId: uuid().notNull(),
    quantity: quantity().notNull(),
    // Selling price for this line. May be empty in a draft; required at checkout.
    unitPricePaise: paise(),
    // Average cost at the moment of sale (for profit reports). Set at checkout.
    unitCostPaise: paise(),
    lineTotalPaise: paise(),
    position: integer().notNull().default(0),
    ...timestamps(),
    ...createdBy(),
  },
  (t) => [
    unique("order_lines_order_item_key").on(t.orderId, t.itemId),
    foreignKey({
      name: "order_lines_order_fk",
      columns: [t.shopId, t.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "order_lines_item_fk",
      columns: [t.shopId, t.itemId],
      foreignColumns: [items.shopId, items.id],
    }),
    index("order_lines_item_idx").on(t.itemId),
    check("order_lines_quantity_positive", sql`${t.quantity} > 0`),
    check("order_lines_unit_price_nonneg", sql`${t.unitPricePaise} >= 0`),
  ],
);

/** Gapless order numbers per shop and Indian financial year ("2026-27"). */
export const orderCounters = pgTable(
  "order_counters",
  {
    ...shopRef(),
    financialYear: text().notNull(),
    lastValue: integer().notNull().default(0),
  },
  (t) => [primaryKey({ name: "order_counters_pkey", columns: [t.shopId, t.financialYear] })],
);
