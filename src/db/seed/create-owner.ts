/**
 * Creates the owner (ADMIN) login on a fresh database — for PRODUCTION, where the sample data
 * must not be loaded. See DEPLOYMENT.md.
 *
 *   ENV_FILE=.env.production.local pnpm owner:create
 *
 * Reads OWNER_EMAIL, OWNER_PASSWORD and OWNER_NAME, plus the Supabase and database settings,
 * from that file (default .env.local).
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../create";
import * as schema from "../schema";

const envFile = process.env.ENV_FILE ?? ".env.local";
try {
  process.loadEnvFile(envFile);
} catch {
  console.error(`✖ ${envFile} not found.`);
  process.exit(1);
}

const parsed = z
  .object({
    MIGRATION_DATABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    OWNER_EMAIL: z.email(),
    OWNER_PASSWORD: z.string().min(10, "OWNER_PASSWORD must be at least 10 characters"),
    OWNER_NAME: z.string().min(1).default("Owner"),
  })
  .safeParse(process.env);
if (!parsed.success) {
  console.error(`✖ Fix these in ${envFile}:`);
  for (const issue of parsed.error.issues)
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
const env = parsed.data;

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { db, client } = createDb(env.MIGRATION_DATABASE_URL, { max: 1 });

async function main() {
  const host = new URL(env.MIGRATION_DATABASE_URL).host;
  console.log(`Creating the owner login on ${host}\n`);

  const email = env.OWNER_EMAIL.toLowerCase();
  const created = await supabase.auth.admin.createUser({
    email,
    password: env.OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: env.OWNER_NAME },
  });
  if (created.error) {
    if (created.error.code === "email_exists") {
      console.error(
        "✖ A login with this email already exists. Use “Forgot password” in the app instead.",
      );
      process.exitCode = 1;
      return;
    }
    throw created.error;
  }

  // Username for the login box: the part before @, made safe and unique.
  const base =
    email
      .split("@")[0]
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 25) || "owner";
  const taken = await db
    .select({ username: schema.profiles.username })
    .from(schema.profiles)
    .where(sql`lower(${schema.profiles.username}) LIKE ${base + "%"}`);
  let username = base.length >= 3 ? base : `${base}owner`;
  for (let n = 2; taken.some((t) => t.username.toLowerCase() === username); n++)
    username = `${base}${n}`;

  await db.insert(schema.profiles).values({
    id: created.data.user.id,
    username,
    fullName: env.OWNER_NAME,
    email,
    role: "ADMIN",
    isActive: true,
  });

  console.log(`✔ Owner login created: ${email} (username: ${username})`);
  console.log("  Log in, then add your staff on the “Staff & Logins” page.");
}

main()
  .catch((error: unknown) => {
    console.error("\n✖ Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
