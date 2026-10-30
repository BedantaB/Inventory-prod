import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { DB_ERROR } from "@/db/errors";
import { createCustomer, listCustomers } from "@/features/customers/data";
import { getDashboard } from "@/features/dashboard/data";
import {
  addDraftLine,
  cancelOrder,
  checkoutDraft,
  createDraft,
  getDraft,
  getOrder,
  updateDraftLine,
} from "@/features/orders/data";
import {
  customerBalance,
  listCustomerPayments,
  recordPayment,
  voidPayment,
  type PaymentInput,
} from "@/features/payments/data";
import {
  createItem,
  createShop,
  createTestDb,
  createUser,
  expectPgError,
  getItem,
  stockIn,
  type TestDb,
} from "./test-db";

let client: PGlite;
let db: TestDb;
let shopId: string;
let ownerId: string;
let pen: string;

const SALE_TIME = new Date("2026-10-30T06:00:00Z"); // 11:30 in India
const NOW = new Date("2026-10-30T08:00:00Z");

const cash = (amountPaise: number, receivedAt = NOW): PaymentInput => ({
  amountPaise,
  method: "CASH",
  receivedAt,
  reference: null,
  note: null,
});

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  shopId = (await createShop(db, "Payments Shop")).id;
  ownerId = (await createUser(db, { username: "owner", role: "ADMIN", shopId })).id;
  pen = (await createItem(db, ownerId, { name: "Pay Pen" })).id;
  await stockIn(db, ownerId, pen, 1_000_000, 500);
});

async function newCustomer(name: string, shop = shopId, actor = ownerId) {
  const row = await createCustomer(
    db,
    shop,
    {
      businessName: name,
      contactPerson: null,
      phone: "+919436012345",
      email: null,
      address: null,
      city: null,
      notes: null,
    },
    actor,
  );
  return row.id;
}

/** A completed order of `qty` pens at ₹10 each (₹10 × qty), optionally with "Paid now". */
async function sell(
  customerId: string,
  qty: number,
  paidNow: { amountPaise: number } | null = null,
) {
  const { id } = await createDraft(db, shopId, ownerId, customerId);
  const added = await addDraftLine(db, shopId, id, pen, ownerId, true);
  if (added.status !== "ok") throw new Error(added.status);
  await updateDraftLine(db, shopId, id, added.line.id, {
    qtyMilli: qty * 1000,
    unitPricePaise: 1_000,
  });
  const result = await checkoutDraft(
    db,
    shopId,
    id,
    ownerId,
    SALE_TIME,
    paidNow && { amountPaise: paidNow.amountPaise, method: "UPI" },
  );
  return { id, result };
}

describe("outstanding", () => {
  it("is completed orders minus payments; voided payments and cancelled orders don't count", async () => {
    const customer = await newCustomer("Sarkar Book Stall");
    await sell(customer, 10); // ₹100
    const { id: cancelled } = await sell(customer, 5); // ₹50, cancelled below
    await cancelOrder(db, shopId, cancelled, "Wrong order", ownerId);
    expect(await customerBalance(db, shopId, customer)).toEqual({
      ordersPaise: 10_000,
      paidPaise: 0,
      outstandingPaise: 10_000,
    });

    const first = await recordPayment(db, shopId, customer, cash(4_000), ownerId);
    expect(first.status).toBe("recorded");
    expect((await customerBalance(db, shopId, customer)).outstandingPaise).toBe(6_000);

    if (first.status !== "recorded") throw new Error();
    expect(await voidPayment(db, shopId, first.id, "Entered twice", ownerId)).toEqual({
      status: "voided",
      amountPaise: 4_000,
    });
    expect((await customerBalance(db, shopId, customer)).outstandingPaise).toBe(10_000);
    expect(await voidPayment(db, shopId, first.id, "Again", ownerId)).toEqual({
      status: "already-voided",
    });

    // Paying more than owed leaves an advance (below zero).
    await recordPayment(db, shopId, customer, cash(12_500), ownerId);
    expect((await customerBalance(db, shopId, customer)).outstandingPaise).toBe(-2_500);

    const { rows } = await listCustomerPayments(db, shopId, customer);
    expect(rows.map((r) => [r.amountPaise, r.voidReason])).toEqual([
      [12_500, null],
      [4_000, "Entered twice"],
    ]);
    expect(rows[1]).toMatchObject({
      voidedByName: "owner",
      createdByName: "owner",
      method: "CASH",
    });
  });

  it("shows on the customer list, with a filter for customers who owe and a sort by dues", async () => {
    const shop = (await createShop(db, "List Shop")).id;
    const owner = (await createUser(db, { username: "list-owner", role: "ADMIN", shopId: shop }))
      .id;
    const item = (await createItem(db, owner, { name: "List Pen" })).id;
    await stockIn(db, owner, item, 100_000, 500);
    const sellHere = async (customer: string, totalRupees: number) => {
      const { id } = await createDraft(db, shop, owner, customer);
      const added = await addDraftLine(db, shop, id, item, owner, true);
      if (added.status !== "ok") throw new Error(added.status);
      await updateDraftLine(db, shop, id, added.line.id, {
        qtyMilli: 1_000,
        unitPricePaise: totalRupees * 100,
      });
      await checkoutDraft(db, shop, id, owner, SALE_TIME);
    };
    const small = await newCustomer("A Small Dues", shop, owner);
    const big = await newCustomer("B Big Dues", shop, owner);
    const paid = await newCustomer("C Paid Up", shop, owner);
    await sellHere(small, 100);
    await sellHere(big, 900);
    await sellHere(paid, 300);
    await recordPayment(db, shop, paid, cash(30_000), owner);

    const all = await listCustomers(db, shop, {});
    expect(all.rows.map((r) => [r.businessName, r.outstandingPaise])).toEqual([
      ["A Small Dues", 10_000],
      ["B Big Dues", 90_000],
      ["C Paid Up", 0],
    ]);
    const owing = await listCustomers(db, shop, { owing: true, sort: "dues" });
    expect(owing.rows.map((r) => r.businessName)).toEqual(["B Big Dues", "A Small Dues"]);
    expect(owing.total).toBe(2);

    // Dashboard: to collect counts only those who owe (an advance doesn't reduce it).
    await recordPayment(db, shop, paid, cash(5_000), owner); // C now has ₹50 advance
    const dash = await getDashboard(db, shop, { now: NOW, showCost: false });
    expect(dash.toCollectPaise).toBe(100_000);
    expect(dash.collectedToday).toEqual({ count: 2, totalPaise: 35_000 });
  });

  it("collected today leaves out voided payments and other days", async () => {
    const shop = (await createShop(db, "Collect Shop")).id;
    const owner = (await createUser(db, { username: "collect-owner", role: "ADMIN", shopId: shop }))
      .id;
    const customer = await newCustomer("Collect Customer", shop, owner);
    await recordPayment(db, shop, customer, cash(1_000), owner);
    await recordPayment(db, shop, customer, cash(2_000, new Date("2026-10-29T06:00:00Z")), owner);
    const wrong = await recordPayment(db, shop, customer, cash(4_000), owner);
    if (wrong.status !== "recorded") throw new Error();
    await voidPayment(db, shop, wrong.id, "Wrong", owner);
    const dash = await getDashboard(db, shop, { now: NOW, showCost: false });
    expect(dash.collectedToday).toEqual({ count: 1, totalPaise: 1_000 });
  });
});

describe("paid now at checkout", () => {
  it("records the payment with the order, in the same checkout", async () => {
    const customer = await newCustomer("Das Stationers");
    const { id, result } = await sell(customer, 10, { amountPaise: 6_000 });
    expect(result.status).toBe("completed");
    const order = await getOrder(db, shopId, id, false);
    expect(order).toMatchObject({ totalPaise: 10_000, paidPaise: 6_000 });
    expect((await customerBalance(db, shopId, customer)).outstandingPaise).toBe(4_000);
    const [payment] = (await listCustomerPayments(db, shopId, customer)).rows;
    expect(payment).toMatchObject({
      amountPaise: 6_000,
      method: "UPI",
      orderId: id,
      receivedAt: SALE_TIME,
    });
  });

  it("refuses more than the total, and then nothing at all is saved", async () => {
    const customer = await newCustomer("Debnath Book House");
    const stockBefore = (await getItem(db, pen)).currentStock;
    const { id, result } = await sell(customer, 1, { amountPaise: 1_001 });
    expect(result).toEqual({ status: "problems", problems: [{ key: "payments.paidTooMuch" }] });
    expect(await getDraft(db, shopId, id, false)).not.toBeNull(); // still a draft
    expect((await getItem(db, pen)).currentStock).toBe(stockBefore);
    expect((await listCustomerPayments(db, shopId, customer)).total).toBe(0);
  });

  it("a cancelled order's payment stays as the customer's credit", async () => {
    const customer = await newCustomer("Saha Stationery");
    const { id } = await sell(customer, 10, { amountPaise: 10_000 });
    await cancelOrder(db, shopId, id, "Returned", ownerId);
    expect(await customerBalance(db, shopId, customer)).toEqual({
      ordersPaise: 0,
      paidPaise: 10_000,
      outstandingPaise: -10_000,
    });
    expect((await getOrder(db, shopId, id, false))?.paidPaise).toBe(10_000);
  });
});

describe("database rules for payments", () => {
  let customer: string;
  let paymentId: string;
  const byId = () => eq(schema.payments.id, paymentId);

  beforeAll(async () => {
    customer = await newCustomer("Rules Customer");
    const recorded = await recordPayment(db, shopId, customer, cash(5_000), ownerId);
    if (recorded.status !== "recorded") throw new Error();
    paymentId = recorded.id;
  });

  it("can't be changed or deleted", async () => {
    await expectPgError(
      db.update(schema.payments).set({ amountPaise: 1 }).where(byId()),
      DB_ERROR.paymentImmutable,
    );
    await expectPgError(
      db.update(schema.payments).set({ note: "x" }).where(byId()),
      DB_ERROR.paymentImmutable,
    );
    await expectPgError(db.delete(schema.payments).where(byId()), DB_ERROR.paymentImmutable);
  });

  it("voiding needs who and why, happens once, and can't be undone", async () => {
    await expectPgError(
      db.update(schema.payments).set({ voidedAt: new Date(), voidedBy: ownerId }).where(byId()),
      DB_ERROR.checkViolation,
    );
    await voidPayment(db, shopId, paymentId, "Mistake", ownerId);
    await expectPgError(
      db
        .update(schema.payments)
        .set({ voidedAt: null, voidedBy: null, voidReason: null })
        .where(byId()),
      DB_ERROR.paymentImmutable,
    );
  });

  it("needs a positive amount, and an order's payment must be for that order's customer", async () => {
    const base = { shopId, vendorId: customer, method: "CASH" as const, createdBy: ownerId };
    await expectPgError(
      db.insert(schema.payments).values({ ...base, amountPaise: 0 }),
      DB_ERROR.checkViolation,
    );
    const other = await newCustomer("Someone Else");
    const { id: orderOfOther } = await sell(other, 1);
    await expectPgError(
      db.insert(schema.payments).values({ ...base, amountPaise: 100, orderId: orderOfOther }),
      DB_ERROR.paymentOrderMismatch,
    );
  });
});

describe("payments stay inside their shop", () => {
  it("can't be recorded for, voided in, or read by another shop", async () => {
    const customer = await newCustomer("Isolated Customer");
    const recorded = await recordPayment(db, shopId, customer, cash(700), ownerId);
    if (recorded.status !== "recorded") throw new Error();

    const otherShop = (await createShop(db, "Other Payments Shop")).id;
    const otherOwner = (
      await createUser(db, { username: "other-pay-owner", role: "ADMIN", shopId: otherShop })
    ).id;
    expect(await recordPayment(db, otherShop, customer, cash(100), otherOwner)).toEqual({
      status: "not-found",
    });
    expect(await voidPayment(db, otherShop, recorded.id, "x", otherOwner)).toEqual({
      status: "not-found",
    });
    expect((await listCustomerPayments(db, otherShop, customer)).total).toBe(0);
    await expectPgError(
      db.insert(schema.payments).values({
        shopId: otherShop,
        vendorId: customer,
        amountPaise: 1,
        method: "CASH",
        createdBy: otherOwner,
      }),
      DB_ERROR.foreignKeyViolation,
    );

    // Row level security: a login of the other shop sees none of them.
    const seen = await client.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE authenticated");
      await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherOwner]);
      const result = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM payments");
      await tx.rollback();
      return result.rows[0].n;
    });
    expect(seen).toBe(0);
  });
});
