import { beforeAll, describe, expect, it } from "vitest";
import { seedBusinessData } from "@/db/seed/business-data";
import {
  createStockEntry,
  getStockEntry,
  lastCosts,
  listItemMovements,
  StockEntryProblem,
} from "@/features/inventory/data";
import { getItem, listItems, setItemArchived } from "@/features/items/data";
import { createTestDb, createUser, type TestDb } from "./test-db";

let db: TestDb;
let ownerId: string;
let rameshId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  rameshId = (await createUser(db, { username: "ramesh", fullName: "Ramesh Kumar" })).id;
  const sunita = (await createUser(db, { username: "sunita" })).id;
  await seedBusinessData(db, { owner: ownerId, ramesh: rameshId, sunita });
});

async function find(q: string) {
  const [item] = (await listItems(db, { q })).rows;
  return item;
}

describe("createStockEntry", () => {
  it("adds every line in one go and updates stock and average cost", async () => {
    const glue = await find("glue stick 8"); // 300 pcs @ ₹17.67
    const superio = await find("superio"); // out of stock
    const entry = await createStockEntry(
      db,
      {
        reference: "DOMS-INV-1",
        note: "Morning delivery",
        lines: [
          { itemId: glue.id, qtyMilli: 100_000, unitCostPaise: 1_900 },
          { itemId: superio.id, qtyMilli: 12_000, unitCostPaise: 9_000 },
        ],
      },
      rameshId,
    );

    const glueAfter = await getItem(db, glue.id);
    expect(glueAfter?.stockMilli).toBe(400_000);
    // (300 × 17.67 + 100 × 19.00) / 400 = 18.0025 → ₹18.00
    expect(glueAfter?.avgCostPaise).toBe(1_800);
    expect((await getItem(db, superio.id))?.avgCostPaise).toBe(9_000);

    const saved = await getStockEntry(db, entry.id);
    expect(saved).toMatchObject({
      reference: "DOMS-INV-1",
      note: "Morning delivery",
      createdByName: "Ramesh Kumar",
    });
    expect(
      saved?.lines.map((l) => [l.name, l.qtyMilli, l.unitCostPaise, l.stockAfterMilli]),
    ).toEqual([
      ["Glue Stick", 100_000, 1_900, 400_000],
      ["Superio Pencils", 12_000, 9_000, 12_000],
    ]);
  });

  it("allows the same item twice (two batches at different costs)", async () => {
    const gum = await find("gum 20");
    const before = gum.stockMilli;
    await createStockEntry(
      db,
      {
        reference: null,
        note: null,
        lines: [
          { itemId: gum.id, qtyMilli: 10_000, unitCostPaise: 300 },
          { itemId: gum.id, qtyMilli: 10_000, unitCostPaise: 400 },
        ],
      },
      ownerId,
    );
    expect((await getItem(db, gum.id))?.stockMilli).toBe(before + 20_000);
  });

  it("refuses archived items and decimals for whole-number units, and saves nothing", async () => {
    const compass = await find("compass");
    const scale = await find("scale 15");
    await setItemArchived(db, compass.id, true);

    const attempt = createStockEntry(
      db,
      {
        reference: "BAD",
        note: null,
        lines: [
          { itemId: scale.id, qtyMilli: 10_000, unitCostPaise: 300 },
          { itemId: compass.id, qtyMilli: 5_000, unitCostPaise: 1_500 },
          { itemId: scale.id, qtyMilli: 2_500, unitCostPaise: 300 },
        ],
      },
      ownerId,
    );
    await expect(attempt).rejects.toBeInstanceOf(StockEntryProblem);
    await attempt.catch((error: StockEntryProblem) =>
      expect(error.problems).toEqual([
        { line: 1, field: "itemId", key: "stock.itemArchived" },
        { line: 2, field: "quantity", key: "items.decimalNotAllowed" },
      ]),
    );
    expect((await getItem(db, scale.id))?.stockMilli).toBe(scale.stockMilli);
    await setItemArchived(db, compass.id, false);
  });
});

describe("stock history", () => {
  it("lists an item's movements newest first with who and which bill", async () => {
    const glue = await find("glue stick 8");
    const history = await listItemMovements(db, glue.id);
    expect(history.total).toBe(3); // opening, second bill, DOMS-INV-1
    expect(history.rows[0]).toMatchObject({
      type: "IN",
      qtyMilli: 100_000,
      stockAfterMilli: 400_000,
      entryReference: "DOMS-INV-1",
      createdByName: "Ramesh Kumar",
    });
    expect(history.rows.at(-1)).toMatchObject({
      entryReference: "OPENING",
      stockAfterMilli: 200_000,
    });
  });

  it("knows the last cost paid for each item", async () => {
    const glue = await find("glue stick 8");
    const elsewhere = await find("art apps"); // never stocked
    const costs = await lastCosts(db, [glue.id, elsewhere.id]);
    expect(costs.get(glue.id)).toBe(1_900);
    expect(costs.has(elsewhere.id)).toBe(false);
  });
});
