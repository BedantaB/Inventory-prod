import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing — e2e tests read .env.local`);
  return value;
}

export const creds = {
  get ownerEmail() {
    return env("SEED_ADMIN_EMAIL");
  },
  get ownerPassword() {
    return env("SEED_ADMIN_PASSWORD");
  },
  get staffPassword() {
    return env("SEED_STAFF_PASSWORD");
  },
};

export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

export async function login(page: Page, identifier: string, password: string) {
  if (!page.url().includes("/login")) await page.goto("/login");
  await page.getByLabel("Username or email").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function loginAsOwner(page: Page) {
  await login(page, creds.ownerEmail, creds.ownerPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
}

/** Opens the menu that holds secondary links (the "More" sheet on phones). */
export async function openMenu(page: Page) {
  if (isMobile(page)) await page.getByRole("button", { name: "More" }).click();
}

export async function logout(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByText("You have been logged out.")).toBeVisible();
}

/** Supabase admin client for cleaning up logins the tests create. */
export function adminClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function deleteLoginByEmail(email: string) {
  const admin = adminClient().auth.admin;
  const { data } = await admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  // Deleting the auth user also deletes the profile (ON DELETE CASCADE).
  if (user) await admin.deleteUser(user.id);
}

/** Direct database access for cleaning up rows the tests create (names start with "E2E "). */
export async function cleanupTestData() {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env("MIGRATION_DATABASE_URL"), { prepare: false, max: 1 });
  try {
    const photos = await sql<{ photo_path: string }[]>`
      SELECT photo_path FROM items WHERE name LIKE 'E2E %' AND photo_path IS NOT NULL`;
    if (photos.length > 0) {
      const paths = photos.flatMap((p) => [
        p.photo_path,
        p.photo_path.replace(/\.jpg$/, ".thumb.jpg"),
      ]);
      await adminClient().storage.from("item-photos").remove(paths);
    }
    // Stock history can never be deleted by the app (trigger stock_movements_immutable).
    // Test cleanup on the DEV database switches that guard off for a moment, only to remove
    // rows belonging to "E2E" items, inside one transaction.
    await sql.begin(async (tx) => {
      await tx`ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_immutable`;
      await tx`DELETE FROM stock_movements WHERE item_id IN (SELECT id FROM items WHERE name LIKE 'E2E %')`;
      await tx`ALTER TABLE stock_movements ENABLE TRIGGER stock_movements_immutable`;
      await tx`DELETE FROM stock_entries e WHERE NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.stock_entry_id = e.id)`;
      await tx`DELETE FROM items WHERE name LIKE 'E2E %'`;
    });
    await sql`DELETE FROM categories WHERE name LIKE 'E2E %'`;
    await sql`DELETE FROM brands WHERE name LIKE 'E2E %'`;
    await sql`DELETE FROM vendors WHERE business_name LIKE 'E2E %'`;
  } finally {
    await sql.end();
  }
}

/** A small valid PNG (a coloured square) for photo upload tests. */
export function testPng(): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAQ0lEQVR4nO3PQQ0AIBDAsIF/z6cK" +
        "oQkdJr2+M3a5XQCcbgTQAaAKgCoAqgCoAqAKgCoAqgCoAqAKgCoAqgCoAqDqAeC4AUFRIUT8AAAAAElFTkSuQmCC",
      "base64",
    ),
  };
}

/** Creates a throwaway item straight in the database (faster than the form). */
export async function createTestItem(name: string, unit = "pcs"): Promise<string> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env("MIGRATION_DATABASE_URL"), { prepare: false, max: 1 });
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO items (name, unit_id, mrp_paise, selling_price_paise, created_by)
      SELECT ${name}, u.id, 2500, 2000, p.id
      FROM units u, profiles p
      WHERE u.name = ${unit} AND p.role = 'ADMIN'
      LIMIT 1
      RETURNING id`;
    return row.id;
  } finally {
    await sql.end();
  }
}
