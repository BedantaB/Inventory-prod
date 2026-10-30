import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { orderLines, orders, vendors } from "@/db/schema";
import type { Database } from "@/db/types";
import { PAGE_SIZE, searchPatterns } from "@/lib/list-params";
import type { CustomerInput } from "./schemas";

// Customers = the `vendors` table (the businesses we sell to).

export const CUSTOMER_SORTS = ["name", "city", "recent"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

const sortOrder: Record<CustomerSort, SQL[]> = {
  name: [asc(sql`lower(${vendors.businessName})`)],
  city: [asc(sql`lower(coalesce(${vendors.city}, ''))`), asc(sql`lower(${vendors.businessName})`)],
  recent: [desc(vendors.createdAt)],
};

const customerColumns = {
  id: vendors.id,
  businessName: vendors.businessName,
  contactPerson: vendors.contactPerson,
  phone: vendors.phone,
  email: vendors.email,
  address: vendors.address,
  city: vendors.city,
  notes: vendors.notes,
  archivedAt: vendors.archivedAt,
  createdAt: vendors.createdAt,
};

export type CustomerView = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export async function listCustomers(
  db: Database,
  shopId: string,
  params: { q?: string; sort?: CustomerSort; page?: number; archived?: boolean },
) {
  const page = params.page ?? 1;
  const conditions: (SQL | undefined)[] = [
    eq(vendors.shopId, shopId),
    params.archived ? isNotNull(vendors.archivedAt) : isNull(vendors.archivedAt),
  ];
  for (const pattern of searchPatterns(params.q)) {
    conditions.push(
      or(
        ilike(vendors.businessName, pattern),
        ilike(vendors.contactPerson, pattern),
        ilike(vendors.phone, pattern),
        ilike(vendors.city, pattern),
      ),
    );
  }
  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        ...customerColumns,
        // Written out in full: Drizzle drops table names in single-table queries.
        orderCount:
          sql<number>`(SELECT count(*) FROM orders o WHERE o.vendor_id = vendors.id AND o.status = 'COMPLETED')`.mapWith(
            Number,
          ),
      })
      .from(vendors)
      .where(where)
      .orderBy(...sortOrder[params.sort ?? "name"])
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(vendors)
      .where(where),
  ]);
  return { rows, total, page };
}

export async function getCustomer(db: Database, shopId: string, id: string) {
  const [row] = await db
    .select(customerColumns)
    .from(vendors)
    .where(and(eq(vendors.shopId, shopId), eq(vendors.id, id)));
  return row ?? null;
}

export async function createCustomer(
  db: Database,
  shopId: string,
  input: CustomerInput,
  actorId: string,
) {
  const [row] = await db
    .insert(vendors)
    .values({ ...input, shopId, createdBy: actorId })
    .returning({
      id: vendors.id,
      businessName: vendors.businessName,
      phone: vendors.phone,
      city: vendors.city,
    });
  return row;
}

export async function updateCustomer(
  db: Database,
  shopId: string,
  id: string,
  input: CustomerInput,
) {
  const [row] = await db
    .update(vendors)
    .set(input)
    .where(and(eq(vendors.shopId, shopId), eq(vendors.id, id)))
    .returning({ id: vendors.id, businessName: vendors.businessName });
  return row ?? null;
}

export async function setCustomerArchived(
  db: Database,
  shopId: string,
  id: string,
  archived: boolean,
) {
  const [row] = await db
    .update(vendors)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(vendors.shopId, shopId), eq(vendors.id, id)))
    .returning({ id: vendors.id, businessName: vendors.businessName });
  return row ?? null;
}

/**
 * One customer's orders (completed and cancelled), newest first. The summary counts completed
 * orders only.
 */
export async function listCustomerOrders(
  db: Database,
  shopId: string,
  customerId: string,
  page = 1,
) {
  const where = and(
    eq(orders.shopId, shopId),
    eq(orders.vendorId, customerId),
    ne(orders.status, "DRAFT"),
  );
  const [rows, [{ total, completed, totalPaise }]] = await Promise.all([
    db
      .select({
        id: orders.id,
        status: orders.status,
        orderNumber: orders.orderNumber,
        completedAt: orders.completedAt,
        totalPaise: orders.totalPaise,
        lineCount: sql<number>`count(${orderLines.id})`.mapWith(Number),
      })
      .from(orders)
      .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
      .where(where)
      .groupBy(orders.id)
      .orderBy(desc(orders.completedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        completed: sql<number>`count(*) FILTER (WHERE ${orders.status} = 'COMPLETED')`.mapWith(
          Number,
        ),
        totalPaise:
          sql<number>`coalesce(sum(${orders.totalPaise}) FILTER (WHERE ${orders.status} = 'COMPLETED'), 0)`.mapWith(
            Number,
          ),
      })
      .from(orders)
      .where(where),
  ]);
  return { rows, total, completed, totalPaise, page };
}
