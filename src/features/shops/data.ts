import { and, asc, desc, eq, sql } from "drizzle-orm";
import { profiles, shops, units } from "@/db/schema";
import type { Database } from "@/db/types";
import type { ShopDetails } from "./schemas";

// Shops are managed by the platform admin, who sees each shop's details and logins but none
// of its business data (items, customers, stock, orders).

export type ShopRow = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  activeLogins: number;
};

/** All shops, active first, by name. */
export function listShops(db: Database): Promise<ShopRow[]> {
  return db
    .select({
      id: shops.id,
      name: shops.name,
      isActive: shops.isActive,
      createdAt: shops.createdAt,
      // Plain SQL: Drizzle leaves out table names in single-table queries (see CLAUDE.md).
      activeLogins: sql<number>`(
        SELECT count(*)::int FROM profiles p WHERE p.shop_id = shops.id AND p.is_active
      )`,
    })
    .from(shops)
    .orderBy(desc(shops.isActive), asc(shops.name));
}

export type ShopView = ShopDetails & { id: string; isActive: boolean; createdAt: Date };

export async function getShop(db: Database, id: string): Promise<ShopView | null> {
  const [shop] = await db
    .select({
      id: shops.id,
      name: shops.name,
      address: shops.address,
      phone: shops.phone,
      isActive: shops.isActive,
      createdAt: shops.createdAt,
    })
    .from(shops)
    .where(eq(shops.id, id));
  return shop ?? null;
}

/** The owner logins of a shop (the platform admin can reset their passwords). */
export function listShopOwners(db: Database, shopId: string) {
  return db
    .select({
      id: profiles.id,
      username: profiles.username,
      fullName: profiles.fullName,
      role: profiles.role,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(and(eq(profiles.shopId, shopId), eq(profiles.role, "ADMIN")))
    .orderBy(asc(profiles.fullName));
}

/** Creates a shop with the usual units (pcs, box, kg, …), ready for its owner. */
export async function createShop(db: Database, input: ShopDetails, actorId: string) {
  return db.transaction(async (tx) => {
    const [shop] = await tx
      .insert(shops)
      .values({ ...input, createdBy: actorId })
      .returning({ id: shops.id });
    await tx.execute(sql`SELECT public.create_default_units(${shop.id})`);
    return shop;
  });
}

/**
 * Removes a shop that was just created, when its owner login could not be made. Only a shop
 * with no logins can be removed: anything else is turned off instead (setShopActive).
 */
export async function deleteNewShop(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [login] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.shopId, id))
      .limit(1);
    if (login) throw new Error("Refusing to delete a shop that has logins");
    await tx.delete(units).where(eq(units.shopId, id));
    await tx.delete(shops).where(eq(shops.id, id));
  });
}

export async function updateShopDetails(db: Database, id: string, input: ShopDetails) {
  const [shop] = await db
    .update(shops)
    .set(input)
    .where(eq(shops.id, id))
    .returning({ id: shops.id, name: shops.name });
  return shop ?? null;
}

/** A turned-off shop's logins are signed out on their next click and can't log in. */
export async function setShopActive(db: Database, id: string, active: boolean) {
  const [shop] = await db
    .update(shops)
    .set({ isActive: active })
    .where(eq(shops.id, id))
    .returning({ id: shops.id, name: shops.name });
  return shop ?? null;
}
