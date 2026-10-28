import { sql, type SQL } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

export const userRole = pgEnum("user_role", ["ADMIN", "STAFF"]);

/** One row per login. `id` is the Supabase Auth user id. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    username: text().notNull(),
    fullName: text().notNull(),
    email: text().notNull(),
    role: userRole().notNull().default("STAFF"),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Null only for the first admin, who is created by the seed script.
    createdBy: uuid().references((): AnyPgColumn => profiles.id),
  },
  (t) => [uniqueIndex("profiles_username_key").on(lower(t.username))],
);

export function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}
