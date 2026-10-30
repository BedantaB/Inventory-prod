import { expect, test, type Page } from "@playwright/test";
import {
  cleanupTestData,
  createTestCustomer,
  createTestItem,
  creds,
  login,
  loginAsOwner,
} from "./helpers";

// Owner-only fixes: correcting stock and cancelling an order. Throwaway data, removed in afterAll.
const stamp = Date.now();

test.afterAll(async () => {
  await cleanupTestData();
});

function currentStock(page: Page) {
  return page.getByText("Stock now", { exact: true }).locator("xpath=following-sibling::p[1]");
}

test("owner corrects stock with a reason; it shows in the history", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes data; run once");
  const name = `E2E Correct Item ${stamp}`;
  const id = await createTestItem(name, "pcs", { qty: 10, costPaise: 1500 });

  await loginAsOwner(page);
  await page.goto(`/items/${id}`);
  await page.getByRole("button", { name: "Correct stock" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("The app says: 10 pcs");
  await dialog.getByLabel("Counted quantity (pcs)").fill("7");
  await expect(dialog.getByText("Change: −3 pcs")).toBeVisible();

  // A reason is required.
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText("Choose why the stock is different.")).toBeVisible();
  await dialog.getByLabel("Damaged").check();
  await dialog.getByRole("button", { name: "Save correction" }).click();

  await expect(page.getByText("Stock corrected. It is now 7.")).toBeVisible();
  await expect(currentStock(page)).toContainText("7 pcs");
  const history = page.getByRole("region", { name: "Stock history" });
  await expect(history.getByText("Corrected").first()).toBeVisible();
  await expect(history.getByText("Damaged")).toBeVisible();
});

test("owner cancels an order: stock comes back and the order stays, marked Cancelled", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes data; run once");
  const item = `E2E Cancel Item ${stamp}`;
  const customer = `E2E Cancel Shop ${stamp}`;
  const itemId = await createTestItem(item, "pcs", { qty: 10, costPaise: 1500 });
  await createTestCustomer(customer);

  await loginAsOwner(page);
  await page.goto("/orders/new");
  await page.getByRole("button", { name: "Start new order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await page.getByRole("combobox", { name: "Customer" }).fill(customer);
  await page.getByRole("option", { name: new RegExp(customer) }).click();
  const box = page.getByRole("combobox", { name: "Add items" }).filter({ visible: true });
  await box.fill(item);
  await page.getByRole("option", { name: new RegExp(item) }).click();
  const line = page
    .getByRole("list", { name: "Items in this order" })
    .filter({ visible: true })
    .getByRole("listitem")
    .filter({ hasText: item });
  await line.getByLabel("Quantity (pcs)").fill("4");
  await expect(page.getByText("All changes saved").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order complete. Stock has been updated.")).toBeVisible();
  const orderUrl = page.url();

  // Cancel, with a reason.
  await page.getByRole("button", { name: "Cancel order" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(dialog.getByText("Write why the order is cancelled.")).toBeVisible();
  await dialog.getByLabel("Why is it cancelled?").fill("Customer returned the goods");
  await dialog.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(page.getByText(/cancelled\. The items are back in stock\./)).toBeVisible();
  await expect(page.getByText("Reason: Customer returned the goods")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

  // The stock is back, and the history says why.
  await page.goto(`/items/${itemId}`);
  await expect(currentStock(page)).toContainText("10 pcs");
  await expect(
    page.getByRole("region", { name: "Stock history" }).getByText("Order cancelled"),
  ).toBeVisible();

  // Still listed, marked Cancelled, under the "Cancelled only" filter.
  await page.goto("/orders?status=cancelled");
  const row = page.getByRole("link", { name: new RegExp(customer) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Cancelled")).toBeVisible();

  // Staff can open it but can't cancel or correct anything.
  await page.context().clearCookies();
  await login(page, "sunita", creds.staffPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
  await page.goto(orderUrl);
  await expect(page.getByText("Reason: Customer returned the goods")).toBeVisible();
  await page.goto(`/items/${itemId}`);
  await expect(page.getByRole("heading", { name: item })).toBeVisible();
  await expect(page.getByRole("button", { name: "Correct stock" })).toHaveCount(0);
});
