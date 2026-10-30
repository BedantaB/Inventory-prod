import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { qtyToDb } from "@/lib/qty";

/** The bits of a Supabase database our migrations rely on (auth schema, roles, default grants). */
const SUPABASE_STUBS = /* sql */ `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  -- Supabase grants everything on new tables to these roles; RLS is what protects data.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
  SET search_path TO "$user", public, extensions;
`;

export async function createTestDb() {
  const client = new PGlite({ extensions: { pg_trgm } });
  await client.exec(SUPABASE_STUBS);
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return { client, db };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];

/** A shop with the default units, like the platform admin creates. */
export async function createShop(db: TestDb, name = "Test Shop") {
  const [shop] = await db.insert(schema.shops).values({ name }).returning();
  await db.execute(sql`SELECT public.create_default_units(${shop.id})`);
  return shop;
}

const defaultShops = new WeakMap<TestDb, string>();

/** The shop tests use when they don't ask for a specific one (created on first use). */
export async function defaultShopId(db: TestDb): Promise<string> {
  let id = defaultShops.get(db);
  if (!id) {
    id = (await createShop(db, "Default Test Shop")).id;
    defaultShops.set(db, id);
  }
  return id;
}

export async function createUser(
  db: TestDb,
  {
    username,
    role = "STAFF",
    isActive = true,
    fullName = username,
    shopId,
    platformAdmin = false,
  }: {
    username: string;
    role?: "ADMIN" | "STAFF";
    isActive?: boolean;
    fullName?: string;
    shopId?: string;
    platformAdmin?: boolean;
  },
) {
  const id = crypto.randomUUID();
  const email = `${username}@staff.test`;
  await db.execute(`INSERT INTO auth.users (id, email) VALUES ('${id}', '${email}')`);
  const [profile] = await db
    .insert(schema.profiles)
    .values({
      id,
      username,
      fullName,
      email,
      role,
      isActive,
      isPlatformAdmin: platformAdmin,
      shopId: platformAdmin ? null : (shopId ?? (await defaultShopId(db))),
    })
    .returning();
  return profile;
}

/** The shop a test user belongs to. */
export async function shopOf(db: TestDb, userId: string): Promise<string> {
  const [p] = await db
    .select({ shopId: schema.profiles.shopId })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId));
  return p.shopId!;
}

export async function getUnit(db: TestDb, name: string, shopId?: string) {
  const shop = shopId ?? (await defaultShopId(db));
  const [unit] = await db
    .select()
    .from(schema.units)
    .where(and(eq(schema.units.name, name), eq(schema.units.shopId, shop)));
  return unit;
}

export async function createItem(
  db: TestDb,
  userId: string,
  values: { name: string; unit?: string; sku?: string },
) {
  const shopId = await shopOf(db, userId);
  const unit = await getUnit(db, values.unit ?? "pcs", shopId);
  const [item] = await db
    .insert(schema.items)
    .values({ shopId, name: values.name, sku: values.sku, unitId: unit.id, createdBy: userId })
    .returning();
  return item;
}

export async function getItem(db: TestDb, itemId: string) {
  const [item] = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
  return item;
}

/** Records one Add Stock entry with a single line. */
export async function stockIn(
  db: TestDb,
  userId: string,
  itemId: string,
  qtyMilli: number,
  unitCostPaise: number,
) {
  const shopId = await shopOf(db, userId);
  const [entry] = await db
    .insert(schema.stockEntries)
    .values({ shopId, reference: "TEST", createdBy: userId })
    .returning();
  const [movement] = await db
    .insert(schema.stockMovements)
    .values({
      shopId,
      type: "IN",
      itemId,
      quantityChange: qtyToDb(qtyMilli),
      unitCostPaise,
      stockEntryId: entry.id,
      createdBy: userId,
    })
    .returning();
  return movement;
}

/** Asserts that a database call fails with the given Postgres error code. */
export async function expectPgError(promise: Promise<unknown>, code: string) {
  const { getPgErrorCode } = await import("@/db/errors");
  try {
    await promise;
  } catch (error) {
    const actual = getPgErrorCode(error);
    if (actual !== code) {
      throw new Error(
        `Expected Postgres error ${code}, got ${actual ?? "none"}: ${String(error)}`,
        {
          cause: error,
        },
      );
    }
    return;
  }
  throw new Error(`Expected Postgres error ${code}, but the call succeeded`);
}
