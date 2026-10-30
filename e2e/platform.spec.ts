import { expect, test } from "@playwright/test";
import { deleteTestShops, login, loginAsOwner, loginAsPlatformAdmin } from "./helpers";

// The platform admin creates shops; each shop sees only its own data.

const suffix = Date.now().toString(36).slice(-5);
const shopName = `E2E Shop ${suffix}`;
const username = `e2eowner${suffix}`;
const password = "e2e-owner-pass-1";

test.afterAll(async () => {
  await deleteTestShops();
});

test("platform admin creates a shop; its owner sees only that shop; turning it off signs them out", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes data; run once");

  await loginAsPlatformAdmin(page);
  await expect(page).toHaveURL(/\/platform$/);
  await expect(page.getByRole("link", { name: /PRANTIK Stationers/ })).toBeVisible();

  // Create the shop and its owner's login.
  await page.getByRole("link", { name: "Add shop" }).click();
  await page.getByLabel("Shop name").fill(shopName);
  await page.getByLabel("Phone").fill("9436000099");
  await page.getByLabel("Full name").fill("E2E Owner");
  // The login page stays mounted (hidden), so pick the visible fields.
  await page.getByLabel("Username", { exact: true }).filter({ visible: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Add shop" }).click();
  await expect(page.getByText(`${shopName} is ready.`)).toBeVisible();
  await expect(page.getByRole("heading", { name: shopName })).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  // The new owner logs in: their own, empty shop.
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await login(owner, username, password);
  await expect(owner.getByRole("heading", { name: "Namaste, E2E" })).toBeVisible();
  await expect(owner.getByRole("link", { name: shopName })).toBeVisible();
  await owner.goto("/items");
  await expect(owner.getByText("No items yet")).toBeVisible();
  await owner.goto("/customers");
  await expect(owner.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(owner.getByText("Sarkar Book Stall")).toHaveCount(0);

  // Shop settings: the owner fills in the address (printed on orders).
  await owner.goto("/settings");
  await owner.getByLabel("Address").fill("Test Road, Agartala");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Shop details saved.")).toBeVisible();

  // Shop logins can't open the platform pages.
  await owner.goto("/platform");
  await expect(owner).toHaveURL(/\/$/);

  // The platform admin turns the shop off: the owner is signed out on the next page.
  await page.getByRole("button", { name: "Turn off shop" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Turn off shop" }).click();
  await expect(page.getByText(`${shopName} is turned off.`)).toBeVisible();
  await owner.goto("/items");
  await expect(owner).toHaveURL(/\/login\?reason=inactive/);
  await login(owner, username, password);
  await expect(owner.getByText(/This login or shop has been turned off/)).toBeVisible();

  // ...and back on.
  await page.getByRole("button", { name: "Turn shop back on" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Turn shop back on" }).click();
  await expect(page.getByText(`${shopName} is on again.`)).toBeVisible();
  await login(owner, username, password);
  await expect(owner.getByRole("heading", { name: "Namaste, E2E" })).toBeVisible();
  await ownerContext.close();
});

test("the platform admin never sees shop pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "same check on both sizes");
  await loginAsPlatformAdmin(page);
  await page.goto("/items");
  await expect(page).toHaveURL(/\/platform$/);
});

test("shop owners have a Shop settings page", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Shop settings" })).toBeVisible();
  await expect(page.getByLabel("Shop name")).toHaveValue("PRANTIK Stationers");
});
