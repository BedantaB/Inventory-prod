import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { seedBusinessData } from "@/db/seed/business-data";
import { seedItems, seedOrders } from "@/db/seed/data";
import { getDashboard, istToday } from "@/features/dashboard/data";
import { createDraft } from "@/features/orders/data";
import { createTestDb, createUser, type TestDb } from "./test-db";

let db: TestDb;
let ownerId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  const ramesh = (await createUser(db, { username: "ramesh", fullName: "Ramesh Kumar" })).id;
  const sunita = (await createUser(db, { username: "sunita", fullName: "Sunita Devi" })).id;
  await seedBusinessData(db, { owner: ownerId, ramesh, sunita });
  await createDraft(db, ownerId);
});

describe("istToday", () => {
  it("uses the Indian calendar day", () => {
    const { start, end } = istToday(new Date("2026-10-28T20:00:00Z")); // 29 Oct, 1:30 am in India
    expect(start.toISOString()).toBe("2026-10-28T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-29T18:30:00.000Z");
  });
});

describe("getDashboard", () => {
  it("adds up items, stock value, warnings, today's sales and unfinished orders", async () => {
    const dashboard = await getDashboard(db, { now: new Date(), showCost: true });
    expect(dashboard.activeItems).toBe(seedItems.length);
    expect(dashboard.outCount).toBe(4);
    expect(dashboard.lowCount).toBe(5);
    expect(dashboard.lowStock).toHaveLength(8);
    expect(dashboard.lowStock[0].stockMilli).toBe(0); // out of stock first

    const [{ value }] = (
      await db.execute<{ value: string }>(
        sql`SELECT sum(round(current_stock * avg_cost_paise)) AS value FROM items`,
      )
    ).rows;
    expect(dashboard.stockValuePaise).toBe(Number(value));
    expect(dashboard.stockValuePaise).toBeGreaterThan(0);

    const todays = seedOrders.filter((o) => o.daysAgo === 0).length;
    expect(dashboard.today.orders).toBe(todays);
    expect(dashboard.today.salesPaise).toBeGreaterThan(0);
    expect(dashboard.drafts).toBe(1);
  });

  it("lists recent stock bills and orders together, newest first", async () => {
    const { recent } = await getDashboard(db, { now: new Date(), showCost: true });
    expect(recent).toHaveLength(8);
    const times = recent.map((r) => r.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(recent.some((r) => r.kind === "order")).toBe(true);
    expect(recent.some((r) => r.kind === "stock")).toBe(true);
  });

  it("leaves archived items out of the low-stock list", async () => {
    const before = await getDashboard(db, { now: new Date(), showCost: true });
    const outItem = before.lowStock[0]; // out of stock, listed first
    await db.execute(sql`UPDATE items SET archived_at = now() WHERE id = ${outItem.id}`);
    const after = await getDashboard(db, { now: new Date(), showCost: true });
    expect(after.lowStock.map((i) => i.id)).not.toContain(outItem.id);
    expect(after.outCount).toBe(before.outCount - 1);
    await db.execute(sql`UPDATE items SET archived_at = NULL WHERE id = ${outItem.id}`);
  });

  it("hides stock value from staff", async () => {
    expect(
      (await getDashboard(db, { now: new Date(), showCost: false })).stockValuePaise,
    ).toBeNull();
  });
});
