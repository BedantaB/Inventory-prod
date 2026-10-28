import { beforeAll, describe, expect, it } from "vitest";
import { seedBusinessData } from "@/db/seed/business-data";
import { seedItems } from "@/db/seed/data";
import {
  createItem,
  findOrCreateCategory,
  getItem,
  listCategories,
  listItems,
  listUnits,
  setItemArchived,
  stockStatus,
  updateItem,
  updateUnit,
} from "@/features/items/data";
import { PAGE_SIZE } from "@/lib/list-params";
import { createTestDb, createUser, getUnit, type TestDb } from "./test-db";

let db: TestDb;
let ownerId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  const ramesh = (await createUser(db, { username: "ramesh" })).id;
  const sunita = (await createUser(db, { username: "sunita" })).id;
  await seedBusinessData(db, { owner: ownerId, ramesh, sunita });
});

describe("stockStatus", () => {
  it("classifies stock against the warning level", () => {
    expect(stockStatus(0, 5000)).toBe("out");
    expect(stockStatus(5000, 5000)).toBe("low");
    expect(stockStatus(5001, 5000)).toBe("in");
    expect(stockStatus(1, 0)).toBe("in");
  });
});

describe("listItems", () => {
  it("pages through all active items, sorted by name", async () => {
    const first = await listItems(db, {});
    expect(first.total).toBe(seedItems.length);
    expect(first.rows).toHaveLength(PAGE_SIZE);
    const names = first.rows.map((r) => r.name.toLowerCase());
    expect(names).toEqual([...names].sort());

    const last = await listItems(db, { page: Math.ceil(seedItems.length / PAGE_SIZE) });
    expect(last.rows.length).toBe(seedItems.length % PAGE_SIZE || PAGE_SIZE);
  });

  it("finds items by any word of the name or SKU, in any order", async () => {
    expect((await listItems(db, { q: "dal toor" })).rows.map((r) => r.sku)).toEqual(["DAL-TOOR"]);
    expect((await listItems(db, { q: "rice-bas" })).rows.map((r) => r.sku)).toEqual([
      "RICE-BAS-25",
    ]);
    expect((await listItems(db, { q: "BASMATI" })).total).toBe(1);
    expect((await listItems(db, { q: "zzz" })).total).toBe(0);
  });

  it("filters by stock level", async () => {
    const out = await listItems(db, { stock: "out" });
    expect(out.rows.map((r) => r.sku).sort()).toEqual(["ELAICHI", "GARBAGE-BDL"]);
    expect(out.rows.every((r) => r.status === "out")).toBe(true);

    const low = await listItems(db, { stock: "low" });
    expect(low.rows.map((r) => r.sku)).toContain("FOIL-9M"); // 5 left, warn at 12
    expect(low.rows.every((r) => r.status === "low")).toBe(true);

    const inStock = await listItems(db, { stock: "in" });
    expect(inStock.total + low.total + out.total).toBe(seedItems.length);
  });

  it("filters by category and sorts by stock", async () => {
    const [dal] = (await listCategories(db)).filter((c) => c.name === "Dal & Pulses");
    const result = await listItems(db, { categoryId: dal.id, sort: "stock-asc" });
    expect(result.total).toBe(7);
    const stocks = result.rows.map((r) => r.stockMilli);
    expect(stocks).toEqual([...stocks].sort((a, b) => a - b));
  });

  it("hides archived items unless asked", async () => {
    const [jhadu] = (await listItems(db, { q: "jhadu" })).rows;
    await setItemArchived(db, jhadu.id, true);
    expect((await listItems(db, { q: "jhadu" })).total).toBe(0);
    expect((await listItems(db, { q: "jhadu", archived: true })).total).toBe(1);
    await setItemArchived(db, jhadu.id, false);
    expect((await listItems(db, { q: "jhadu" })).total).toBe(1);
  });
});

describe("create and update", () => {
  it("creates an item with an automatic SKU and reads it back", async () => {
    const kg = await getUnit(db, "kg");
    const created = await createItem(
      db,
      {
        name: "Badam (Almonds)",
        sku: "",
        categoryId: null,
        unitId: kg.id,
        packSize: null,
        sellingPricePaise: 90_000,
        lowStockMilli: 2_500,
        photoPath: null,
      },
      ownerId,
    );
    expect(created.sku).toMatch(/^ITM-\d{5}$/);

    const item = await getItem(db, created.id);
    expect(item).toMatchObject({
      name: "Badam (Almonds)",
      unitName: "kg",
      unitAllowsDecimal: true,
      stockMilli: 0,
      lowStockMilli: 2_500,
      status: "out",
      categoryName: null,
    });
  });

  it("leaves the price alone when it isn't part of the update", async () => {
    const [ghee] = (await listItems(db, { q: "ghee" })).rows;
    await updateItem(db, ghee.id, {
      name: "Desi Ghee 1 L (Tin)",
      sku: ghee.sku,
      categoryId: ghee.categoryId,
      unitId: ghee.unitId,
      packSize: ghee.packSize,
      lowStockMilli: ghee.lowStockMilli,
    });
    const after = await getItem(db, ghee.id);
    expect(after?.name).toBe("Desi Ghee 1 L (Tin)");
    expect(after?.sellingPricePaise).toBe(ghee.sellingPricePaise);
  });
});

describe("categories", () => {
  it("reuses an existing category whatever the capitalisation", async () => {
    const created = await findOrCreateCategory(db, "Dry Fruits", ownerId);
    expect(created.existed).toBe(false);
    const again = await findOrCreateCategory(db, "dry fruits", ownerId);
    expect(again).toEqual({ id: created.id, name: "Dry Fruits", existed: true });
  });
});

describe("units", () => {
  it("counts the items using each unit", async () => {
    const all = await listUnits(db);
    const kg = all.find((u) => u.name === "kg");
    expect(kg?.itemCount).toBeGreaterThan(5);
  });

  it("only allows switching decimals while no item uses the unit", async () => {
    const kg = await getUnit(db, "kg");
    expect(await updateUnit(db, kg.id, { name: "kg", label: "Kilo", allowsDecimal: false })).toBe(
      "decimal-locked",
    );
    expect(await updateUnit(db, kg.id, { name: "kg", label: "Kilo", allowsDecimal: true })).toBe(
      "ok",
    );
    expect((await getUnit(db, "kg")).label).toBe("Kilo");
  });
});
