import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seedBusinessData, seedSecondShop, wipeBusinessData } from "@/db/seed/business-data";
import { seedItems } from "@/db/seed/data";
import { createShop, createTestDb, createUser, defaultShopId, type TestDb } from "./test-db";

let db: TestDb;
let shopId: string;
let userIds: Record<string, string>;

beforeAll(async () => {
  ({ db } = await createTestDb());
  shopId = await defaultShopId(db);
  userIds = {
    owner: (await createUser(db, { username: "owner", role: "ADMIN" })).id,
    ramesh: (await createUser(db, { username: "ramesh" })).id,
    sunita: (await createUser(db, { username: "sunita" })).id,
  };
});

describe("seed data", () => {
  it("loads cleanly and builds weighted average costs", async () => {
    const summary = await seedBusinessData(db, shopId, userIds);
    expect(summary.items).toBe(seedItems.length);

    expect(summary.items).toBe(150); // 129 list rows + 21 extra colours

    const [glueStick] = await db
      .select()
      .from(schema.items)
      .where(eq(schema.items.sku, "DOMS-008"));
    expect(glueStick.currentStock).toBe("300.000");
    // 200 @ ₹17.50 + 100 @ ₹18.00 → ₹17.666… → ₹17.67
    expect(glueStick.avgCostPaise).toBe(1_767);
    expect(glueStick.mrpPaise).toBe(2_500);

    const [superio] = await db.select().from(schema.items).where(eq(schema.items.sku, "DOMS-022"));
    expect(superio.currentStock).toBe("0.000");
  });

  it("can be wiped and loaded again", async () => {
    await wipeBusinessData(db);
    expect(await db.select().from(schema.items)).toHaveLength(0);
    await seedBusinessData(db, shopId, userIds);
    expect(await db.select().from(schema.items)).toHaveLength(seedItems.length);
  });

  it("adds the small second shop next to the first", async () => {
    const second = await createShop(db, "Sharma General Store");
    const sharma = await createUser(db, { username: "sharma", role: "ADMIN", shopId: second.id });
    expect(await seedSecondShop(db, second.id, sharma.id)).toEqual({ items: 3 });
    const inSecond = await db.select().from(schema.items).where(eq(schema.items.shopId, second.id));
    expect(inSecond).toHaveLength(3);
  });
});
