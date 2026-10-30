import { beforeAll, describe, expect, it } from "vitest";
import { seedBusinessData } from "@/db/seed/business-data";
import { seedItems } from "@/db/seed/data";
import {
  createItem,
  findOrCreateBrand,
  findOrCreateCategory,
  itemDisplayName,
  listBrands,
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
import { createTestDb, createUser, defaultShopId, getUnit, type TestDb } from "./test-db";

let db: TestDb;
let shopId: string;
let ownerId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  shopId = await defaultShopId(db);
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  const ramesh = (await createUser(db, { username: "ramesh" })).id;
  const sunita = (await createUser(db, { username: "sunita" })).id;
  await seedBusinessData(db, shopId, { owner: ownerId, ramesh, sunita });
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
    const first = await listItems(db, shopId, {});
    expect(first.total).toBe(seedItems.length);
    expect(first.rows).toHaveLength(PAGE_SIZE);
    const names = first.rows.map((r) => r.name.toLowerCase());
    expect(names).toEqual([...names].sort());

    const last = await listItems(db, shopId, { page: Math.ceil(seedItems.length / PAGE_SIZE) });
    expect(last.rows.length).toBe(seedItems.length % PAGE_SIZE || PAGE_SIZE);
  });

  it("finds items by any word of the name, SKU, colour, pack size or brand", async () => {
    const skus = async (q: string) =>
      (await listItems(db, shopId, { q })).rows.map((r) => r.sku).sort();
    expect(await skus("marker blue")).toEqual([
      "DOMS-001-BLU",
      "DOMS-002-BLU",
      "DOMS-003-BLU",
      "DOMS-004-BLU",
    ]);
    expect(await skus("glue 45")).toEqual(["DOMS-006"]);
    expect(await skus("oil pastels 25 shades")).toEqual(["DOMS-036", "DOMS-037"]);
    expect(await skus("doms-096-gld")).toEqual(["DOMS-096-GLD"]);
    expect((await listItems(db, shopId, { q: "doms" })).total).toBe(seedItems.length);
    expect((await listItems(db, shopId, { q: "zzz" })).total).toBe(0);
  });

  it("lists colours of the same item together", async () => {
    const { rows } = await listItems(db, shopId, { q: "permanent marker" });
    expect(rows.map(itemDisplayName)).toEqual([
      "Permanent Marker – Black",
      "Permanent Marker – Blue",
      "Permanent Marker – Red",
    ]);
    expect(rows[0]).toMatchObject({ brandName: "DOMS", mrpPaise: 2000, sellingPricePaise: 1700 });
  });

  it("filters by stock level", async () => {
    const out = await listItems(db, shopId, { stock: "out" });
    expect(out.rows.map((r) => r.sku).sort()).toEqual([
      "DOMS-022",
      "DOMS-062",
      "DOMS-110",
      "DOMS-129",
    ]);
    expect(out.rows.every((r) => r.status === "out")).toBe(true);

    const low = await listItems(db, shopId, { stock: "low" });
    expect(low.rows.map((r) => r.sku).sort()).toEqual([
      "DOMS-009",
      "DOMS-027",
      "DOMS-054",
      "DOMS-073",
      "DOMS-125",
    ]);
    expect(low.rows.every((r) => r.status === "low")).toBe(true);

    const inStock = await listItems(db, shopId, { stock: "in" });
    expect(inStock.total + low.total + out.total).toBe(seedItems.length);
  });

  it("filters by brand", async () => {
    const [doms] = await listBrands(db, shopId);
    expect((await listItems(db, shopId, { brandId: doms.id })).total).toBe(seedItems.length);
  });

  it("filters by category and sorts by stock", async () => {
    const [markers] = (await listCategories(db, shopId)).filter((c) => c.name === "Markers & Ink");
    const result = await listItems(db, shopId, { categoryId: markers.id, sort: "stock-asc" });
    expect(result.total).toBe(11);
    const stocks = result.rows.map((r) => r.stockMilli);
    expect(stocks).toEqual([...stocks].sort((a, b) => a - b));
  });

  it("hides archived items unless asked", async () => {
    const [compass] = (await listItems(db, shopId, { q: "compass" })).rows;
    await setItemArchived(db, shopId, compass.id, true);
    expect((await listItems(db, shopId, { q: "compass" })).total).toBe(0);
    expect((await listItems(db, shopId, { q: "compass", archived: true })).total).toBe(1);
    await setItemArchived(db, shopId, compass.id, false);
    expect((await listItems(db, shopId, { q: "compass" })).total).toBe(1);
  });
});

describe("create and update", () => {
  it("creates an item with an automatic SKU and reads it back", async () => {
    const kg = await getUnit(db, "kg");
    const camlin = await findOrCreateBrand(db, shopId, "Camlin", ownerId);
    const created = await createItem(
      db,
      shopId,
      {
        name: "Drawing Paper (loose)",
        variant: "Ivory",
        sku: "",
        categoryId: null,
        brandId: camlin.id,
        unitId: kg.id,
        packSize: null,
        mrpPaise: 12_000,
        sellingPricePaise: 10_000,
        lowStockMilli: 2_500,
        photoPath: null,
      },
      ownerId,
    );
    expect(created.sku).toMatch(/^ITM-\d{5}$/);

    const item = await getItem(db, shopId, created.id);
    expect(item).toMatchObject({
      name: "Drawing Paper (loose)",
      variant: "Ivory",
      brandName: "Camlin",
      mrpPaise: 12_000,
      unitName: "kg",
      unitAllowsDecimal: true,
      stockMilli: 0,
      lowStockMilli: 2_500,
      status: "out",
      categoryName: null,
    });
  });

  it("never stores a selling price above the MRP", async () => {
    const [glue] = (await listItems(db, shopId, { q: "glue 105" })).rows;
    await expect(
      updateItem(db, shopId, glue.id, {
        ...glue,
        lowStockMilli: glue.lowStockMilli,
        sellingPricePaise: 5_000,
      }),
    ).rejects.toThrow();
  });

  it("leaves prices alone when they aren't part of the update", async () => {
    const [kit] = (await listItems(db, shopId, { q: "unicorn" })).rows;
    await updateItem(db, shopId, kit.id, {
      name: "Unicorn Art Kit (New)",
      variant: kit.variant,
      sku: kit.sku,
      categoryId: kit.categoryId,
      brandId: kit.brandId,
      unitId: kit.unitId,
      packSize: kit.packSize,
      lowStockMilli: kit.lowStockMilli,
    });
    const after = await getItem(db, shopId, kit.id);
    expect(after?.name).toBe("Unicorn Art Kit (New)");
    expect(after?.sellingPricePaise).toBe(kit.sellingPricePaise);
    expect(after?.mrpPaise).toBe(kit.mrpPaise);
  });
});

describe("categories", () => {
  it("reuses an existing category whatever the capitalisation", async () => {
    const created = await findOrCreateCategory(db, shopId, "Files & Folders", ownerId);
    expect(created.existed).toBe(false);
    const again = await findOrCreateCategory(db, shopId, "files & folders", ownerId);
    expect(again).toEqual({ id: created.id, name: "Files & Folders", existed: true });
    const brand = await findOrCreateBrand(db, shopId, "doms", ownerId);
    expect(brand).toMatchObject({ name: "DOMS", existed: true });
  });
});

describe("units", () => {
  it("counts the items using each unit", async () => {
    const all = await listUnits(db, shopId);
    const box = all.find((u) => u.name === "box");
    expect(box?.itemCount).toBeGreaterThan(5);
  });

  it("only allows switching decimals while no item uses the unit", async () => {
    const kg = await getUnit(db, "kg");
    expect(
      await updateUnit(db, shopId, kg.id, { name: "kg", label: "Kilo", allowsDecimal: false }),
    ).toBe("decimal-locked");
    expect(
      await updateUnit(db, shopId, kg.id, { name: "kg", label: "Kilo", allowsDecimal: true }),
    ).toBe("ok");
    expect((await getUnit(db, "kg")).label).toBe("Kilo");
  });
});
