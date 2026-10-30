import { and, asc, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { items, orders, profiles, stockEntries, units, vendors } from "@/db/schema";
import type { Database } from "@/db/types";
import { collections, totalToCollect } from "@/features/payments/data";
import { itemDisplayName } from "@/features/items/data";
import { qtyFromDb } from "@/lib/qty";

// Numbers for the Home dashboard. Takes `db` so it can be tested with PGlite.

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today in India: [midnight, next midnight). */
export function istToday(now: Date): { start: Date; end: Date } {
  const start = Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS) };
}

// Brackets matter: this is combined with "not archived" using AND.
const lowOrOut = sql`(${items.currentStock} <= ${items.lowStockThreshold} OR ${items.currentStock} <= 0)`;

export async function getDashboard(
  db: Database,
  shopId: string,
  { now, showCost }: { now: Date; showCost: boolean },
) {
  const today = istToday(now);
  const active = and(eq(items.shopId, shopId), isNull(items.archivedAt));

  const [stock, lowStock, sales, drafts, recentEntries, recentOrders] = await Promise.all([
    db
      .select({
        activeItems: sql<number>`count(*)`.mapWith(Number),
        // Same rounding as everywhere else: each item's value to whole paise, half up.
        valuePaise:
          sql<number>`coalesce(sum(round(${items.currentStock} * ${items.avgCostPaise})), 0)`.mapWith(
            Number,
          ),
        lowCount:
          sql<number>`count(*) FILTER (WHERE ${items.currentStock} > 0 AND ${items.currentStock} <= ${items.lowStockThreshold})`.mapWith(
            Number,
          ),
        outCount: sql<number>`count(*) FILTER (WHERE ${items.currentStock} <= 0)`.mapWith(Number),
      })
      .from(items)
      .where(active),
    db
      .select({
        id: items.id,
        name: items.name,
        variant: items.variant,
        packSize: items.packSize,
        currentStock: items.currentStock,
        lowStockThreshold: items.lowStockThreshold,
        unitName: units.name,
      })
      .from(items)
      .innerJoin(units, eq(items.unitId, units.id))
      .where(and(active, lowOrOut))
      .orderBy(asc(items.currentStock), asc(sql`lower(${items.name})`))
      .limit(8),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        totalPaise: sql<number>`coalesce(sum(${orders.totalPaise}), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, shopId),
          eq(orders.status, "COMPLETED"),
          isNull(orders.archivedAt),
          gte(orders.completedAt, today.start),
          lt(orders.completedAt, today.end),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.shopId, shopId), eq(orders.status, "DRAFT"))),
    db
      .select({
        id: stockEntries.id,
        at: stockEntries.createdAt,
        reference: stockEntries.reference,
        byName: profiles.fullName,
        lineCount:
          sql<number>`(SELECT count(*) FROM stock_movements m WHERE m.stock_entry_id = ${stockEntries.id})`.mapWith(
            Number,
          ),
      })
      .from(stockEntries)
      .innerJoin(profiles, eq(stockEntries.createdBy, profiles.id))
      .where(eq(stockEntries.shopId, shopId))
      .orderBy(desc(stockEntries.createdAt))
      .limit(8),
    db
      .select({
        id: orders.id,
        status: orders.status,
        at: orders.completedAt,
        orderNumber: orders.orderNumber,
        totalPaise: orders.totalPaise,
        customerName: vendors.businessName,
        byName: profiles.fullName,
      })
      .from(orders)
      .innerJoin(vendors, eq(orders.vendorId, vendors.id))
      .innerJoin(profiles, eq(orders.completedBy, profiles.id))
      // Cancelled orders stay in the list (marked), but never count as sales above.
      .where(and(eq(orders.shopId, shopId), ne(orders.status, "DRAFT"), isNull(orders.archivedAt)))
      .orderBy(desc(orders.completedAt))
      .limit(8),
  ]);

  const [toCollectPaise, collectedToday] = await Promise.all([
    totalToCollect(db, shopId),
    collections(db, shopId, today.start, today.end),
  ]);

  // One "recent activity" list: stock bills and orders, newest first.
  const recent = [
    ...recentEntries.map((e) => ({
      kind: "stock" as const,
      id: e.id,
      at: e.at,
      title: e.reference,
      byName: e.byName,
      lineCount: e.lineCount,
      totalPaise: null,
      cancelled: false,
    })),
    ...recentOrders.map((o) => ({
      kind: "order" as const,
      id: o.id,
      at: o.at!,
      title: o.orderNumber,
      byName: o.byName,
      customerName: o.customerName,
      totalPaise: o.totalPaise ?? 0,
      cancelled: o.status === "CANCELLED",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return {
    activeItems: stock[0].activeItems,
    // Stock value reveals cost prices, so only the owner gets it.
    stockValuePaise: showCost ? stock[0].valuePaise : null,
    lowCount: stock[0].lowCount,
    outCount: stock[0].outCount,
    lowStock: lowStock.map((i) => ({
      id: i.id,
      label: itemDisplayName(i),
      packSize: i.packSize,
      unitName: i.unitName,
      stockMilli: qtyFromDb(i.currentStock),
      lowStockMilli: qtyFromDb(i.lowStockThreshold),
    })),
    today: { orders: sales[0].count, salesPaise: sales[0].totalPaise },
    drafts: drafts[0].count,
    toCollectPaise,
    collectedToday,
    recent,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
