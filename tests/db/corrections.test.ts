import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { DB_ERROR } from "@/db/errors";
import { createCustomer, listCustomerOrders, listCustomers } from "@/features/customers/data";
import { getDashboard } from "@/features/dashboard/data";
import { correctStock, listItemMovements } from "@/features/inventory/data";
import { setItemArchived } from "@/features/items/data";
import {
  addDraftLine,
  cancelOrder,
  checkoutDraft,
  createDraft,
  getOrder,
  listOrders,
  setOrderArchived,
  updateDraftLine,
} from "@/features/orders/data";
import {
  createItem,
  createShop,
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
let ownerId: string;
let customerId: string;

const SALE_TIME = new Date("2026-10-30T06:00:00Z"); // 11:30 in India
const NOW = new Date("2026-10-30T08:00:00Z");

beforeAll(async () => {
  ({ db } = await createTestDb());
  shopId = await defaultShopId(db);
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  customerId = (
    await createCustomer(
      db,
      shopId,
      {
        businessName: "Das Stationers",
        contactPerson: null,
        phone: "+919436023456",
        email: null,
        address: null,
        city: null,
        notes: null,
      },
      ownerId,
    )
  ).id;
});

async function newItem(name: string, qtyMilli: number, costPaise: number, unit = "pcs") {
  const item = await createItem(db, ownerId, { name, unit });
  await stockIn(db, ownerId, item.id, qtyMilli, costPaise);
  return item.id;
}

/** Sells `lines` through the real checkout and returns the order id. */
async function sell(lines: [string, number, number][], at = SALE_TIME) {
  const { id } = await createDraft(db, shopId, ownerId, customerId);
  for (const [itemId, qtyMilli, price] of lines) {
    const added = await addDraftLine(db, shopId, id, itemId, ownerId, true);
    if (added.status !== "ok") throw new Error(added.status);
    await updateDraftLine(db, shopId, id, added.line.id, { qtyMilli, unitPricePaise: price });
  }
  const done = await checkoutDraft(db, shopId, id, ownerId, at);
  if (done.status !== "completed") throw new Error(JSON.stringify(done));
  return id;
}

const stockOf = async (itemId: string) => {
  const item = await getItem(db, itemId);
  return { stock: item.currentStock, avg: item.avgCostPaise };
};

describe("correct stock", () => {
  it("sets the stock to the counted quantity; the average cost stays", async () => {
    const pen = await newItem("Correction Pen", 50_000, 600);
    const result = await correctStock(
      db,
      shopId,
      { itemId: pen, countedMilli: 47_000, reason: "DAMAGED", note: "Box got wet" },
      ownerId,
    );
    expect(result).toEqual({ status: "corrected", changeMilli: -3_000, stockAfterMilli: 47_000 });
    expect(await stockOf(pen)).toEqual({ stock: "47.000", avg: 600 });

    const [latest] = (await listItemMovements(db, shopId, pen)).rows;
    expect(latest).toMatchObject({
      type: "ADJUST",
      qtyMilli: -3_000,
      stockAfterMilli: 47_000,
      reason: "DAMAGED",
      note: "Box got wet",
      unitCostPaise: 600, // value of what was lost, at the average cost
    });
  });

  it("can also raise stock (found more than the app shows), and go to zero", async () => {
    const pen = await newItem("Found Pen", 10_000, 500);
    await correctStock(
      db,
      shopId,
      { itemId: pen, countedMilli: 12_000, reason: "COUNT", note: null },
      ownerId,
    );
    expect(await stockOf(pen)).toEqual({ stock: "12.000", avg: 500 });
    await correctStock(
      db,
      shopId,
      { itemId: pen, countedMilli: 0, reason: "LOST", note: null },
      ownerId,
    );
    expect(await stockOf(pen)).toEqual({ stock: "0.000", avg: 500 });
  });

  it("writes nothing when the count matches", async () => {
    const pen = await newItem("Exact Pen", 5_000, 500);
    const before = (await listItemMovements(db, shopId, pen)).total;
    expect(
      await correctStock(
        db,
        shopId,
        { itemId: pen, countedMilli: 5_000, reason: "COUNT", note: null },
        ownerId,
      ),
    ).toEqual({ status: "unchanged" });
    expect((await listItemMovements(db, shopId, pen)).total).toBe(before);
  });

  it("refuses decimals for whole-number units, archived items and other shops' items", async () => {
    const pen = await newItem("Whole Pen", 5_000, 500);
    expect(
      await correctStock(
        db,
        shopId,
        { itemId: pen, countedMilli: 4_500, reason: "COUNT", note: null },
        ownerId,
      ),
    ).toEqual({ status: "decimal-not-allowed" });

    const rice = await newItem("Loose Rice", 5_000, 4_000, "kg");
    expect(
      await correctStock(
        db,
        shopId,
        { itemId: rice, countedMilli: 4_750, reason: "COUNT", note: null },
        ownerId,
      ),
    ).toMatchObject({ status: "corrected" });

    await setItemArchived(db, shopId, pen, true);
    expect(
      await correctStock(
        db,
        shopId,
        { itemId: pen, countedMilli: 1_000, reason: "COUNT", note: null },
        ownerId,
      ),
    ).toEqual({ status: "archived" });

    const other = await createShop(db, "Other Shop");
    expect(
      await correctStock(
        db,
        other.id,
        { itemId: rice, countedMilli: 1_000, reason: "COUNT", note: null },
        ownerId,
      ),
    ).toEqual({ status: "not-found" });
  });

  it("the database requires a reason for corrections, and a note for 'Other'", async () => {
    const pen = await newItem("Rule Pen", 5_000, 500);
    const adjust = {
      shopId,
      type: "ADJUST" as const,
      itemId: pen,
      quantityChange: "-1",
      createdBy: ownerId,
    };
    await expectPgError(db.insert(schema.stockMovements).values(adjust), DB_ERROR.checkViolation);
    await expectPgError(
      db.insert(schema.stockMovements).values({ ...adjust, reason: "OTHER", note: "  " }),
      DB_ERROR.checkViolation,
    );
    await db
      .insert(schema.stockMovements)
      .values({ ...adjust, reason: "OTHER", note: "Given as sample" });
    expect((await stockOf(pen)).stock).toBe("4.000");
  });
});

describe("cancel order", () => {
  it("puts the stock back at the cost it was sold at, and keeps the order and its number", async () => {
    const pen = await newItem("Cancel Pen", 100_000, 600);
    const orderId = await sell([[pen, 10_000, 1_000]]);
    // A new bill at a higher cost arrives after the sale: 90 @ ₹6 + 10 @ ₹9 → ₹6.30 average.
    await stockIn(db, ownerId, pen, 10_000, 900);
    expect(await stockOf(pen)).toEqual({ stock: "100.000", avg: 630 });

    const result = await cancelOrder(
      db,
      shopId,
      orderId,
      "Customer returned the goods",
      ownerId,
      NOW,
    );
    const order = await getOrder(db, shopId, orderId, true);
    expect(result).toEqual({ status: "cancelled", orderNumber: order?.orderNumber });
    // 100 @ ₹6.30 + 10 back @ ₹6.00 → ₹6.2727… → ₹6.27
    expect(await stockOf(pen)).toEqual({ stock: "110.000", avg: 627 });
    expect(order).toMatchObject({
      status: "CANCELLED",
      cancelReason: "Customer returned the goods",
      cancelledByName: "owner",
      cancelledAt: NOW,
      totalPaise: 10_000,
    });

    const returned = (await listItemMovements(db, shopId, pen)).rows.find(
      (r) => r.type === "RETURN",
    );
    expect(returned).toMatchObject({
      type: "RETURN",
      qtyMilli: 10_000,
      unitCostPaise: 600,
      unitPricePaise: 1_000,
      orderNumber: order?.orderNumber,
    });
  });

  it("returns every line of a multi-line order", async () => {
    const a = await newItem("Multi A", 20_000, 100);
    const b = await newItem("Multi B", 20_000, 200);
    const orderId = await sell([
      [a, 5_000, 150],
      [b, 7_000, 300],
    ]);
    await cancelOrder(db, shopId, orderId, "Wrong order", ownerId);
    expect((await stockOf(a)).stock).toBe("20.000");
    expect((await stockOf(b)).stock).toBe("20.000");
  });

  it("can't cancel twice, a draft, or another shop's order", async () => {
    const pen = await newItem("Twice Pen", 10_000, 500);
    const orderId = await sell([[pen, 1_000, 800]]);
    await cancelOrder(db, shopId, orderId, "Mistake", ownerId);
    expect(await cancelOrder(db, shopId, orderId, "Again", ownerId)).toMatchObject({
      status: "already-cancelled",
    });
    expect((await stockOf(pen)).stock).toBe("10.000"); // returned once only

    const { id: draft } = await createDraft(db, shopId, ownerId);
    expect(await cancelOrder(db, shopId, draft, "x", ownerId)).toEqual({ status: "not-found" });

    const other = await createShop(db, "Another Shop");
    const sold = await sell([[pen, 1_000, 800]]);
    expect(await cancelOrder(db, other.id, sold, "x", ownerId)).toEqual({ status: "not-found" });
  });

  it("a cancelled order can't be changed, un-cancelled or deleted (but can be archived)", async () => {
    const pen = await newItem("Frozen Pen", 10_000, 500);
    const orderId = await sell([[pen, 1_000, 800]]);
    await cancelOrder(db, shopId, orderId, "Mistake", ownerId);
    const byId = eq(schema.orders.id, orderId);

    await expectPgError(
      db.update(schema.orders).set({ totalPaise: 1 }).where(byId),
      DB_ERROR.orderCompleted,
    );
    await expectPgError(
      db
        .update(schema.orders)
        .set({ status: "COMPLETED", cancelledAt: null, cancelledBy: null, cancelReason: null })
        .where(byId),
      DB_ERROR.orderCompleted,
    );
    await expectPgError(
      db.update(schema.orders).set({ cancelReason: "Changed" }).where(byId),
      DB_ERROR.orderCompleted,
    );
    await expectPgError(db.delete(schema.orders).where(byId), DB_ERROR.orderCompleted);
    await expectPgError(
      db
        .update(schema.orderLines)
        .set({ quantity: "5" })
        .where(eq(schema.orderLines.orderId, orderId)),
      DB_ERROR.orderCompleted,
    );
    expect(await setOrderArchived(db, shopId, orderId, true)).toMatchObject({ id: orderId });
  });

  it("the database only cancels with who, when and why, and only returns stock for cancelled orders", async () => {
    const pen = await newItem("Guard Pen", 10_000, 500);
    const orderId = await sell([[pen, 1_000, 800]]);
    await expectPgError(
      db.update(schema.orders).set({ status: "CANCELLED" }).where(eq(schema.orders.id, orderId)),
      DB_ERROR.checkViolation,
    );
    await expectPgError(
      db.insert(schema.stockMovements).values({
        shopId,
        type: "RETURN",
        itemId: pen,
        quantityChange: "1",
        unitCostPaise: 500,
        orderId,
        createdBy: ownerId,
      }),
      DB_ERROR.returnNeedsCancelledOrder,
    );
  });

  it("is left out of every sales total, and the next order still gets the next number", async () => {
    const shop = await createShop(db, "Sales Shop");
    const owner = (
      await createUser(db, { username: "sales-owner", role: "ADMIN", shopId: shop.id })
    ).id;
    const customer = await createCustomer(
      db,
      shop.id,
      {
        businessName: "Roy Stationery",
        contactPerson: null,
        phone: "+919774078901",
        email: null,
        address: null,
        city: null,
        notes: null,
      },
      owner,
    );
    const pen = (await createItem(db, owner, { name: "Sales Pen" })).id;
    await stockIn(db, owner, pen, 100_000, 500);
    const sellHere = async (qtyMilli: number) => {
      const { id } = await createDraft(db, shop.id, owner, customer.id);
      const added = await addDraftLine(db, shop.id, id, pen, owner, true);
      if (added.status !== "ok") throw new Error(added.status);
      await updateDraftLine(db, shop.id, id, added.line.id, { qtyMilli, unitPricePaise: 1_000 });
      return checkoutDraft(db, shop.id, id, owner, SALE_TIME);
    };

    const kept = await sellHere(2_000); // ₹20
    const wrong = await sellHere(3_000); // ₹30, cancelled below
    if (kept.status !== "completed" || wrong.status !== "completed") throw new Error("checkout");
    await cancelOrder(db, shop.id, wrong.id, "Wrong customer", owner);

    expect((await getDashboard(db, shop.id, { now: NOW, showCost: true })).today).toEqual({
      orders: 1,
      salesPaise: 2_000,
    });
    expect(await listOrders(db, shop.id, {})).toMatchObject({
      total: 2,
      completed: 1,
      cancelled: 1,
      totalPaise: 2_000,
    });
    expect((await listOrders(db, shop.id, { status: "cancelled" })).rows.map((r) => r.id)).toEqual([
      wrong.id,
    ]);
    expect(await listCustomerOrders(db, shop.id, customer.id)).toMatchObject({
      total: 2,
      completed: 1,
      totalPaise: 2_000,
    });
    expect((await listCustomers(db, shop.id, {})).rows[0].orderCount).toBe(1);

    const next = await sellHere(1_000);
    expect(next).toMatchObject({ status: "completed", orderNumber: "ORD-2026-27-00003" });
  });
});
