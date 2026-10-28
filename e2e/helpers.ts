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
