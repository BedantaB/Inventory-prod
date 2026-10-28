import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seedBusinessData, wipeBusinessData } from "@/db/seed/business-data";
import { seedItems } from "@/db/seed/data";
import { createTestDb, createUser, type TestDb } from "./test-db";

let db: TestDb;
let userIds: Record<string, string>;

beforeAll(async () => {
  ({ db } = await createTestDb());
  userIds = {
    owner: (await createUser(db, { username: "owner", role: "ADMIN" })).id,
    ramesh: (await createUser(db, { username: "ramesh" })).id,
    sunita: (await createUser(db, { username: "sunita" })).id,
  };
});

describe("seed data", () => {
  it("loads cleanly and builds weighted average costs", async () => {
    const summary = await seedBusinessData(db, userIds);
    expect(summary.items).toBe(seedItems.length);

    const [basmati] = await db
      .select()
      .from(schema.items)
      .where(eq(schema.items.sku, "RICE-BAS-25"));
    expect(basmati.currentStock).toBe("70.000");
    // (40 × 2150 + 30 × 2190) / 70 = 2167.142… → ₹2,167.14
    expect(basmati.avgCostPaise).toBe(216_714);

    const [elaichi] = await db.select().from(schema.items).where(eq(schema.items.sku, "ELAICHI"));
    expect(elaichi.currentStock).toBe("0.000");
  });

  it("can be wiped and loaded again", async () => {
    await wipeBusinessData(db);
    expect(await db.select().from(schema.items)).toHaveLength(0);
    await seedBusinessData(db, userIds);
    expect(await db.select().from(schema.items)).toHaveLength(seedItems.length);
  });
});
