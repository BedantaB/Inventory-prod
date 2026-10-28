import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { importContext, importItems, listBrands, listItems } from "@/features/items/data";
import { checkImport } from "@/features/items/import";
import { createTestDb, createUser, type TestDb } from "./test-db";

let db: TestDb;
let ownerId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
});

const CSV = `Name,Colour/Variant,Brand,Category,Unit,Pack size,MRP,Selling price,Low stock warning,SKU,Opening stock,Cost price
Permanent Marker,Blue,DOMS,Markers,pcs,Pkt of 10,20,17,50,DOMS-002-BLU,200,14
Permanent Marker,Black,doms,Markers,pcs,Pkt of 10,20,17,50,DOMS-002-BLK,100,14
Notebook,,Classmate,Books,pcs,172 pages,60,52,,,,
`;

describe("importItems", () => {
  it("adds every row, creates brands and categories once, and books opening stock", async () => {
    const check = checkImport(CSV, await importContext(db));
    expect(check.problems).toEqual([]);

    const result = await importItems(db, check.rows, ownerId, "Opening stock (imported)");
    expect(result).toEqual({ items: 3, withStock: 2, brands: 2, categories: 2 });

    const { rows } = await listItems(db, { q: "permanent marker" });
    expect(rows.map((r) => [r.variant, r.stockMilli, r.avgCostPaise, r.brandName])).toEqual([
      ["Black", 100_000, 1400, "DOMS"],
      ["Blue", 200_000, 1400, "DOMS"],
    ]);
    expect((await listBrands(db)).map((b) => b.name)).toEqual(["Classmate", "DOMS"]);

    const entries = await db
      .select()
      .from(schema.stockEntries)
      .where(eq(schema.stockEntries.reference, "IMPORT"));
    expect(entries).toHaveLength(1);
  });

  it("then refuses the same file again", async () => {
    const check = checkImport(CSV, await importContext(db));
    expect(check.rows).toEqual([]);
    expect(check.problems.map((p) => p.key)).toEqual([
      "import.skuExists",
      "import.itemExists",
      "import.skuExists",
      "import.itemExists",
      "import.itemExists",
    ]);
  });

  it("adds nothing if any row fails in the database", async () => {
    const before = (await listItems(db, {})).total;
    const check = checkImport(
      `Name,Unit,SKU\nNew Pen,pcs,PEN-1\nAnother Pen,pcs,PEN-2`,
      await importContext(db),
    );
    // Simulate something changing between check and import: the second SKU gets taken.
    await db.insert(schema.items).values({
      name: "Sneaky",
      sku: "PEN-2",
      unitId: check.rows[0].unitId,
      createdBy: ownerId,
    });
    await expect(importItems(db, check.rows, ownerId, "x")).rejects.toThrow();
    expect((await listItems(db, {})).total).toBe(before + 1); // only "Sneaky"
  });
});
