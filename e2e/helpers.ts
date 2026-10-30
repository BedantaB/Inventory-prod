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

export async function loginAsPlatformAdmin(page: Page) {
  await login(page, "platform", creds.ownerPassword);
  await expect(page.getByRole("heading", { name: "Shops" })).toBeVisible();
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
      // Orders for E2E customers or with E2E items (completed ones included).
      const orderIds = (
        await tx<{ id: string }[]>`
          SELECT id FROM orders WHERE vendor_id IN (SELECT id FROM vendors WHERE business_name LIKE 'E2E %')
          UNION
          SELECT order_id FROM order_lines WHERE item_id IN (SELECT id FROM items WHERE name LIKE 'E2E %')`
      ).map((r) => r.id);
      // Payments can't be deleted by the app either (trigger protect_payments).
      await tx`ALTER TABLE payments DISABLE TRIGGER protect_payments`;
      await tx`DELETE FROM payments WHERE order_id = ANY(${orderIds}::uuid[])
                 OR vendor_id IN (SELECT id FROM vendors WHERE business_name LIKE 'E2E %')`;
      await tx`ALTER TABLE payments ENABLE TRIGGER protect_payments`;
      await tx`ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_immutable`;
      await tx`ALTER TABLE orders DISABLE TRIGGER protect_completed_orders`;
      await tx`ALTER TABLE order_lines DISABLE TRIGGER protect_completed_order_lines`;
      await tx`DELETE FROM stock_movements WHERE order_id = ANY(${orderIds}::uuid[])
                 OR item_id IN (SELECT id FROM items WHERE name LIKE 'E2E %')`;
      await tx`DELETE FROM order_lines WHERE order_id = ANY(${orderIds}::uuid[])`;
      await tx`DELETE FROM orders WHERE id = ANY(${orderIds}::uuid[])`;
      await tx`ALTER TABLE order_lines ENABLE TRIGGER protect_completed_order_lines`;
      await tx`ALTER TABLE orders ENABLE TRIGGER protect_completed_orders`;
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

/** Removes shops made by the platform tests (name starts with "E2E "), with their logins. */
export async function deleteTestShops() {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env("MIGRATION_DATABASE_URL"), { prepare: false, max: 1 });
  try {
    const logins = await sql<{ id: string }[]>`
      SELECT p.id FROM profiles p JOIN shops s ON s.id = p.shop_id WHERE s.name LIKE 'E2E %'`;
    // Deleting the auth user also deletes the profile (ON DELETE CASCADE).
    for (const { id } of logins) await adminClient().auth.admin.deleteUser(id);
    await sql`DELETE FROM units WHERE shop_id IN (SELECT id FROM shops WHERE name LIKE 'E2E %')`;
    await sql`DELETE FROM shops WHERE name LIKE 'E2E %'`;
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

/**
 * Creates a throwaway item straight in the database (faster than the form):
 * MRP ₹25, usual price ₹20, and optionally some stock at a cost.
 */
export async function createTestItem(
  name: string,
  unit = "pcs",
  stock?: { qty: number; costPaise: number },
): Promise<string> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env("MIGRATION_DATABASE_URL"), { prepare: false, max: 1 });
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO items (shop_id, name, unit_id, mrp_paise, selling_price_paise, created_by)
      SELECT p.shop_id, ${name}, u.id, 2500, 2000, p.id
      FROM profiles p JOIN units u ON u.shop_id = p.shop_id
      WHERE p.username = 'owner' AND u.name = ${unit}
      RETURNING id`;
    if (stock) {
      await sql.begin(async (tx) => {
        const [entry] = await tx<{ id: string }[]>`
          INSERT INTO stock_entries (shop_id, reference, created_by)
          SELECT shop_id, 'E2E', id FROM profiles p WHERE p.username = 'owner' RETURNING id`;
        await tx`
          INSERT INTO stock_movements (shop_id, type, item_id, quantity_change, unit_cost_paise, stock_entry_id, created_by)
          SELECT shop_id, 'IN', ${row.id}, ${stock.qty}, ${stock.costPaise}, ${entry.id}, id
          FROM profiles p WHERE p.username = 'owner'`;
      });
    }
    return row.id;
  } finally {
    await sql.end();
  }
}

/** A throwaway customer (business name starts with "E2E "). */
export async function createTestCustomer(name: string): Promise<string> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env("MIGRATION_DATABASE_URL"), { prepare: false, max: 1 });
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO vendors (shop_id, business_name, phone, city, created_by)
      SELECT shop_id, ${name}, '+919800000000', 'Agartala', id FROM profiles p WHERE p.username = 'owner'
      RETURNING id`;
    return row.id;
  } finally {
    await sql.end();
  }
}
