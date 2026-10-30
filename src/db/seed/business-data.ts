import { and, eq, sql } from "drizzle-orm";
import * as schema from "../schema";
import type { Database } from "../types";
import { addDraftLine, checkoutDraft, createDraft, setDraftDiscount } from "@/features/orders/data";
import {
  seedBrands,
  seedCategories,
  seedItems,
  seedOrders,
  seedStockEntries,
  seedVendors,
} from "./data";
import { rupeesToPaise } from "@/lib/money";
import { parseQty, qtyToDb } from "@/lib/qty";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * HOUR_MS;

/** Midnight (Indian time) of the day containing `ms`. */
function startOfDayIst(ms: number) {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

function paise(rupees: number) {
  const value = rupeesToPaise(rupees.toFixed(2));
  if (value === null) throw new Error(`Bad amount in seed data: ${rupees}`);
  return value;
}

/** Removes all items, customers, stock and orders of every shop. Shops, logins and units are kept. */
export async function wipeBusinessData(db: Database) {
  await db.execute(sql`
    TRUNCATE payments, order_lines, stock_movements, orders, stock_entries, items, categories, brands, vendors, order_counters
  `);
  await db.execute(sql`ALTER SEQUENCE item_sku_seq RESTART`);
}

/**
 * Adds categories, items, customers and backdated stock-in bills to one shop, in one transaction.
 * `userIds` must contain the keys used in seedStockEntries (owner, ramesh, sunita).
 */
export async function seedBusinessData(
  db: Database,
  shopId: string,
  userIds: Record<string, string>,
) {
  const ownerId = userIds.owner;
  const now = Date.now();

  return db.transaction(async (tx) => {
    const units = await tx.select().from(schema.units).where(eq(schema.units.shopId, shopId));
    const unitByName = new Map(units.map((u) => [u.name, u]));

    const categories = await tx
      .insert(schema.categories)
      .values(seedCategories.map((name) => ({ shopId, name, createdBy: ownerId })))
      .returning();
    const categoryId = new Map(categories.map((c) => [c.name, c.id]));

    const brands = await tx
      .insert(schema.brands)
      .values(seedBrands.map((name) => ({ shopId, name, createdBy: ownerId })))
      .returning();
    const brandId = new Map(brands.map((b) => [b.name, b.id]));

    const items = await tx
      .insert(schema.items)
      .values(
        seedItems.map((item) => {
          const unit = unitByName.get(item.unit);
          if (!unit) throw new Error(`Unknown unit ${item.unit}`);
          return {
            shopId,
            sku: item.sku,
            name: item.name,
            variant: item.variant ?? null,
            brandId: brandId.get(item.brand),
            categoryId: categoryId.get(item.category),
            unitId: unit.id,
            packSize: item.packSize ?? null,
            mrpPaise: paise(item.mrp),
            sellingPricePaise: paise(item.sell),
            lowStockThreshold: qtyToDb(item.lowStock * 1000),
            createdAt: new Date(now - 30 * DAY_MS),
            createdBy: ownerId,
          };
        }),
      )
      .returning();
    const itemBySku = new Map(items.map((i) => [i.sku, i]));

    const vendors = await tx
      .insert(schema.vendors)
      .values(
        seedVendors.map((v) => ({
          ...v,
          shopId,
          phone: `+91${v.phone}`,
          createdAt: new Date(now - 29 * DAY_MS),
          createdBy: ownerId,
        })),
      )
      .returning({ id: schema.vendors.id, businessName: schema.vendors.businessName });
    const vendorId = new Map(vendors.map((v) => [v.businessName, v.id]));

    // Stock bills and orders in date order, so stock and average cost build up the way they
    // would in real life. Orders go through the real checkout.
    const timeline = [
      ...seedStockEntries.map((entry) => ({ at: now - entry.daysAgo * DAY_MS, entry })),
      ...seedOrders.map((order) => ({
        // A negative hour means "that many hours ago" (today's orders), kept within today.
        at:
          order.hour < 0
            ? Math.max(now + order.hour * HOUR_MS, startOfDayIst(now) + 60_000 * (10 + order.hour))
            : startOfDayIst(now - order.daysAgo * DAY_MS) + order.hour * HOUR_MS,
        order,
      })),
    ]
      .map((event) => (event.at > now ? { ...event, at: now - 60_000 } : event))
      .sort((a, b) => a.at - b.at);

    let movements = 0;
    let orderCount = 0;
    for (const event of timeline) {
      const createdAt = new Date(event.at);
      if ("entry" in event) {
        const entry = event.entry;
        const createdBy = userIds[entry.by];
        const [stockEntry] = await tx
          .insert(schema.stockEntries)
          .values({ shopId, reference: entry.reference, note: entry.note, createdAt, createdBy })
          .returning();

        for (const item of seedItems) {
          for (const [entryKey, qty, cost] of item.buys) {
            if (entryKey !== entry.key) continue;
            const unit = unitByName.get(item.unit)!;
            const qtyMilli = parseQty(String(qty), { allowDecimal: unit.allowsDecimal });
            if (qtyMilli === null)
              throw new Error(`Bad quantity ${qty} for ${item.sku} (${item.unit})`);
            await tx.insert(schema.stockMovements).values({
              shopId,
              type: "IN",
              itemId: itemBySku.get(item.sku)!.id,
              quantityChange: qtyToDb(qtyMilli),
              unitCostPaise: paise(cost),
              stockEntryId: stockEntry.id,
              createdAt,
              createdBy,
            });
            movements++;
          }
        }
      } else {
        const order = event.order;
        const by = userIds[order.by];
        const { id } = await createDraft(tx, shopId, by, vendorId.get(order.customer)!);
        for (const [sku, qty] of order.lines) {
          const item = itemBySku.get(sku);
          if (!item) throw new Error(`Unknown SKU in seed order: ${sku}`);
          const added = await addDraftLine(tx, shopId, id, item.id, by, false);
          if (added.status !== "ok") throw new Error(`Could not add ${sku}`);
          await tx
            .update(schema.orderLines)
            .set({ quantity: qtyToDb(qty * 1000) })
            .where(
              and(eq(schema.orderLines.shopId, shopId), eq(schema.orderLines.id, added.line.id)),
            );
        }
        if (order.discount)
          await setDraftDiscount(tx, shopId, id, order.discount.kind, order.discount.value);
        // Backdate while it's still a draft: completed orders can't be changed (trigger).
        await tx.update(schema.orders).set({ createdAt }).where(eq(schema.orders.id, id));
        const result = await checkoutDraft(tx, shopId, id, by, createdAt);
        if (result.status !== "completed")
          throw new Error(`Seed order failed: ${JSON.stringify(result)}`);
        orderCount++;
      }
    }

    return {
      categories: categories.length,
      brands: brands.length,
      items: items.length,
      vendors: seedVendors.length,
      stockEntries: seedStockEntries.length,
      movements,
      orders: orderCount,
    };
  });
}

/**
 * A second, small shop (a grocery), so you can check that two shops never see each other's data.
 */
export async function seedSecondShop(db: Database, shopId: string, ownerId: string) {
  return db.transaction(async (tx) => {
    const [pcs] = await tx
      .select()
      .from(schema.units)
      .where(and(eq(schema.units.shopId, shopId), eq(schema.units.name, "pcs")));
    const items = await tx
      .insert(schema.items)
      .values(
        [
          { sku: "GEN-001", name: "Rice Bag 25 kg", sell: 1450 },
          { sku: "GEN-002", name: "Mustard Oil 1 L", sell: 185 },
          { sku: "GEN-003", name: "Washing Soap", sell: 32 },
        ].map((item) => ({
          shopId,
          sku: item.sku,
          name: item.name,
          unitId: pcs.id,
          sellingPricePaise: paise(item.sell),
          lowStockThreshold: qtyToDb(5000),
          createdBy: ownerId,
        })),
      )
      .returning();
    await tx.insert(schema.vendors).values({
      shopId,
      businessName: "Sharma Kirana",
      contactPerson: "Rakesh Sharma",
      phone: "+919436099999",
      city: "Agartala",
      createdBy: ownerId,
    });
    const [entry] = await tx
      .insert(schema.stockEntries)
      .values({ shopId, reference: "OPENING", note: "Opening stock", createdBy: ownerId })
      .returning();
    for (const [index, item] of items.entries()) {
      await tx.insert(schema.stockMovements).values({
        shopId,
        type: "IN",
        itemId: item.id,
        quantityChange: qtyToDb((index + 1) * 20_000),
        unitCostPaise: Math.round((item.sellingPricePaise ?? 0) * 0.8),
        stockEntryId: entry.id,
        createdBy: ownerId,
      });
    }
    return { items: items.length };
  });
}
