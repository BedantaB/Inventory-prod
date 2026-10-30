import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  addDraftLine,
  checkoutDraft,
  createDraft,
  discardDraft,
  getDraft,
  getOrder,
  listDrafts,
  listOrders,
  removeDraftLine,
  searchCustomers,
  setDraftCustomer,
  setDraftDiscount,
  updateDraftLine,
} from "@/features/orders/data";
import { createCustomer } from "@/features/customers/data";
import { getItem, setItemArchived } from "@/features/items/data";
import { DB_ERROR } from "@/db/errors";
import {
  createItem,
  createTestDb,
  createUser,
  defaultShopId,
  expectPgError,
  stockIn,
  type TestDb,
} from "./test-db";

let db: TestDb;
let shopId: string;
let ownerId: string;
let customerId: string;
let pen: string; // 100 pcs @ ₹6 cost
let paper: string; // 10 kg @ ₹40 cost

beforeAll(async () => {
  ({ db } = await createTestDb());
  shopId = await defaultShopId(db);
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  customerId = (
    await createCustomer(
      db,
      shopId,
      {
        businessName: "Sarkar Book Stall",
        contactPerson: null,
        phone: "+919436012345",
        email: null,
        address: null,
        city: "Agartala",
        notes: null,
      },
      ownerId,
    )
  ).id;
  pen = (await createItem(db, ownerId, { name: "Gel Pen" })).id;
  await db.update(schema.items).set({ sellingPricePaise: 1_000 }).where(eq(schema.items.id, pen));
  await stockIn(db, ownerId, pen, 100_000, 600);
  paper = (await createItem(db, ownerId, { name: "Chart Paper", unit: "kg" })).id;
  await stockIn(db, ownerId, paper, 10_000, 4_000);
});

async function cartWith(lines: [string, number, number | null][]) {
  const { id } = await createDraft(db, shopId, ownerId, customerId);
  for (const [itemId, qtyMilli, price] of lines) {
    const added = await addDraftLine(db, shopId, id, itemId, ownerId, true);
    if (added.status !== "ok") throw new Error(added.status);
    await updateDraftLine(db, shopId, id, added.line.id, { qtyMilli, unitPricePaise: price });
  }
  return id;
}

describe("the cart (draft order)", () => {
  it("adds items at their usual price, merging repeats into one line", async () => {
    const { id } = await createDraft(db, shopId, ownerId);
    const first = await addDraftLine(db, shopId, id, pen, ownerId, true);
    const again = await addDraftLine(db, shopId, id, pen, ownerId, true);
    expect(first.status === "ok" && first.line).toMatchObject({
      label: "Gel Pen",
      qtyMilli: 1_000,
      unitPricePaise: 1_000,
    });
    expect(again.status === "ok" && again.merged).toBe(true);

    const draft = await getDraft(db, shopId, id, true);
    expect(draft?.lines).toHaveLength(1);
    expect(draft?.lines[0]).toMatchObject({
      qtyMilli: 2_000,
      stockMilli: 100_000,
      avgCostPaise: 600,
    });
    expect((await getDraft(db, shopId, id, false))?.lines[0].avgCostPaise).toBeNull(); // staff don't see cost
  });

  it("keeps customer, discount, quantities and prices", async () => {
    const { id } = await createDraft(db, shopId, ownerId);
    await setDraftCustomer(db, shopId, id, customerId);
    await setDraftDiscount(db, shopId, id, "PERCENT", 500);
    const added = await addDraftLine(db, shopId, id, paper, ownerId, true);
    if (added.status !== "ok") throw new Error();
    expect(
      await updateDraftLine(db, shopId, id, added.line.id, {
        qtyMilli: 2_500,
        unitPricePaise: null,
      }),
    ).toBe("ok");

    const draft = await getDraft(db, shopId, id, true);
    expect(draft).toMatchObject({
      customer: { businessName: "Sarkar Book Stall" },
      discountKind: "PERCENT",
      discountValue: 500,
    });
    expect(draft?.lines[0]).toMatchObject({ qtyMilli: 2_500, unitPricePaise: null });
  });

  it("refuses decimals for whole-number units and archived items", async () => {
    const { id } = await createDraft(db, shopId, ownerId);
    const added = await addDraftLine(db, shopId, id, pen, ownerId, true);
    if (added.status !== "ok") throw new Error();
    expect(
      await updateDraftLine(db, shopId, id, added.line.id, {
        qtyMilli: 1_500,
        unitPricePaise: 1_000,
      }),
    ).toBe("decimal-not-allowed");
    const old = (await createItem(db, ownerId, { name: "Old stock" })).id;
    await setItemArchived(db, shopId, old, true);
    expect((await addDraftLine(db, shopId, id, old, ownerId, true)).status).toBe(
      "item-unavailable",
    );
  });

  it("removes lines and can be thrown away", async () => {
    const { id } = await createDraft(db, shopId, ownerId);
    const added = await addDraftLine(db, shopId, id, pen, ownerId, true);
    if (added.status !== "ok") throw new Error();
    await removeDraftLine(db, shopId, id, added.line.id);
    expect((await getDraft(db, shopId, id, true))?.lines).toEqual([]);
    expect((await listDrafts(db, shopId)).some((d) => d.id === id)).toBe(true);
    expect(await discardDraft(db, shopId, id)).toBe(true);
    expect(await getDraft(db, shopId, id, true)).toBeNull();
  });
});

describe("checkout", () => {
  it("completes the order, lowers stock, records cost and numbers it for the financial year", async () => {
    const id = await cartWith([
      [pen, 10_000, 1_000], // 10 × ₹10
      [paper, 2_500, 5_000], // 2.5 kg × ₹50
    ]);
    await setDraftDiscount(db, shopId, id, "AMOUNT", 2_500); // ₹25 off

    const result = await checkoutDraft(
      db,
      shopId,
      id,
      ownerId,
      new Date("2026-10-28T10:00:00+05:30"),
    );
    expect(result).toEqual({ status: "completed", id, orderNumber: "ORD-2026-27-00001" });

    expect((await getItem(db, shopId, pen))?.stockMilli).toBe(90_000);
    expect((await getItem(db, shopId, paper))?.stockMilli).toBe(7_500);

    const order = await getOrder(db, shopId, id, true);
    expect(order).toMatchObject({
      orderNumber: "ORD-2026-27-00001",
      subtotalPaise: 22_500,
      discountPaise: 2_500,
      totalPaise: 20_000,
      customerName: "Sarkar Book Stall",
    });
    expect(
      order?.lines.map((l) => [l.label, l.qtyMilli, l.lineTotalPaise, l.unitCostPaise]),
    ).toEqual([
      ["Gel Pen", 10_000, 10_000, 600],
      ["Chart Paper", 2_500, 12_500, 4_000],
    ]);
    expect((await getOrder(db, shopId, id, false))?.lines[0].unitCostPaise).toBeNull();
  });

  it("can't complete the same order twice (double tap)", async () => {
    const id = await cartWith([[pen, 1_000, 1_000]]);
    const first = await checkoutDraft(db, shopId, id, ownerId);
    const second = await checkoutDraft(db, shopId, id, ownerId);
    expect(first.status).toBe("completed");
    expect(second).toEqual({
      status: "already-completed",
      id,
      orderNumber: (first as { orderNumber: string }).orderNumber,
    });
    expect((await getItem(db, shopId, pen))?.stockMilli).toBe(89_000);
  });

  it("numbers orders one after another, restarting each financial year", async () => {
    const a = await checkoutDraft(
      db,
      shopId,
      await cartWith([[pen, 1_000, 1_000]]),
      ownerId,
      new Date("2027-03-31T12:00:00+05:30"),
    );
    const b = await checkoutDraft(
      db,
      shopId,
      await cartWith([[pen, 1_000, 1_000]]),
      ownerId,
      new Date("2027-04-01T09:00:00+05:30"),
    );
    expect(a).toMatchObject({ orderNumber: "ORD-2026-27-00003" });
    expect(b).toMatchObject({ orderNumber: "ORD-2027-28-00001" });
  });

  it("rejects the whole order if anything is short, lists every short item, and changes nothing", async () => {
    const before = {
      pen: (await getItem(db, shopId, pen))!.stockMilli,
      paper: (await getItem(db, shopId, paper))!.stockMilli,
    };
    const id = await cartWith([
      [pen, 500_000, 1_000],
      [paper, 50_000, 5_000],
    ]);
    const result = await checkoutDraft(db, shopId, id, ownerId);
    expect(result).toEqual({
      status: "short",
      shortages: [
        expect.objectContaining({
          label: "Gel Pen",
          wantedMilli: 500_000,
          availableMilli: before.pen,
          unitName: "pcs",
        }),
        expect.objectContaining({
          label: "Chart Paper",
          wantedMilli: 50_000,
          availableMilli: before.paper,
          unitName: "kg",
        }),
      ],
    });
    expect((await getItem(db, shopId, pen))?.stockMilli).toBe(before.pen);
    expect((await getDraft(db, shopId, id, true))?.lines).toHaveLength(2); // still a draft, still editable
  });

  it("explains what's missing before looking at stock", async () => {
    const { id } = await createDraft(db, shopId, ownerId);
    expect(await checkoutDraft(db, shopId, id, ownerId)).toEqual({
      status: "problems",
      problems: [{ key: "orders.chooseCustomer" }, { key: "orders.emptyCart" }],
    });
    const priced = await cartWith([[paper, 1_000, null]]);
    const result = await checkoutDraft(db, shopId, priced, ownerId);
    expect(result.status === "problems" && result.problems.map((p) => p.key)).toEqual([
      "orders.missingPrice",
    ]);
  });

  it("protects completed orders from changes", async () => {
    const id = await cartWith([[pen, 1_000, 1_000]]);
    await checkoutDraft(db, shopId, id, ownerId);
    expect(await discardDraft(db, shopId, id)).toBe(false);
    expect(await setDraftCustomer(db, shopId, id, null)).toBe("not-found");
    await expectPgError(
      db.delete(schema.orders).where(eq(schema.orders.id, id)),
      DB_ERROR.orderCompleted,
    );
  });
});

describe("orders list", () => {
  it("searches by order number or customer and filters by date", async () => {
    const all = await listOrders(db, shopId, {});
    expect(all.total).toBeGreaterThanOrEqual(5);
    expect(all.rows[0].completedAt.getTime()).toBeGreaterThanOrEqual(
      all.rows[1].completedAt.getTime(),
    );

    expect(
      (await listOrders(db, shopId, { q: "ORD-2026-27-00001" })).rows.map((r) => r.orderNumber),
    ).toEqual(["ORD-2026-27-00001"]);
    expect((await listOrders(db, shopId, { q: "sarkar" })).total).toBe(all.total);
    const april = await listOrders(db, shopId, {
      from: new Date("2027-04-01T00:00:00+05:30"),
      to: new Date("2027-04-02T00:00:00+05:30"),
    });
    expect(april.rows.map((r) => r.orderNumber)).toEqual(["ORD-2027-28-00001"]);
  });

  it("finds customers for the order picker", async () => {
    expect((await searchCustomers(db, shopId, "94360")).map((c) => c.businessName)).toEqual([
      "Sarkar Book Stall",
    ]);
  });
});
