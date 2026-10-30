import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestCustomer,
  createTestItem,
  creds,
  login,
  loginAsOwner,
} from "./helpers";

// Payments and what customers owe. Throwaway data (names start with "E2E"), removed in afterAll.
const stamp = Date.now();

test.afterAll(async () => {
  await cleanupTestData();
});

test("paid now at checkout, record and void payments, and see who owes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes data; run once");
  const item = `E2E Pay Item ${stamp}`; // usual price ₹20
  const customer = `E2E Pay Shop ${stamp}`;
  await createTestItem(item, "pcs", { qty: 50, costPaise: 1000 });
  const customerId = await createTestCustomer(customer);
  const outstanding = page.getByTestId("customer-outstanding");

  // Staff: 5 × ₹20 = ₹100, of which ₹40 paid now by UPI.
  await login(page, "ramesh", creds.staffPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
  await page.goto("/orders/new");
  await page.getByRole("button", { name: "Start new order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await page.getByRole("combobox", { name: "Customer" }).fill(customer);
  await page.getByRole("option", { name: new RegExp(customer) }).click();
  await page.getByRole("combobox", { name: "Add items" }).filter({ visible: true }).fill(item);
  await page.getByRole("option", { name: new RegExp(item) }).click();
  const line = page
    .getByRole("list", { name: "Items in this order" })
    .filter({ visible: true })
    .getByRole("listitem")
    .filter({ hasText: item });
  await line.getByLabel("Quantity (pcs)").fill("5");
  await expect(page.getByText("All changes saved").filter({ visible: true })).toBeVisible();

  const paid = page.getByLabel(/^Paid now/).filter({ visible: true });
  await paid.fill("150");
  await expect(page.getByText("Paid now can't be more than the order total.")).toBeVisible();
  await paid.fill("40");
  await page.getByRole("radio", { name: "UPI" }).click();
  await expect(page.getByText(/Still to pay: ₹60\.00/)).toBeVisible();
  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order complete. Stock has been updated.")).toBeVisible();
  await expect(page.getByText("Balance due")).toBeVisible();
  await expect(page.getByText("₹60.00").first()).toBeVisible();

  // The customer owes ₹60; staff record ₹25 cash.
  await page.goto(`/customers/${customerId}`);
  await expect(outstanding).toHaveText("₹60.00");
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount received").fill("25");
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText("Payment of ₹25.00 saved.")).toBeVisible();
  await expect(outstanding).toHaveText("₹35.00");
  const payments = page.getByRole("region", { name: "Payments" });
  await expect(payments.getByText(/With order ORD-/)).toBeVisible();
  await expect(payments.getByRole("button", { name: "Void" })).toHaveCount(0); // owner only

  // Owner voids the ₹25 payment (entered by mistake).
  await page.context().clearCookies();
  await loginAsOwner(page);
  await page.goto(`/customers/${customerId}`);
  const cashRow = payments.getByRole("listitem").filter({ hasText: "Cash" });
  await cashRow.getByRole("button", { name: "Void" }).click();
  const voidDialog = page.getByRole("dialog");
  await voidDialog.getByLabel("Why is it wrong?").fill("Entered by mistake");
  await voidDialog.getByRole("button", { name: "Void payment" }).click();
  await expect(page.getByText("Payment of ₹25.00 voided.")).toBeVisible();
  await expect(outstanding).toHaveText("₹60.00");
  await expect(cashRow.getByText("Voided by Shop Owner: Entered by mistake")).toBeVisible();

  // Customers who owe, most first.
  await page.goto(`/customers?dues=owing&sort=dues&q=${encodeURIComponent(customer)}`);
  await expect(
    page.getByRole("link", { name: new RegExp(customer) }).getByText("Due ₹60.00"),
  ).toBeVisible();
});
