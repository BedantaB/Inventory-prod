import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { DB_ERROR } from "@/db/errors";
import { qtyToDb } from "@/lib/qty";
import {
  createItem,
  createTestDb,
  createUser,
  defaultShopId,
  expectPgError,
  getItem,
  stockIn,
  type TestDb,
} from "./test-db";

let db: TestDb;
let shopId: string;
let userId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  shopId = await defaultShopId(db);
  userId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
});

async function createDraftOrder() {
  const [order] = await db.insert(schema.orders).values({ shopId, createdBy: userId }).returning();
  return order;
}

async function stockOut(itemId: string, qtyMilli: number, unitPricePaise: number) {
  const order = await createDraftOrder();
  const [movement] = await db
    .insert(schema.stockMovements)
    .values({
      shopId,
      type: "OUT",
      itemId,
      quantityChange: qtyToDb(-qtyMilli),
      unitPricePaise,
      orderId: order.id,
      createdBy: userId,
    })
    .returning();
  return movement;
}

describe("stock in", () => {
  it("increases stock and sets the average cost from the first purchase", async () => {
    const item = await createItem(db, userId, { name: "Toor Dal 1 kg" });
    const movement = await stockIn(db, userId, item.id, 10_000, 10_000); // 10 @ ₹100

    expect(movement.stockAfter).toBe("10.000");
    const after = await getItem(db, item.id);
    expect(after.currentStock).toBe("10.000");
    expect(after.avgCostPaise).toBe(10_000);
  });

  it("keeps a weighted average across purchases", async () => {
    const item = await createItem(db, userId, { name: "Sugar 50 kg bag" });
    await stockIn(db, userId, item.id, 10_000, 10_000); // 10 @ ₹100
    await stockIn(db, userId, item.id, 30_000, 12_000); // 30 @ ₹120

    const after = await getItem(db, item.id);
    expect(after.currentStock).toBe("40.000");
    expect(after.avgCostPaise).toBe(11_500); // (1000 + 3600) / 40 = ₹115
  });

  it("handles decimal quantities and rounds the average to whole paise", async () => {
    const item = await createItem(db, userId, { name: "Loose Haldi", unit: "kg" });
    await stockIn(db, userId, item.id, 2_500, 4_000); // 2.5 kg @ ₹40
    await stockIn(db, userId, item.id, 1_250, 4_400); // 1.25 kg @ ₹44

    const after = await getItem(db, item.id);
    expect(after.currentStock).toBe("3.750");
    expect(after.avgCostPaise).toBe(4_133); // 155.00 / 3.75 = 41.333…
  });

  it("starts the average again from the new cost once stock had run out", async () => {
    const item = await createItem(db, userId, { name: "Mustard Oil 1 L" });
    await stockIn(db, userId, item.id, 5_000, 15_000);
    await stockOut(item.id, 5_000, 18_000);
    await stockIn(db, userId, item.id, 2_000, 16_000);

    expect((await getItem(db, item.id)).avgCostPaise).toBe(16_000);
  });
});

describe("stock out", () => {
  it("decreases stock, records the cost at sale, and leaves the average unchanged", async () => {
    const item = await createItem(db, userId, { name: "Basmati Rice 25 kg" });
    await stockIn(db, userId, item.id, 20_000, 150_000);
    const movement = await stockOut(item.id, 3_000, 175_000);

    expect(movement.unitCostPaise).toBe(150_000);
    expect(movement.stockAfter).toBe("17.000");
    const after = await getItem(db, item.id);
    expect(after.currentStock).toBe("17.000");
    expect(after.avgCostPaise).toBe(150_000);
  });

  it("refuses to sell more than is in stock and changes nothing", async () => {
    const item = await createItem(db, userId, { name: "Besan 1 kg" });
    await stockIn(db, userId, item.id, 2_000, 9_000);

    await expectPgError(stockOut(item.id, 3_000, 10_000), DB_ERROR.insufficientStock);
    expect((await getItem(db, item.id)).currentStock).toBe("2.000");
  });
});

describe("guards", () => {
  it("blocks changing stock or average cost directly", async () => {
    const item = await createItem(db, userId, { name: "Poha 1 kg" });
    await expectPgError(
      db.update(schema.items).set({ currentStock: "100.000" }).where(eq(schema.items.id, item.id)),
      DB_ERROR.stockGuard,
    );
    await expectPgError(
      db.update(schema.items).set({ avgCostPaise: 1 }).where(eq(schema.items.id, item.id)),
      DB_ERROR.stockGuard,
    );
  });

  it("blocks creating an item that already has stock", async () => {
    const unit = await db.query.units.findFirst();
    await expectPgError(
      db.insert(schema.items).values({
        shopId,
        name: "Sneaky item",
        unitId: unit!.id,
        currentStock: "5.000",
        createdBy: userId,
      }),
      DB_ERROR.stockGuard,
    );
  });

  it("still allows editing other item fields", async () => {
    const item = await createItem(db, userId, { name: "Rava" });
    const [updated] = await db
      .update(schema.items)
      .set({ name: "Rava (Sooji) 1 kg", sellingPricePaise: 5_500 })
      .where(eq(schema.items.id, item.id))
      .returning();
    expect(updated.name).toBe("Rava (Sooji) 1 kg");
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(item.updatedAt.getTime());
  });

  it("never lets stock history be edited or deleted", async () => {
    const item = await createItem(db, userId, { name: "Jeera 100 g" });
    const movement = await stockIn(db, userId, item.id, 1_000, 2_000);
    await expectPgError(
      db
        .update(schema.stockMovements)
        .set({ note: "edited" })
        .where(eq(schema.stockMovements.id, movement.id)),
      DB_ERROR.ledgerImmutable,
    );
    await expectPgError(
      db.delete(schema.stockMovements).where(eq(schema.stockMovements.id, movement.id)),
      DB_ERROR.ledgerImmutable,
    );
  });

  it("keeps current_stock equal to the sum of its movements", async () => {
    const item = await createItem(db, userId, { name: "Chana Dal", unit: "kg" });
    await stockIn(db, userId, item.id, 12_500, 7_000);
    await stockOut(item.id, 2_750, 8_000);
    await stockIn(db, userId, item.id, 1_000, 7_200);

    const [{ total }] = await db
      .select({ total: sql<string>`sum(${schema.stockMovements.quantityChange})` })
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.itemId, item.id));
    expect((await getItem(db, item.id)).currentStock).toBe(total);
  });
});

describe("SKU", () => {
  it("generates one when left blank", async () => {
    const item = await createItem(db, userId, { name: "No SKU item" });
    expect(item.sku).toMatch(/^ITM-\d{5}$/);
  });

  it("skips generated numbers someone already typed by hand", async () => {
    const next = await db.execute<{ v: string }>(
      sql`SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END AS v FROM item_sku_seq`,
    );
    const taken = `ITM-${String(next.rows[0].v).padStart(5, "0")}`;
    await createItem(db, userId, { name: "Manual", sku: taken.toLowerCase() });
    const generated = await createItem(db, userId, { name: "Auto" });
    expect(generated.sku).not.toBe(taken);
  });

  it("is trimmed, upper-cased and unique", async () => {
    const item = await createItem(db, userId, { name: "Ghee 1 L", sku: "  ghee-1l " });
    expect(item.sku).toBe("GHEE-1L");
    await expectPgError(
      createItem(db, userId, { name: "Ghee again", sku: "GHEE-1L" }),
      DB_ERROR.uniqueViolation,
    );
  });
});
