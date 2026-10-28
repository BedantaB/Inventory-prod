/**
 * Seed script: creates the logins (owner + 2 staff) and realistic sample data.
 *
 *   pnpm db:seed           create logins; add sample data if the database has no items yet
 *   pnpm db:seed --reset   ALSO wipe all items, customers, stock and orders first
 *
 * Uses MIGRATION_DATABASE_URL (session pooler) and the Supabase secret key from .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../create";
import * as schema from "../schema";
import { seedBusinessData, wipeBusinessData } from "./business-data";
import { seedUsers } from "./data";
import { staffEmail } from "@/features/users/login-identity";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("✖ .env.local not found. Copy .env.example to .env.local and fill it in.");
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

async function seedLogins() {
  const ids: Record<string, string> = {};
  let ownerId: string | null = null;

  for (const user of seedUsers) {
    const isOwner = user.role === "ADMIN";
    const email = isOwner
      ? env.SEED_ADMIN_EMAIL.toLowerCase()
      : staffEmail(user.username, env.STAFF_EMAIL_DOMAIN);
    const password = isOwner ? env.SEED_ADMIN_PASSWORD : env.SEED_STAFF_PASSWORD;
    const id = await ensureAuthUser(email, password, user.fullName);

    await db
      .insert(schema.profiles)
      .values({
        id,
        username: user.username,
        fullName: user.fullName,
        email,
        role: user.role,
        isActive: true,
        createdBy: ownerId,
      })
      .onConflictDoUpdate({
        target: schema.profiles.id,
        set: {
          username: user.username,
          fullName: user.fullName,
          email,
          role: user.role,
          isActive: true,
        },
      });

    ids[user.key] = id;
    if (isOwner) ownerId = id;
    console.log(`  ✔ login: ${user.username.padEnd(8)} ${email} (${user.role})`);
  }
  return ids;
}

async function main() {
  const host = new URL(env.MIGRATION_DATABASE_URL).host;
  console.log(`Seeding database at ${host}${reset ? " (with --reset)" : ""}\n`);

  const userIds = await seedLogins();

  if (reset) {
    await wipeBusinessData(db);
    console.log("  ✔ wiped items, customers, stock and orders");
  } else {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.items);
    if (count > 0) {
      console.log(`\nThe database already has ${count} items, so sample data was not added.`);
      console.log("Run `pnpm db:seed --reset` to wipe it and start fresh.");
      return;
    }
  }

  const summary = await seedBusinessData(db, userIds);
  console.log(
    `  ✔ ${summary.categories} categories, ${summary.items} items, ${summary.vendors} customers`,
  );
  console.log(`  ✔ ${summary.stockEntries} stock-in bills with ${summary.movements} lines`);
  console.log(`  ✔ ${summary.orders} completed orders`);
  console.log("\nDone. Log in as the owner with SEED_ADMIN_EMAIL, or as staff with username");
  console.log("`ramesh` / `sunita` and SEED_STAFF_PASSWORD.");
}

main()
  .catch((error: unknown) => {
    console.error("\n✖ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
