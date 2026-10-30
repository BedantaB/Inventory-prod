import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdBy, paise, shopRef, timestamps } from "./columns";
import { orders } from "./orders";
import { profiles } from "./profiles";
import { vendors } from "./vendors";

export const paymentMethod = pgEnum("payment_method", ["CASH", "UPI", "BANK", "CHEQUE"]);

/**
 * Money received from a customer. Outstanding = completed orders − payments not voided.
 * Payments are never changed or deleted (trigger protect_payments): a wrong one is VOIDED by
 * the owner, with who, when and why, and stays on record.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    ...shopRef(),
    // Customer (and order, if paid at checkout) must belong to the same shop.
    vendorId: uuid().notNull(),
    // Set when it was paid at checkout ("Paid now"); that order's customer.
    orderId: uuid(),
    amountPaise: paise().notNull(),
    method: paymentMethod().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // UPI reference, cheque number, bank transfer id…
    reference: text(),
    note: text(),
    voidedAt: timestamp({ withTimezone: true }),
    voidedBy: uuid().references(() => profiles.id),
    voidReason: text(),
    ...timestamps(),
    ...createdBy(),
  },
  (t) => [
    foreignKey({
      name: "payments_vendor_fk",
      columns: [t.shopId, t.vendorId],
      foreignColumns: [vendors.shopId, vendors.id],
    }),
    foreignKey({
      name: "payments_order_fk",
      columns: [t.shopId, t.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    index("payments_shop_vendor_idx").on(t.shopId, t.vendorId),
    index("payments_shop_received_idx").on(t.shopId, t.receivedAt.desc()),
    index("payments_order_idx").on(t.orderId),
    check("payments_amount_positive", sql`${t.amountPaise} > 0`),
    check(
      "payments_voided_fields",
      sql`(${t.voidedAt} IS NULL) = (${t.voidedBy} IS NULL)
        AND (${t.voidedAt} IS NULL) = (nullif(btrim(${t.voidReason}), '') IS NULL)`,
    ),
  ],
);
