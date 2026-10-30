/**
 * Seed script: creates two sample shops with their logins, a platform admin login, and
 * realistic sample data.
 *
 *   pnpm db:seed           create shops and logins; add sample data to shops with no items yet
 *   pnpm db:seed --reset   ALSO wipe all items, customers, stock and orders (all shops) first
 *
 * Uses MIGRATION_DATABASE_URL (session pooler) and the Supabase secret key from .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../create";
import * as schema from "../schema";
import { seedBusinessData, seedSecondShop, wipeBusinessData } from "./business-data";
import { seedShops, seedUsers } from "./data";
import { staffEmail } from "@/features/users/login-identity";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("✖ .env.local not found. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}
// The sample data is for development only (see DEPLOYMENT.md: use `pnpm platform-admin:create`).
if (process.env.ENV_FILE || process.env.NODE_ENV === "production") {
  console.error("✖ The seed script is for the development database only.");
  process.exit(1);
}

const envResult = z
  .object({
    MIGRATION_DATABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    STAFF_EMAIL_DOMAIN: z.string().min(3),
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(8),
    SEED_STAFF_PASSWORD: z.string().min(8),
  })
  .safeParse(process.env);

if (!envResult.success) {
  const names = envResult.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`✖ Missing or invalid values in .env.local: ${names}`);
  process.exit(1);
}
const env = envResult.data;
const reset = process.argv.includes("--reset");

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { db, client } = createDb(env.MIGRATION_DATABASE_URL, { max: 1 });

/** Creates the Supabase Auth user, or finds the existing one and resets its password. */
async function ensureAuthUser(email: string, password: string, fullName: string): Promise<string> {
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!created.error) return created.data.user.id;
  if (created.error.code !== "email_exists") throw created.error;

  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      const updated = await supabase.auth.admin.updateUserById(existing.id, { password });
      if (updated.error) throw updated.error;
      return existing.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`Could not create or find the login for ${email}`);
}

/**
 * Finds or creates each sample shop (with its default units). A shop is recognised by its
 * owner's login, so a database upgraded from v1 ("My Shop") keeps its data and is renamed.
 */
async function ensureShops(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const shop of seedShops) {
    const owner = seedUsers.find((u) => u.shop === shop.key && u.role === "ADMIN")!;
    const [existing] = await db
      .select({ shopId: schema.profiles.shopId })
      .from(schema.profiles)
      .where(sql`lower(${schema.profiles.username}) = ${owner.username}`);
    const values = { name: shop.name, address: shop.address, phone: shop.phone, isActive: true };
    let id = existing?.shopId;
    if (id) {
      await db.update(schema.shops).set(values).where(eq(schema.shops.id, id));
    } else {
      [{ id }] = await db.insert(schema.shops).values(values).returning({ id: schema.shops.id });
    }
    await db.execute(sql`SELECT public.create_default_units(${id})`);
    ids[shop.key] = id;
    console.log(`  ✔ shop: ${shop.name}`);
  }
  return ids;
}

type SeedLogin = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: "ADMIN" | "STAFF";
  shopId: string | null;
};

async function upsertLogin(login: SeedLogin): Promise<string> {
  const id = await ensureAuthUser(login.email, login.password, login.fullName);
  const profile = {
    username: login.username,
    fullName: login.fullName,
    email: login.email,
    role: login.role,
    isActive: true,
    shopId: login.shopId,
    isPlatformAdmin: login.shopId === null,
  };
  await db
    .insert(schema.profiles)
    .values({ id, ...profile })
    .onConflictDoUpdate({ target: schema.profiles.id, set: profile });
  console.log(`  ✔ login: ${login.username.padEnd(8)} ${login.email} (${login.role})`);
  return id;
}

async function seedLogins(shopIds: Record<string, string>) {
  const ids: Record<string, string> = {};
  for (const user of seedUsers) {
    // The first shop's owner uses a real email (to try "Forgot password"); the rest use usernames.
    const realEmail = user.key === "owner";
    ids[user.key] = await upsertLogin({
      username: user.username,
      fullName: user.fullName,
      email: realEmail
        ? env.SEED_ADMIN_EMAIL.toLowerCase()
        : staffEmail(user.username, env.STAFF_EMAIL_DOMAIN),
      password: realEmail ? env.SEED_ADMIN_PASSWORD : env.SEED_STAFF_PASSWORD,
      role: user.role,
      shopId: shopIds[user.shop],
    });
  }
  // The platform admin (creates shops; sees no shop data).
  await upsertLogin({
    username: "platform",
    fullName: "Platform Admin",
    email: staffEmail("platform", env.STAFF_EMAIL_DOMAIN),
    password: env.SEED_ADMIN_PASSWORD,
    role: "ADMIN",
    shopId: null,
  });
  return ids;
}

async function itemCount(shopId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(eq(schema.items.shopId, shopId));
  return count;
}

async function main() {
  const host = new URL(env.MIGRATION_DATABASE_URL).host;
  console.log(`Seeding database at ${host}${reset ? " (with --reset)" : ""}\n`);

  const shopIds = await ensureShops();
  const userIds = await seedLogins(shopIds);

  if (reset) {
    await wipeBusinessData(db);
    console.log("  ✔ wiped items, customers, stock and orders");
  }

  const first = shopIds.prantik;
  if ((await itemCount(first)) > 0) {
    console.log("\nPRANTIK Stationers already has items, so its sample data was not added.");
    console.log("Run `pnpm db:seed --reset` to wipe all shops' data and start fresh.");
  } else {
    const summary = await seedBusinessData(db, first, userIds);
    console.log(
      `  ✔ ${summary.categories} categories, ${summary.items} items, ${summary.vendors} customers`,
    );
    console.log(`  ✔ ${summary.stockEntries} stock-in bills with ${summary.movements} lines`);
    console.log(`  ✔ ${summary.orders} completed orders`);
  }

  if ((await itemCount(shopIds.sharma)) === 0) {
    const second = await seedSecondShop(db, shopIds.sharma, userIds.sharma);
    console.log(`  ✔ Sharma General Store: ${second.items} items`);
  }

  console.log("\nDone. Logins:");
  console.log(
    "  PRANTIK Stationers: SEED_ADMIN_EMAIL (owner), `ramesh` / `sunita` (SEED_STAFF_PASSWORD)",
  );
  console.log("  Sharma General Store: `sharma` (SEED_STAFF_PASSWORD)");
  console.log("  Platform admin: `platform` (SEED_ADMIN_PASSWORD)");
}

main()
  .catch((error: unknown) => {
    console.error("\n✖ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
