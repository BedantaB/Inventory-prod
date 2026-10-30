import { sql, type SQL } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

export const userRole = pgEnum("user_role", ["ADMIN", "STAFF"]);

/**
 * A shop (business). Shops are completely separate: every business row belongs to one shop.
 * Created by the platform admin. Name, address and phone are printed on orders.
 */
export const shops = pgTable("shops", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  address: text(),
  phone: text(),
  // Turning a shop off logs all its users out and stops them logging in.
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid().references((): AnyPgColumn => profiles.id),
});

/**
 * One row per login. `id` is the Supabase Auth user id.
 * Shop users have a shop and a role (ADMIN = the shop owner, STAFF).
 * The platform admin has no shop and can only manage shops, never see their data.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    shopId: uuid().references((): AnyPgColumn => shops.id),
    isPlatformAdmin: boolean().notNull().default(false),
    username: text().notNull(),
    fullName: text().notNull(),
    email: text().notNull(),
    role: userRole().notNull().default("STAFF"),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Null for logins created by scripts (the first owner / platform admin).
    createdBy: uuid().references((): AnyPgColumn => profiles.id),
  },
  (t) => [
    uniqueIndex("profiles_username_key").on(lower(t.username)),
    index("profiles_shop_idx").on(t.shopId),
    // Exactly one of: belongs to a shop, or is the platform admin.
    check("profiles_shop_or_platform", sql`${t.isPlatformAdmin} = (${t.shopId} IS NULL)`),
  ],
);

export function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}
