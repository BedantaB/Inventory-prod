import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { DB_ERROR } from "@/db/errors";
import {
  createItem,
  createTestDb,
  createUser,
  defaultShopId,
  expectPgError,
  type TestDb,
} from "./test-db";

let db: TestDb;
let shopId: string;
let userId: string;
let vendorId: string;
let itemId: string;

beforeAll(async () => {
  ({ db } = await createTestDb());
  shopId = await defaultShopId(db);
  userId = (await createUser(db, { username: "owner", role: "ADMIN" })).id;
  const [vendor] = await db
    .insert(schema.vendors)
    .values({
      shopId,
      businessName: "Sharma Kirana Store",
      phone: "+919812345670",
      createdBy: userId,
    })
    .returning();
  vendorId = vendor.id;
  itemId = (await createItem(db, userId, { name: "Atta 10 kg" })).id;
});

let orderCounter = 0;

async function createCompletedOrder() {
  const [order] = await db
    .insert(schema.orders)
    .values({ shopId, vendorId, createdBy: userId })
    .returning();
  const [line] = await db
    .insert(schema.orderLines)
    .values({
      shopId,
      orderId: order.id,
      itemId,
      quantity: "1.000",
      unitPricePaise: 40_000,
      createdBy: userId,
    })
    .returning();
  orderCounter += 1;
  const [completed] = await db
    .update(schema.orders)
    .set({
      status: "COMPLETED",
      orderNumber: `ORD-TEST-${orderCounter}`,
      subtotalPaise: 40_000,
      discountPaise: 0,
      totalPaise: 40_000,
      completedAt: new Date(),
      completedBy: userId,
    })
    .where(eq(schema.orders.id, order.id))
    .returning();
  return { order: completed, line };
}

describe("draft orders", () => {
  it("can be edited and discarded", async () => {
    const [draft] = await db
      .insert(schema.orders)
      .values({ shopId, createdBy: userId })
      .returning();
    await db
      .insert(schema.orderLines)
      .values({ shopId, orderId: draft.id, itemId, quantity: "2.000", createdBy: userId });
    await db
      .update(schema.orders)
      .set({ discountValue: 500 })
      .where(eq(schema.orders.id, draft.id));
    await db.delete(schema.orders).where(eq(schema.orders.id, draft.id));

    const lines = await db
      .select()
      .from(schema.orderLines)
      .where(eq(schema.orderLines.orderId, draft.id));
    expect(lines).toHaveLength(0);
  });

  it("cannot be completed without a number, customer and totals", async () => {
    const [draft] = await db
      .insert(schema.orders)
      .values({ shopId, createdBy: userId })
      .returning();
    await expectPgError(
      db.update(schema.orders).set({ status: "COMPLETED" }).where(eq(schema.orders.id, draft.id)),
      DB_ERROR.checkViolation,
    );
  });

  it("rejects totals that do not add up", async () => {
    const [draft] = await db
      .insert(schema.orders)
      .values({ shopId, vendorId, createdBy: userId })
      .returning();
    await expectPgError(
      db
        .update(schema.orders)
        .set({ subtotalPaise: 1000, discountPaise: 100, totalPaise: 1000 })
        .where(eq(schema.orders.id, draft.id)),
      DB_ERROR.checkViolation,
    );
  });

  it("caps a percentage discount at 100%", async () => {
    await expectPgError(
      db
        .insert(schema.orders)
        .values({ shopId, discountKind: "PERCENT", discountValue: 10_001, createdBy: userId }),
      DB_ERROR.checkViolation,
    );
  });
});

describe("completed orders", () => {
  it("cannot be changed or deleted", async () => {
    const { order } = await createCompletedOrder();
    await expectPgError(
      db.update(schema.orders).set({ totalPaise: 1 }).where(eq(schema.orders.id, order.id)),
      DB_ERROR.orderCompleted,
    );
    await expectPgError(
      db.update(schema.orders).set({ status: "DRAFT" }).where(eq(schema.orders.id, order.id)),
      DB_ERROR.orderCompleted,
    );
    await expectPgError(
      db.delete(schema.orders).where(eq(schema.orders.id, order.id)),
      DB_ERROR.orderCompleted,
    );
  });

  it("protect their lines", async () => {
    const { order, line } = await createCompletedOrder();
    await expectPgError(
      db
        .update(schema.orderLines)
        .set({ quantity: "5.000" })
        .where(eq(schema.orderLines.id, line.id)),
      DB_ERROR.orderCompleted,
    );
    await expectPgError(
      db.delete(schema.orderLines).where(eq(schema.orderLines.id, line.id)),
      DB_ERROR.orderCompleted,
    );
    const otherItem = await createItem(db, userId, { name: "Maida 1 kg" });
    await expectPgError(
      db.insert(schema.orderLines).values({
        shopId,
        orderId: order.id,
        itemId: otherItem.id,
        quantity: "1.000",
        createdBy: userId,
      }),
      DB_ERROR.orderCompleted,
    );
  });

  it("can still be archived", async () => {
    const { order } = await createCompletedOrder();
    const [archived] = await db
      .update(schema.orders)
      .set({ archivedAt: new Date() })
      .where(eq(schema.orders.id, order.id))
      .returning();
    expect(archived.archivedAt).not.toBeNull();
  });
});
