import { expect, test } from "@playwright/test";
import { cleanupTestData, creds, login, loginAsOwner } from "./helpers";

test.afterAll(async () => {
  await cleanupTestData();
});

test("staff find a customer by phone number and can call them", async ({ page }) => {
  await login(page, "sunita", creds.staffPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
  await page.goto("/customers");
  await page.getByRole("searchbox").fill("94360 12345");
  await expect(page.getByRole("link", { name: /^Sarkar Book Stall/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call Sarkar Book Stall" })).toHaveAttribute(
    "href",
    "tel:+919436012345",
  );
  await page.getByRole("link", { name: /^Sarkar Book Stall/ }).click();
  await expect(page.getByText("No orders yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive customer" })).toHaveCount(0);
});

test("owner adds, edits and archives a customer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes data; run once");
  const name = `E2E Gupta Stores ${Date.now()}`;
  await loginAsOwner(page);
  await page.goto("/customers/new");

  await page.getByLabel("Business / shop name").fill(name);
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByLabel("City").focus(); // leaving the field checks it
  await expect(
    page.getByText("Enter a 10-digit mobile number starting with 6, 7, 8 or 9."),
  ).toBeVisible();
  await page.getByLabel("Mobile number").fill("098765-43210");
  await page.getByLabel("City").fill("Indore");
  await page.getByRole("button", { name: "Add customer" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("link", { name: "+91 98765 43210" })).toBeVisible();

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();
  // Next keeps the previous page mounted (hidden), so pick the visible City box.
  await page.getByLabel("City").filter({ visible: true }).fill("Ujjain");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Ujjain", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Archive customer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive customer" }).click();
  await expect(page.getByText("This customer is archived.")).toBeVisible();
  await page.goto(`/customers?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("No customers match your search")).toBeVisible();
});
