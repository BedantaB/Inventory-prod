import { sql } from "drizzle-orm";
import * as schema from "../schema";
import type { Database } from "../types";
import { seedBrands, seedCategories, seedItems, seedStockEntries, seedVendors } from "./data";
import { rupeesToPaise } from "@/lib/money";
import { parseQty, qtyToDb } from "@/lib/qty";

const DAY_MS = 24 * 60 * 60 * 1000;

function paise(rupees: number) {
  const value = rupeesToPaise(rupees.toFixed(2));
  if (value === null) throw new Error(`Bad amount in seed data: ${rupees}`);
  return value;
}

/** Removes all items, customers, stock and orders. Logins and units are kept. */
export async function wipeBusinessData(db: Database) {
  await db.execute(sql`
    TRUNCATE order_lines, stock_movements, orders, stock_entries, items, categories, brands, vendors, order_counters
  `);
  await db.execute(sql`ALTER SEQUENCE item_sku_seq RESTART`);
}

/**
 * Adds categories, items, customers and backdated stock-in bills in one transaction.
 * `userIds` must contain the keys used in seedStockEntries (owner, ramesh, sunita).
 */
export async function seedBusinessData(db: Database, userIds: Record<string, string>) {
  const ownerId = userIds.owner;
  const now = Date.now();

  return db.transaction(async (tx) => {
    const units = await tx.select().from(schema.units);
    const unitByName = new Map(units.map((u) => [u.name, u]));

    const categories = await tx
      .insert(schema.categories)
      .values(seedCategories.map((name) => ({ name, createdBy: ownerId })))
      .returning();
    const categoryId = new Map(categories.map((c) => [c.name, c.id]));

    const brands = await tx
      .insert(schema.brands)
      .values(seedBrands.map((name) => ({ name, createdBy: ownerId })))
      .returning();
    const brandId = new Map(brands.map((b) => [b.name, b.id]));

    const items = await tx
      .insert(schema.items)
      .values(
        seedItems.map((item) => {
          const unit = unitByName.get(item.unit);
          if (!unit) throw new Error(`Unknown unit ${item.unit}`);
          return {
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

    await tx.insert(schema.vendors).values(
      seedVendors.map((v) => ({
        ...v,
        phone: `+91${v.phone}`,
        createdAt: new Date(now - 29 * DAY_MS),
        createdBy: ownerId,
      })),
    );

    // Stock-in bills in date order, so the average cost builds up the way it would in real life.
    let movements = 0;
    for (const entry of seedStockEntries) {
      const createdAt = new Date(now - entry.daysAgo * DAY_MS);
      const createdBy = userIds[entry.by];
      const [stockEntry] = await tx
        .insert(schema.stockEntries)
        .values({ reference: entry.reference, note: entry.note, createdAt, createdBy })
        .returning();

      for (const item of seedItems) {
        for (const [entryKey, qty, cost] of item.buys) {
          if (entryKey !== entry.key) continue;
          const unit = unitByName.get(item.unit)!;
          const qtyMilli = parseQty(String(qty), { allowDecimal: unit.allowsDecimal });
          if (qtyMilli === null)
            throw new Error(`Bad quantity ${qty} for ${item.sku} (${item.unit})`);
          await tx.insert(schema.stockMovements).values({
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
    }

    return {
      categories: categories.length,
      brands: brands.length,
      items: items.length,
      vendors: seedVendors.length,
      stockEntries: seedStockEntries.length,
      movements,
    };
  });
}
