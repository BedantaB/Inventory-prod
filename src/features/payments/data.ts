import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { orders, payments, profiles, vendors } from "@/db/schema";
import type { Database } from "@/db/types";
import { PAGE_SIZE } from "@/lib/list-params";
import type { PaymentMethod } from "./schemas";

// Customer payments and what each customer owes. Takes `db` so it can be tested with PGlite.
// Outstanding = completed orders − payments that are not voided. Cancelled orders and voided
// payments never count. Below zero means the customer has paid in advance (credit).

/**
 * Outstanding for the `vendors` row of the surrounding query, in paise. Plain SQL with the
 * table name written out: Drizzle leaves table names out in single-table queries.
 */
export const outstandingSql = sql<number>`(
  coalesce((SELECT sum(o.total_paise) FROM orders o
             WHERE o.shop_id = vendors.shop_id AND o.vendor_id = vendors.id AND o.status = 'COMPLETED'), 0)
  - coalesce((SELECT sum(p.amount_paise) FROM payments p
               WHERE p.shop_id = vendors.shop_id AND p.vendor_id = vendors.id AND p.voided_at IS NULL), 0)
)`;

export async function customerBalance(db: Database, shopId: string, customerId: string) {
  const [orderSum] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalPaise}), 0)`.mapWith(Number) })
    .from(orders)
    .where(
      and(
        eq(orders.shopId, shopId),
        eq(orders.vendorId, customerId),
        eq(orders.status, "COMPLETED"),
      ),
    );
  const [paidSum] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number) })
    .from(payments)
    .where(
      and(
        eq(payments.shopId, shopId),
        eq(payments.vendorId, customerId),
        isNull(payments.voidedAt),
      ),
    );
  return {
    ordersPaise: orderSum.total,
    paidPaise: paidSum.total,
    outstandingPaise: orderSum.total - paidSum.total,
  };
}

export type PaymentInput = {
  amountPaise: number;
  method: PaymentMethod;
  receivedAt: Date;
  reference: string | null;
  note: string | null;
};

/** Records money received from a customer of this shop (archived customers can still pay). */
export async function recordPayment(
  db: Database,
  shopId: string,
  customerId: string,
  input: PaymentInput,
  actorId: string,
): Promise<{ status: "recorded"; id: string } | { status: "not-found" }> {
  const [customer] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.shopId, shopId), eq(vendors.id, customerId)));
  if (!customer) return { status: "not-found" };
  const [row] = await db
    .insert(payments)
    .values({ shopId, vendorId: customerId, ...input, createdBy: actorId })
    .returning({ id: payments.id });
  return { status: "recorded", id: row.id };
}

/** Owner: marks a wrong payment as void. It stays on record and no longer counts. */
export async function voidPayment(
  db: Database,
  shopId: string,
  paymentId: string,
  reason: string,
  actorId: string,
): Promise<{ status: "voided" | "already-voided" | "not-found"; amountPaise?: number }> {
  const [row] = await db
    .update(payments)
    .set({ voidedAt: new Date(), voidedBy: actorId, voidReason: reason })
    .where(and(eq(payments.shopId, shopId), eq(payments.id, paymentId), isNull(payments.voidedAt)))
    .returning({ amountPaise: payments.amountPaise });
  if (row) return { status: "voided", amountPaise: row.amountPaise };
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.shopId, shopId), eq(payments.id, paymentId)));
  return { status: existing ? "already-voided" : "not-found" };
}

const voidedByProfile = alias(profiles, "voided_by_profile");

/** One customer's payments, newest first (voided ones included, marked). */
export async function listCustomerPayments(
  db: Database,
  shopId: string,
  customerId: string,
  page = 1,
) {
  const where = and(eq(payments.shopId, shopId), eq(payments.vendorId, customerId));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: payments.id,
        amountPaise: payments.amountPaise,
        method: payments.method,
        receivedAt: payments.receivedAt,
        reference: payments.reference,
        note: payments.note,
        orderId: payments.orderId,
        orderNumber: orders.orderNumber,
        createdByName: profiles.fullName,
        voidedAt: payments.voidedAt,
        voidReason: payments.voidReason,
        voidedByName: voidedByProfile.fullName,
      })
      .from(payments)
      .innerJoin(profiles, eq(payments.createdBy, profiles.id))
      .leftJoin(voidedByProfile, eq(payments.voidedBy, voidedByProfile.id))
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .where(where)
      .orderBy(desc(payments.receivedAt), desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(payments)
      .where(where),
  ]);
  return { rows, total, page };
}

export type PaymentRow = Awaited<ReturnType<typeof listCustomerPayments>>["rows"][number];

/** Money still to collect from all customers (only those who owe; advances don't offset). */
export async function totalToCollect(db: Database, shopId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(greatest(${outstandingSql}, 0)), 0)`.mapWith(Number),
    })
    .from(vendors)
    .where(eq(vendors.shopId, shopId));
  return row.total;
}

/** Payments received in [start, end), not voided. */
export async function collections(db: Database, shopId: string, start: Date, end: Date) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      totalPaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)`.mapWith(Number),
    })
    .from(payments)
    .where(
      and(
        eq(payments.shopId, shopId),
        isNull(payments.voidedAt),
        gte(payments.receivedAt, start),
        lt(payments.receivedAt, end),
      ),
    );
  return row;
}
