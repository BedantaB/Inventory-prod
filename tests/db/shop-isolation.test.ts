import type { PGlite, Transaction } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "@/features/customers/data";
import { getDashboard } from "@/features/dashboard/data";
import { createStockEntry, StockEntryProblem } from "@/features/inventory/data";
import {
  getItem,
  listItems,
  listUnits,
  photoBelongsToShop,
  setItemArchived,
  updateItem,
} from "@/features/items/data";
import {
  addDraftLine,
  checkoutDraft,
  createDraft,
  getDraft,
  getOrder,
  listOrders,
  setDraftCustomer,
} from "@/features/orders/data";
import {
  createItem,
  createShop,
  createTestDb,
  createUser,
  expectPgError,
  stockIn,
  type TestDb,
} from "./test-db";

/**
 * Shops are completely separate businesses. Every query takes the shop of the logged-in user;
 * these tests check that shop B can never read or change shop A's data, and that the database
 * itself rejects rows that mix two shops.
 */

let client: PGlite;
let db: TestDb;
let shopA: string;
let shopB: string;
let ownerA: string;
let ownerB: string;
let itemA: string;
let customerA: string;
let orderA: string;

const customer = (businessName: string) => ({
  businessName,
  contactPerson: null,
  phone: "+919436012345",
  email: null,
  address: null,
  city: null,
  notes: null,
});

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  shopA = (await createShop(db, "Shop A")).id;
  shopB = (await createShop(db, "Shop B")).id;
  ownerA = (await createUser(db, { username: "owner-a", role: "ADMIN", shopId: shopA })).id;
  ownerB = (await createUser(db, { username: "owner-b", role: "ADMIN", shopId: shopB })).id;

  itemA = (await createItem(db, ownerA, { name: "Gel Pen", sku: "PEN-1" })).id;
  await db
    .update(schema.items)
    .set({ sellingPricePaise: 1_000, photoPath: "items/a.jpg" })
    .where(eq(schema.items.id, itemA));
  await stockIn(db, ownerA, itemA, 10_000, 600);
  customerA = (await createCustomer(db, shopA, customer("Sarkar Book Stall"), ownerA)).id;

  const { id } = await createDraft(db, shopA, ownerA, customerA);
  await addDraftLine(db, shopA, id, itemA, ownerA, true);
  const done = await checkoutDraft(db, shopA, id, ownerA, new Date("2026-10-30T06:00:00Z"));
  if (done.status !== "completed") throw new Error(done.status);
  orderA = id;
});

describe("another shop's data is invisible", () => {
  it("items, units and photos", async () => {
    expect(await getItem(db, shopB, itemA)).toBeNull();
    expect((await listItems(db, shopB, {})).total).toBe(0);
    expect((await listItems(db, shopA, {})).total).toBe(1);
    // Each shop has its own units (same names, different rows).
    const unitsA = (await listUnits(db, shopA)).map((u) => u.id);
    const unitsB = (await listUnits(db, shopB)).map((u) => u.id);
    expect(unitsB.length).toBeGreaterThan(0);
    expect(unitsA.filter((id) => unitsB.includes(id))).toEqual([]);
    expect(await photoBelongsToShop(db, shopA, "items/a.thumb.jpg")).toBe(true);
    expect(await photoBelongsToShop(db, shopB, "items/a.jpg")).toBe(false);
  });

  it("customers", async () => {
    expect(await getCustomer(db, shopB, customerA)).toBeNull();
    expect((await listCustomers(db, shopB, {})).total).toBe(0);
  });

  it("orders and the dashboard", async () => {
    expect(await getOrder(db, shopB, orderA, true)).toBeNull();
    expect(await getDraft(db, shopB, orderA, true)).toBeNull();
    expect((await listOrders(db, shopB, {})).total).toBe(0);
    const now = new Date("2026-10-30T08:00:00Z");
    expect((await getDashboard(db, shopA, { now, showCost: true })).today.orders).toBe(1);
    const dashB = await getDashboard(db, shopB, { now, showCost: true });
    expect(dashB.today).toEqual({ orders: 0, salesPaise: 0 });
  });
});

describe("another shop's data can't be changed", () => {
  it("items and customers", async () => {
    expect(await setItemArchived(db, shopB, itemA, true)).toBeNull();
    const [unitB] = await listUnits(db, shopB);
    const edit = {
      name: "Hacked",
      variant: null,
      sku: "X",
      categoryId: null,
      brandId: null,
      unitId: unitB.id,
      packSize: null,
      lowStockMilli: 0,
    };
    expect(await updateItem(db, shopB, itemA, edit)).toBeNull();
    expect(await updateCustomer(db, shopB, customerA, customer("Hacked"))).toBeNull();
    expect((await getItem(db, shopA, itemA))?.name).toBe("Gel Pen");
    expect((await getCustomer(db, shopA, customerA))?.businessName).toBe("Sarkar Book Stall");
  });

  it("stock: an item of another shop can't be stocked", async () => {
    await expect(
      createStockEntry(
        db,
        shopB,
        {
          reference: null,
          note: null,
          lines: [{ itemId: itemA, qtyMilli: 1_000, unitCostPaise: 1 }],
        },
        ownerB,
      ),
    ).rejects.toBeInstanceOf(StockEntryProblem);
  });

  it("cart: another shop's item, customer or draft can't be used", async () => {
    const { id: draftB } = await createDraft(db, shopB, ownerB);
    expect((await addDraftLine(db, shopB, draftB, itemA, ownerB, true)).status).toBe(
      "item-unavailable",
    );
    expect((await addDraftLine(db, shopA, draftB, itemA, ownerA, true)).status).toBe("not-found");
    expect(await setDraftCustomer(db, shopB, draftB, customerA)).toBe("not-found");
    expect(await checkoutDraft(db, shopA, draftB, ownerA, new Date())).toEqual({
      status: "not-found",
    });
  });
});

describe("the database rejects rows that mix shops", () => {
  it("an order line or stock movement pointing at another shop's item", async () => {
    const { id: draftB } = await createDraft(db, shopB, ownerB);
    await expectPgError(
      db.insert(schema.orderLines).values({
        shopId: shopB,
        orderId: draftB,
        itemId: itemA,
        quantity: "1",
        unitPricePaise: 1,
        createdBy: ownerB,
      }),
      "23503",
    );
    const [entryB] = await db
      .insert(schema.stockEntries)
      .values({ shopId: shopB, createdBy: ownerB })
      .returning();
    await expectPgError(
      db.insert(schema.stockMovements).values({
        shopId: shopB,
        type: "IN",
        itemId: itemA,
        quantityChange: "1",
        unitCostPaise: 1,
        stockEntryId: entryB.id,
        createdBy: ownerB,
      }),
      "23503",
    );
  });

  it("an item moved to another shop", async () => {
    await expect(
      db.update(schema.items).set({ shopId: shopB }).where(eq(schema.items.id, itemA)),
    ).rejects.toThrow();
  });
});

describe("per-shop names and numbers", () => {
  it("lets two shops use the same SKU and customer name", async () => {
    await createItem(db, ownerB, { name: "Gel Pen", sku: "PEN-1" });
    await createCustomer(db, shopB, customer("Sarkar Book Stall"), ownerB);
    // ...but not twice within one shop.
    await expectPgError(createItem(db, ownerA, { name: "Other", sku: "PEN-1" }), "23505");
  });

  it("starts each shop's order numbers at 00001", async () => {
    const itemB = (await createItem(db, ownerB, { name: "Notebook" })).id;
    await stockIn(db, ownerB, itemB, 5_000, 100);
    const customerB = await createCustomer(db, shopB, customer("Sharma Kirana"), ownerB);
    const { id } = await createDraft(db, shopB, ownerB, customerB.id);
    await db
      .update(schema.items)
      .set({ sellingPricePaise: 5_000 })
      .where(eq(schema.items.id, itemB));
    await addDraftLine(db, shopB, id, itemB, ownerB, true);
    expect(
      await checkoutDraft(db, shopB, id, ownerB, new Date("2026-10-30T06:00:00Z")),
    ).toMatchObject({
      status: "completed",
      orderNumber: "ORD-2026-27-00001",
    });
    expect((await getOrder(db, shopA, orderA, false))?.orderNumber).toBe("ORD-2026-27-00001");
  });

  it("keeps usernames unique across all shops (they are the login)", async () => {
    await expectPgError(createUser(db, { username: "OWNER-A", shopId: shopB }), "23505");
  });
});

/** Runs `fn` as a logged-in Supabase API caller, then rolls back. */
async function asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let result: T;
  await client.transaction(async (tx) => {
    await tx.query(`SET LOCAL ROLE authenticated`);
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    result = await fn(tx);
    await tx.rollback();
  });
  return result!;
}

const names = (tx: Transaction, query: string) =>
  tx.query<{ name: string }>(query).then((r) => r.rows.map((row) => row.name));

describe("row level security per shop", () => {
  it("shows each login only its own shop", async () => {
    expect(await asUser(ownerA, (tx) => names(tx, "SELECT name FROM shops"))).toEqual(["Shop A"]);
    expect(
      await asUser(ownerB, (tx) => names(tx, "SELECT name FROM items WHERE sku = 'PEN-1'")),
    ).toHaveLength(1);
    const visibleShops = await asUser(ownerB, (tx) =>
      tx.query<{ n: number }>(`SELECT count(DISTINCT shop_id)::int AS n FROM items`),
    );
    expect(visibleShops.rows).toEqual([{ n: 1 }]);
    expect(
      await asUser(ownerB, (tx) =>
        tx.query(`SELECT * FROM orders WHERE id = $1`, [orderA]).then((r) => r.rows),
      ),
    ).toEqual([]);
  });

  it("shows the platform admin no shop data", async () => {
    const admin = (await createUser(db, { username: "platform", platformAdmin: true })).id;
    expect(await asUser(admin, (tx) => names(tx, "SELECT name FROM items"))).toEqual([]);
    expect(await asUser(admin, (tx) => names(tx, "SELECT name FROM shops"))).toEqual([]);
  });

  it("shows nothing once the shop is turned off", async () => {
    await db.update(schema.shops).set({ isActive: false }).where(eq(schema.shops.id, shopB));
    try {
      expect(await asUser(ownerB, (tx) => names(tx, "SELECT name FROM items"))).toEqual([]);
    } finally {
      await db.update(schema.shops).set({ isActive: true }).where(eq(schema.shops.id, shopB));
    }
  });

  it("does not let API callers create default units for a shop", async () => {
    await expect(
      asUser(ownerA, (tx) => tx.query(`SELECT public.create_default_units($1)`, [shopA])),
    ).rejects.toThrow(/permission denied/);
  });
});
