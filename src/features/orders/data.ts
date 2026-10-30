import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  max,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  items,
  orderCounters,
  orderLines,
  orders,
  payments,
  profiles,
  stockMovements,
  units,
  vendors,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/db/types";
import { itemDisplayName } from "@/features/items/data";
import { financialYear, formatOrderNumber } from "@/lib/financial-year";
import { PAGE_SIZE, searchPatterns } from "@/lib/list-params";
import { lineTotalPaise, qtyFromDb, qtyToDb, QTY_SCALE } from "@/lib/qty";
import type { PaymentMethod } from "@/features/payments/schemas";
import { orderTotals, type DiscountKind } from "./totals";

// Orders: drafts (the cart), checkout, and completed orders. Takes `db` so it can be tested
// with PGlite. "Customer" = the vendors table.
// Every function takes the shop: it only ever reads and writes that shop's rows.

// ---------------------------------------------------------------------------------------------
// Drafts (the cart)
// ---------------------------------------------------------------------------------------------

export async function createDraft(
  db: Database,
  shopId: string,
  actorId: string,
  vendorId: string | null = null,
) {
  const [order] = await db
    .insert(orders)
    .values({ shopId, vendorId, createdBy: actorId })
    .returning({ id: orders.id });
  return order;
}

export type DraftLine = {
  id: string;
  itemId: string;
  label: string;
  sku: string;
  packSize: string | null;
  unitName: string;
  allowsDecimal: boolean;
  stockMilli: number;
  mrpPaise: number | null;
  sellingPricePaise: number | null;
  /** Owner only; null for staff. */
  avgCostPaise: number | null;
  archived: boolean;
  qtyMilli: number;
  unitPricePaise: number | null;
};

const lineColumns = {
  id: orderLines.id,
  itemId: items.id,
  name: items.name,
  variant: items.variant,
  sku: items.sku,
  packSize: items.packSize,
  unitName: units.name,
  allowsDecimal: units.allowsDecimal,
  currentStock: items.currentStock,
  mrpPaise: items.mrpPaise,
  sellingPricePaise: items.sellingPricePaise,
  avgCostPaise: items.avgCostPaise,
  archivedAt: items.archivedAt,
  quantity: orderLines.quantity,
  unitPricePaise: orderLines.unitPricePaise,
};

function selectLines(db: Database) {
  return db
    .select(lineColumns)
    .from(orderLines)
    .innerJoin(items, eq(orderLines.itemId, items.id))
    .innerJoin(units, eq(items.unitId, units.id))
    .$dynamic();
}

type LineRow = Awaited<ReturnType<typeof selectLines>>[number];

function toDraftLine(r: LineRow, showCost: boolean): DraftLine {
  return {
    id: r.id,
    itemId: r.itemId,
    label: itemDisplayName(r),
    sku: r.sku,
    packSize: r.packSize,
    unitName: r.unitName,
    allowsDecimal: r.allowsDecimal,
    stockMilli: qtyFromDb(r.currentStock),
    mrpPaise: r.mrpPaise,
    sellingPricePaise: r.sellingPricePaise,
    avgCostPaise: showCost ? r.avgCostPaise : null,
    archived: r.archivedAt !== null,
    qtyMilli: qtyFromDb(r.quantity),
    unitPricePaise: r.unitPricePaise,
  };
}

export async function getDraft(db: Database, shopId: string, orderId: string, showCost: boolean) {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      discountKind: orders.discountKind,
      discountValue: orders.discountValue,
      createdAt: orders.createdAt,
      createdByName: profiles.fullName,
      vendorId: vendors.id,
      vendorName: vendors.businessName,
      vendorPhone: vendors.phone,
      vendorCity: vendors.city,
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.createdBy, profiles.id))
    .leftJoin(vendors, eq(orders.vendorId, vendors.id))
    .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId)));
  if (!order || order.status !== "DRAFT") return null;

  const rows = await selectLines(db)
    .where(eq(orderLines.orderId, orderId))
    .orderBy(asc(orderLines.position), asc(orderLines.createdAt));

  return {
    id: order.id,
    createdAt: order.createdAt,
    createdByName: order.createdByName,
    customer: order.vendorId
      ? {
          id: order.vendorId,
          businessName: order.vendorName!,
          phone: order.vendorPhone!,
          city: order.vendorCity,
        }
      : null,
    discountKind: order.discountKind as DiscountKind,
    discountValue: order.discountValue,
    lines: rows.map((r) => toDraftLine(r, showCost)),
  };
}

export type DraftView = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

/**
 * Locks the draft row; returns false if it's missing, belongs to another shop, or is already
 * completed. Everything that changes a draft goes through this first.
 */
async function lockDraft(db: Database, shopId: string, orderId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId)))
    .for("update");
  return row?.status === "DRAFT";
}

export type DraftResult = "ok" | "not-found";

export async function setDraftCustomer(
  db: Database,
  shopId: string,
  orderId: string,
  vendorId: string | null,
) {
  return db.transaction(async (tx): Promise<DraftResult> => {
    if (!(await lockDraft(tx, shopId, orderId))) return "not-found";
    if (vendorId) {
      const [customer] = await tx
        .select({ id: vendors.id })
        .from(vendors)
        .where(and(eq(vendors.shopId, shopId), eq(vendors.id, vendorId)));
      if (!customer) return "not-found";
    }
    await tx.update(orders).set({ vendorId }).where(eq(orders.id, orderId));
    return "ok";
  });
}

export async function setDraftDiscount(
  db: Database,
  shopId: string,
  orderId: string,
  kind: DiscountKind,
  value: number,
) {
  return db.transaction(async (tx): Promise<DraftResult> => {
    if (!(await lockDraft(tx, shopId, orderId))) return "not-found";
    await tx
      .update(orders)
      .set({ discountKind: kind, discountValue: value })
      .where(eq(orders.id, orderId));
    return "ok";
  });
}

/**
 * Adds an item to the cart (1 unit, at its usual selling price). If it's already in the cart,
 * adds 1 more instead of a second line.
 */
export async function addDraftLine(
  db: Database,
  shopId: string,
  orderId: string,
  itemId: string,
  actorId: string,
  showCost: boolean,
) {
  return db.transaction(async (tx) => {
    if (!(await lockDraft(tx, shopId, orderId))) return { status: "not-found" as const };
    const [item] = await tx
      .select({
        id: items.id,
        archivedAt: items.archivedAt,
        sellingPricePaise: items.sellingPricePaise,
      })
      .from(items)
      .where(and(eq(items.shopId, shopId), eq(items.id, itemId)));
    if (!item || item.archivedAt) return { status: "item-unavailable" as const };

    const [existing] = await tx
      .select({ id: orderLines.id, quantity: orderLines.quantity })
      .from(orderLines)
      .where(and(eq(orderLines.orderId, orderId), eq(orderLines.itemId, itemId)));

    let lineId: string;
    if (existing) {
      lineId = existing.id;
      await tx
        .update(orderLines)
        .set({ quantity: qtyToDb(qtyFromDb(existing.quantity) + QTY_SCALE) })
        .where(eq(orderLines.id, existing.id));
    } else {
      const [{ last }] = await tx
        .select({ last: max(orderLines.position) })
        .from(orderLines)
        .where(eq(orderLines.orderId, orderId));
      const [line] = await tx
        .insert(orderLines)
        .values({
          shopId,
          orderId,
          itemId,
          quantity: qtyToDb(QTY_SCALE),
          unitPricePaise: item.sellingPricePaise,
          position: (last ?? 0) + 1,
          createdBy: actorId,
        })
        .returning({ id: orderLines.id });
      lineId = line.id;
    }
    const [row] = await selectLines(tx).where(eq(orderLines.id, lineId));
    return { status: "ok" as const, line: toDraftLine(row, showCost), merged: Boolean(existing) };
  });
}

/** Saves quantity and price for one cart line. Price may be empty (null) while it's a draft. */
export async function updateDraftLine(
  db: Database,
  shopId: string,
  orderId: string,
  lineId: string,
  input: { qtyMilli: number; unitPricePaise: number | null },
) {
  return db.transaction(async (tx) => {
    if (!(await lockDraft(tx, shopId, orderId))) return "not-found" as const;
    const [line] = await tx
      .select({ allowsDecimal: units.allowsDecimal })
      .from(orderLines)
      .innerJoin(items, eq(orderLines.itemId, items.id))
      .innerJoin(units, eq(items.unitId, units.id))
      .where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
    if (!line) return "not-found" as const;
    if (!line.allowsDecimal && input.qtyMilli % QTY_SCALE !== 0)
      return "decimal-not-allowed" as const;
    await tx
      .update(orderLines)
      .set({ quantity: qtyToDb(input.qtyMilli), unitPricePaise: input.unitPricePaise })
      .where(eq(orderLines.id, lineId));
    return "ok" as const;
  });
}

export async function removeDraftLine(
  db: Database,
  shopId: string,
  orderId: string,
  lineId: string,
) {
  return db.transaction(async (tx): Promise<DraftResult> => {
    if (!(await lockDraft(tx, shopId, orderId))) return "not-found";
    await tx
      .delete(orderLines)
      .where(and(eq(orderLines.id, lineId), eq(orderLines.orderId, orderId)));
    return "ok";
  });
}

/** Throws away an unfinished order. Completed orders can never be deleted (database trigger). */
export async function discardDraft(db: Database, shopId: string, orderId: string) {
  const deleted = await db
    .delete(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), eq(orders.status, "DRAFT")))
    .returning({ id: orders.id });
  return deleted.length > 0;
}

/** Unfinished orders anyone can pick up, most recently changed first. */
export async function listDrafts(db: Database, shopId: string) {
  return db
    .select({
      id: orders.id,
      updatedAt: orders.updatedAt,
      createdByName: profiles.fullName,
      customerName: vendors.businessName,
      lineCount:
        sql<number>`(SELECT count(*) FROM order_lines l WHERE l.order_id = ${orders.id})`.mapWith(
          Number,
        ),
    })
    .from(orders)
    .innerJoin(profiles, eq(orders.createdBy, profiles.id))
    .leftJoin(vendors, eq(orders.vendorId, vendors.id))
    .where(and(eq(orders.shopId, shopId), eq(orders.status, "DRAFT")))
    .orderBy(desc(orders.updatedAt))
    .limit(50);
}

// ---------------------------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------------------------

export type Shortage = {
  lineId: string;
  label: string;
  unitName: string;
  wantedMilli: number;
  availableMilli: number;
};

export type CheckoutProblem =
  | { key: "orders.chooseCustomer" }
  | { key: "orders.customerArchived" }
  | { key: "orders.emptyCart" }
  | { key: "orders.missingPrice"; lineIds: string[] }
  | { key: "orders.itemArchived"; lineIds: string[] }
  | { key: "items.decimalNotAllowed"; lineIds: string[] }
  | { key: "payments.paidTooMuch" };

export type CheckoutResult =
  | { status: "completed"; id: string; orderNumber: string }
  | { status: "already-completed"; id: string; orderNumber: string }
  | { status: "not-found" }
  | { status: "problems"; problems: CheckoutProblem[] }
  | { status: "short"; shortages: Shortage[] };

/**
 * Turns a draft into a completed order in ONE transaction:
 *  1. lock the draft (a double tap can't complete it twice)
 *  2. check customer, prices and quantities
 *  3. lock every item row (always in id order, so two checkouts can't deadlock)
 *  4. check stock for ALL lines — if anything is short, stop and list everything that is short
 *  5. calculate totals from the database, take the next order number for the financial year
 *  6. write one stock-OUT movement per line (the trigger lowers stock and records the cost)
 *  7. mark the order COMPLETED
 *  8. record the "Paid now" payment, if any (never more than the total)
 * Nothing is written before step 5, so a rejected checkout changes nothing.
 */
export async function checkoutDraft(
  db: Database,
  shopId: string,
  orderId: string,
  actorId: string,
  at: Date = new Date(),
  paidNow: { amountPaise: number; method: PaymentMethod } | null = null,
): Promise<CheckoutResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: orders.id,
        status: orders.status,
        orderNumber: orders.orderNumber,
        vendorId: orders.vendorId,
        discountKind: orders.discountKind,
        discountValue: orders.discountValue,
      })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId)))
      .for("update");
    if (!order) return { status: "not-found" };
    if (order.status === "COMPLETED") {
      return { status: "already-completed", id: order.id, orderNumber: order.orderNumber! };
    }

    const problems: CheckoutProblem[] = [];
    if (!order.vendorId) {
      problems.push({ key: "orders.chooseCustomer" });
    } else {
      const [vendor] = await tx
        .select({ archivedAt: vendors.archivedAt })
        .from(vendors)
        .where(and(eq(vendors.shopId, shopId), eq(vendors.id, order.vendorId)));
      if (!vendor || vendor.archivedAt) problems.push({ key: "orders.customerArchived" });
    }

    const lines = await tx
      .select({
        id: orderLines.id,
        itemId: orderLines.itemId,
        quantity: orderLines.quantity,
        unitPricePaise: orderLines.unitPricePaise,
      })
      .from(orderLines)
      .where(eq(orderLines.orderId, orderId))
      .orderBy(asc(orderLines.position), asc(orderLines.createdAt));
    if (lines.length === 0) problems.push({ key: "orders.emptyCart" });

    const missingPrice = lines.filter((l) => l.unitPricePaise === null).map((l) => l.id);
    if (missingPrice.length > 0)
      problems.push({ key: "orders.missingPrice", lineIds: missingPrice });

    // Lock the items, in id order.
    const itemIds = [...new Set(lines.map((l) => l.itemId))].sort();
    const lockedItems =
      itemIds.length === 0
        ? []
        : await tx
            .select({
              id: items.id,
              name: items.name,
              variant: items.variant,
              currentStock: items.currentStock,
              archivedAt: items.archivedAt,
              unitName: units.name,
              allowsDecimal: units.allowsDecimal,
            })
            .from(items)
            .innerJoin(units, eq(items.unitId, units.id))
            .where(and(eq(items.shopId, shopId), inArray(items.id, itemIds)))
            .orderBy(asc(items.id))
            .for("update", { of: items });
    const itemById = new Map(lockedItems.map((i) => [i.id, i]));

    const archived = lines.filter((l) => itemById.get(l.itemId)?.archivedAt).map((l) => l.id);
    if (archived.length > 0) problems.push({ key: "orders.itemArchived", lineIds: archived });
    const decimals = lines
      .filter(
        (l) => !itemById.get(l.itemId)?.allowsDecimal && qtyFromDb(l.quantity) % QTY_SCALE !== 0,
      )
      .map((l) => l.id);
    if (decimals.length > 0) problems.push({ key: "items.decimalNotAllowed", lineIds: decimals });

    if (problems.length > 0) return { status: "problems", problems };

    const shortages: Shortage[] = [];
    for (const line of lines) {
      const item = itemById.get(line.itemId)!;
      const wanted = qtyFromDb(line.quantity);
      const available = qtyFromDb(item.currentStock);
      if (wanted > available) {
        shortages.push({
          lineId: line.id,
          label: itemDisplayName(item),
          unitName: item.unitName,
          wantedMilli: wanted,
          availableMilli: available,
        });
      }
    }
    if (shortages.length > 0) return { status: "short", shortages };

    // Totals from database values only.
    const priced = lines.map((l) => ({
      ...l,
      qtyMilli: qtyFromDb(l.quantity),
      unitPricePaise: l.unitPricePaise!,
    }));
    const totals = orderTotals(priced, { kind: order.discountKind, value: order.discountValue });
    if (paidNow && paidNow.amountPaise > totals.total) {
      return { status: "problems", problems: [{ key: "payments.paidTooMuch" }] };
    }

    // Next order number for this financial year (rolls back with the transaction, so no gaps).
    const fy = financialYear(at);
    const [counter] = await tx
      .insert(orderCounters)
      .values({ shopId, financialYear: fy, lastValue: 1 })
      .onConflictDoUpdate({
        target: [orderCounters.shopId, orderCounters.financialYear],
        set: { lastValue: sql`${orderCounters.lastValue} + 1` },
      })
      .returning({ lastValue: orderCounters.lastValue });
    const orderNumber = formatOrderNumber(fy, counter.lastValue);

    for (const line of priced) {
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          shopId,
          type: "OUT",
          itemId: line.itemId,
          quantityChange: qtyToDb(-line.qtyMilli),
          unitPricePaise: line.unitPricePaise,
          orderId,
          createdAt: at,
          createdBy: actorId,
        })
        .returning({ unitCostPaise: stockMovements.unitCostPaise });
      await tx
        .update(orderLines)
        .set({
          unitCostPaise: movement.unitCostPaise,
          lineTotalPaise: lineTotalPaise(line.qtyMilli, line.unitPricePaise),
        })
        .where(eq(orderLines.id, line.id));
    }

    await tx
      .update(orders)
      .set({
        status: "COMPLETED",
        orderNumber,
        subtotalPaise: totals.subtotal,
        discountPaise: totals.discount,
        totalPaise: totals.total,
        completedAt: at,
        completedBy: actorId,
      })
      .where(eq(orders.id, orderId));

    if (paidNow) {
      await tx.insert(payments).values({
        shopId,
        vendorId: order.vendorId!,
        orderId,
        amountPaise: paidNow.amountPaise,
        method: paidNow.method,
        receivedAt: at,
        createdBy: actorId,
      });
    }

    return { status: "completed", id: orderId, orderNumber };
  });
}

// ---------------------------------------------------------------------------------------------
// Completed orders
// ---------------------------------------------------------------------------------------------

const cancelledByProfile = alias(profiles, "cancelled_by_profile");

/** A completed or cancelled order (drafts are shown by getDraft). */
export async function getOrder(db: Database, shopId: string, orderId: string, showCost: boolean) {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      orderNumber: orders.orderNumber,
      subtotalPaise: orders.subtotalPaise,
      discountPaise: orders.discountPaise,
      discountKind: orders.discountKind,
      discountValue: orders.discountValue,
      totalPaise: orders.totalPaise,
      completedAt: orders.completedAt,
      archivedAt: orders.archivedAt,
      completedByName: profiles.fullName,
      cancelledAt: orders.cancelledAt,
      cancelReason: orders.cancelReason,
      cancelledByName: cancelledByProfile.fullName,
      paidPaise: sql<number>`(
        SELECT coalesce(sum(p.amount_paise), 0) FROM payments p
         WHERE p.order_id = ${orders.id} AND p.voided_at IS NULL
      )`.mapWith(Number),
      customerId: vendors.id,
      customerName: vendors.businessName,
      customerPhone: vendors.phone,
      customerCity: vendors.city,
      customerAddress: vendors.address,
    })
    .from(orders)
    .innerJoin(vendors, eq(orders.vendorId, vendors.id))
    .innerJoin(profiles, eq(orders.completedBy, profiles.id))
    .leftJoin(cancelledByProfile, eq(orders.cancelledBy, cancelledByProfile.id))
    .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), ne(orders.status, "DRAFT")));
  if (!order) return null;

  const lines = await db
    .select({
      id: orderLines.id,
      itemId: items.id,
      name: items.name,
      variant: items.variant,
      packSize: items.packSize,
      sku: items.sku,
      unitName: units.name,
      quantity: orderLines.quantity,
      unitPricePaise: orderLines.unitPricePaise,
      unitCostPaise: orderLines.unitCostPaise,
      lineTotalPaise: orderLines.lineTotalPaise,
    })
    .from(orderLines)
    .innerJoin(items, eq(orderLines.itemId, items.id))
    .innerJoin(units, eq(items.unitId, units.id))
    .where(eq(orderLines.orderId, orderId))
    .orderBy(asc(orderLines.position), asc(orderLines.createdAt));

  return {
    ...order,
    subtotalPaise: order.subtotalPaise ?? 0,
    discountPaise: order.discountPaise ?? 0,
    totalPaise: order.totalPaise ?? 0,
    completedAt: order.completedAt!,
    lines: lines.map(({ quantity, unitCostPaise, ...l }) => ({
      ...l,
      label: itemDisplayName(l),
      qtyMilli: qtyFromDb(quantity),
      unitPricePaise: l.unitPricePaise ?? 0,
      lineTotalPaise: l.lineTotalPaise ?? 0,
      unitCostPaise: showCost ? (unitCostPaise ?? 0) : null,
    })),
  };
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function setOrderArchived(
  db: Database,
  shopId: string,
  orderId: string,
  archived: boolean,
) {
  const [row] = await db
    .update(orders)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId), ne(orders.status, "DRAFT")))
    .returning({ id: orders.id, orderNumber: orders.orderNumber });
  return row ?? null;
}

export type CancelResult =
  | { status: "cancelled"; orderNumber: string }
  | { status: "already-cancelled"; orderNumber: string }
  | { status: "not-found" };

/**
 * Cancels a completed order (owner), in ONE transaction:
 *  1. lock the order (two people can't cancel it twice)
 *  2. mark it CANCELLED with who, when and why — it keeps its number, so there are no gaps
 *  3. lock the items (id order, like checkout, so the two can't deadlock)
 *  4. write one RETURN movement per sold line, at the cost it was sold at: stock goes back
 *     and the average cost is recalculated as if it had been bought back at that cost
 * Cancelled orders no longer count as sales anywhere.
 */
export async function cancelOrder(
  db: Database,
  shopId: string,
  orderId: string,
  reason: string,
  actorId: string,
  at: Date = new Date(),
): Promise<CancelResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ status: orders.status, orderNumber: orders.orderNumber })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.id, orderId)))
      .for("update");
    if (!order || order.status === "DRAFT") return { status: "not-found" };
    if (order.status === "CANCELLED") {
      return { status: "already-cancelled", orderNumber: order.orderNumber! };
    }

    await tx
      .update(orders)
      .set({ status: "CANCELLED", cancelledAt: at, cancelledBy: actorId, cancelReason: reason })
      .where(eq(orders.id, orderId));

    const sold = await tx
      .select({
        itemId: stockMovements.itemId,
        quantityChange: stockMovements.quantityChange,
        unitCostPaise: stockMovements.unitCostPaise,
        unitPricePaise: stockMovements.unitPricePaise,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.shopId, shopId),
          eq(stockMovements.orderId, orderId),
          eq(stockMovements.type, "OUT"),
        ),
      )
      .orderBy(asc(stockMovements.seq));

    const itemIds = [...new Set(sold.map((m) => m.itemId))].sort();
    if (itemIds.length > 0) {
      await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.shopId, shopId), inArray(items.id, itemIds)))
        .orderBy(asc(items.id))
        .for("update");
    }
    for (const movement of sold) {
      await tx.insert(stockMovements).values({
        shopId,
        type: "RETURN",
        itemId: movement.itemId,
        quantityChange: qtyToDb(-qtyFromDb(movement.quantityChange)),
        unitCostPaise: movement.unitCostPaise ?? 0,
        unitPricePaise: movement.unitPricePaise,
        orderId,
        createdAt: at,
        createdBy: actorId,
      });
    }
    return { status: "cancelled", orderNumber: order.orderNumber! };
  });
}

export const ORDER_STATUS_FILTERS = ["all", "completed", "cancelled"] as const;
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

export type OrderListParams = {
  q?: string;
  status?: OrderStatusFilter;
  customerId?: string;
  from?: Date;
  /** Exclusive. */
  to?: Date;
  page?: number;
  archived?: boolean;
};

/**
 * Completed and cancelled orders, newest first. Search matches order number, customer name,
 * phone or city. The summary counts completed orders only: cancelled ones are not sales.
 */
export async function listOrders(db: Database, shopId: string, params: OrderListParams) {
  const page = params.page ?? 1;
  const status = params.status ?? "all";
  const conditions: (SQL | undefined)[] = [
    eq(orders.shopId, shopId),
    status === "all"
      ? ne(orders.status, "DRAFT")
      : eq(orders.status, status === "completed" ? "COMPLETED" : "CANCELLED"),
    params.archived ? isNotNull(orders.archivedAt) : isNull(orders.archivedAt),
  ];
  for (const pattern of searchPatterns(params.q)) {
    conditions.push(
      or(
        ilike(orders.orderNumber, pattern),
        ilike(vendors.businessName, pattern),
        ilike(vendors.phone, pattern),
        ilike(vendors.city, pattern),
      ),
    );
  }
  if (params.customerId) conditions.push(eq(orders.vendorId, params.customerId));
  if (params.from) conditions.push(gte(orders.completedAt, params.from));
  if (params.to) conditions.push(lt(orders.completedAt, params.to));
  const where = and(...conditions);

  const [rows, [summary]] = await Promise.all([
    db
      .select({
        id: orders.id,
        status: orders.status,
        orderNumber: orders.orderNumber,
        completedAt: orders.completedAt,
        totalPaise: orders.totalPaise,
        customerId: vendors.id,
        customerName: vendors.businessName,
        customerCity: vendors.city,
        lineCount:
          sql<number>`(SELECT count(*) FROM order_lines l WHERE l.order_id = ${orders.id})`.mapWith(
            Number,
          ),
      })
      .from(orders)
      .innerJoin(vendors, eq(orders.vendorId, vendors.id))
      .where(where)
      .orderBy(desc(orders.completedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        completed: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'COMPLETED')`.mapWith(
          Number,
        ),
        totalPaise:
          sql<number>`coalesce(sum(${orders.totalPaise}) FILTER (WHERE ${orders.status} = 'COMPLETED'), 0)`.mapWith(
            Number,
          ),
      })
      .from(orders)
      .innerJoin(vendors, eq(orders.vendorId, vendors.id))
      .where(where),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, completedAt: r.completedAt!, totalPaise: r.totalPaise ?? 0 })),
    total: summary.total,
    completed: summary.completed,
    cancelled: summary.total - summary.completed,
    totalPaise: summary.totalPaise,
    page,
  };
}

/** Customers for the order picker (search as you type). */
export async function searchCustomers(db: Database, shopId: string, query: string, limit = 10) {
  const conditions: (SQL | undefined)[] = [eq(vendors.shopId, shopId), isNull(vendors.archivedAt)];
  for (const pattern of searchPatterns(query)) {
    conditions.push(
      or(
        ilike(vendors.businessName, pattern),
        ilike(vendors.contactPerson, pattern),
        ilike(vendors.phone, pattern),
        ilike(vendors.city, pattern),
      ),
    );
  }
  return db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      phone: vendors.phone,
      city: vendors.city,
    })
    .from(vendors)
    .where(and(...conditions))
    .orderBy(asc(sql`lower(${vendors.businessName})`))
    .limit(limit);
}
