import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seedBusinessData } from "@/db/seed/business-data";
import { seedVendors } from "@/db/seed/data";
import {
  createCustomer,
  getCustomer,
  listCustomerOrders,
  listCustomers,
  setCustomerArchived,
  updateCustomer,
} from "@/features/customers/data";
import {
  createItem,
  createTestDb,
  createUser,
  defaultShopId,
  stockIn,
  type TestDb,
} from "./test-db";

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

const input = {
  businessName: "Verma Traders",
  contactPerson: "Amit Verma",
  phone: "+919876543210",
  email: null,
  address: null,
  city: "Indore",
  notes: null,
};

describe("listCustomers", () => {
  it("lists active customers by name", async () => {
    const result = await listCustomers(db, shopId, {});
    expect(result.total).toBe(seedVendors.length);
    const names = result.rows.map((r) => r.businessName.toLowerCase());
    expect(names).toEqual([...names].sort());
  });

  it("searches name, contact person, phone and city", async () => {
    const by = async (q: string) =>
      (await listCustomers(db, shopId, { q })).rows.map((r) => r.businessName);
    expect(await by("sarkar")).toEqual(["Sarkar Book Stall"]);
    expect(await by("partha")).toEqual(["Chakraborty Stores"]);
    expect(await by("94360 12345")).toEqual(["Sarkar Book Stall"]);
    expect(await by("udaipur")).toEqual(["Debnath Book House"]);
  });

  it("sorts by city", async () => {
    const cities = (await listCustomers(db, shopId, { sort: "city" })).rows.map(
      (r) => r.city ?? "",
    );
    expect(cities).toEqual(
      [...cities].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    );
  });
});

describe("create, update, archive", () => {
  it("round-trips a customer", async () => {
    const created = await createCustomer(db, shopId, input, ownerId);
    await updateCustomer(db, shopId, created.id, { ...input, city: "Ujjain" });
    expect(await getCustomer(db, shopId, created.id)).toMatchObject({
      businessName: "Verma Traders",
      city: "Ujjain",
    });

    await setCustomerArchived(db, shopId, created.id, true);
    expect((await listCustomers(db, shopId, { q: "verma" })).total).toBe(0);
    expect((await listCustomers(db, shopId, { q: "verma", archived: true })).total).toBe(1);
  });
});

describe("order history", () => {
  it("shows only completed orders, newest first, with totals", async () => {
    const customer = await createCustomer(
      db,
      shopId,
      { ...input, businessName: "History Test" },
      ownerId,
    );
    const item = await createItem(db, ownerId, { name: "History item" });
    await stockIn(db, ownerId, item.id, 10_000, 1_000);

    const complete = async (n: number, total: number, when: Date) => {
      const [order] = await db
        .insert(schema.orders)
        .values({ shopId, vendorId: customer.id, createdBy: ownerId })
        .returning();
      await db.insert(schema.orderLines).values({
        shopId,
        orderId: order.id,
        itemId: item.id,
        quantity: "1.000",
        unitPricePaise: total,
        createdBy: ownerId,
      });
      await db
        .update(schema.orders)
        .set({
          status: "COMPLETED",
          orderNumber: `ORD-HIST-${n}`,
          subtotalPaise: total,
          discountPaise: 0,
          totalPaise: total,
          completedAt: when,
          completedBy: ownerId,
        })
        .where(eq(schema.orders.id, order.id));
    };
    await complete(1, 10_000, new Date("2026-10-01T10:00:00Z"));
    await complete(2, 25_000, new Date("2026-10-05T10:00:00Z"));
    await db.insert(schema.orders).values({ shopId, vendorId: customer.id, createdBy: ownerId }); // a draft

    const history = await listCustomerOrders(db, shopId, customer.id);
    expect(history.rows.map((r) => r.orderNumber)).toEqual(["ORD-HIST-2", "ORD-HIST-1"]);
    expect(history.rows[0].lineCount).toBe(1);
    expect(history.total).toBe(2);
    expect(history.totalPaise).toBe(35_000);

    const [row] = (await listCustomers(db, shopId, { q: "history test" })).rows;
    expect(row.orderCount).toBe(2);
  });
});
