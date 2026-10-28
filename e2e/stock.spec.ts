import { expect, test } from "@playwright/test";
import { cleanupTestData, createTestItem, creds, isMobile, login, loginAsOwner } from "./helpers";

// Each run uses its own throwaway items (removed again in afterAll).
const stamp = Date.now();

test.afterAll(async () => {
  await cleanupTestData();
});

test("stock form explains what's missing", async ({ page }) => {
  await login(page, "ramesh", creds.staffPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
  await page.goto("/stock/new");
  await page.getByRole("button", { name: "Add stock" }).click();
  await expect(page.getByText("Choose an item")).toBeVisible();
  await expect(page.getByText("Please fill this in.")).toBeVisible();
  await expect(page.getByText("Enter the cost price from the bill (0 if free).")).toBeVisible();
});

test("staff add a bill with two items; stock and history update", async ({ page }, testInfo) => {
  const tag = `${stamp}-${testInfo.project.name}`;
  const pens = `E2E Pens ${tag}`;
  const files = `E2E Files ${tag}`;
  await createTestItem(pens);
  await createTestItem(files);

  await login(page, "ramesh", creds.staffPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
  await page.goto("/stock/new");
  await page.getByLabel(/Bill \/ invoice number/).fill(`E2E-BILL-${tag}`);

  // Line 1: search, pick with the keyboard (desktop) or a tap (phone).
  const picker = page.getByRole("combobox", { name: "Item" });
  await picker.first().fill(pens);
  const option = page.getByRole("option", { name: new RegExp(pens) });
  await expect(option).toBeVisible();
  if (isMobile(page)) await option.click();
  else await picker.first().press("Enter");
  const qty1 = page.getByLabel("Quantity (pcs)").first();
  if (!isMobile(page)) await expect(qty1).toBeFocused();
  await qty1.fill("50");
  await page.getByLabel("Cost price per pcs (₹)").first().fill("19");
  await expect(page.getByText("₹950.00", { exact: true })).toBeVisible(); // line total

  // Line 2.
  await page.getByRole("button", { name: "Add another item" }).click();
  await page.getByRole("combobox", { name: "Item" }).last().fill(files);
  await page.getByRole("option", { name: new RegExp(files) }).click();
  await page.getByLabel("Quantity (pcs)").nth(1).fill("2.5");
  await page.getByLabel("Cost price per pcs (₹)").nth(1).fill("40");
  await page.getByRole("button", { name: "Add stock" }).click();
  await expect(page.getByText("This unit uses whole numbers only (no decimals).")).toBeVisible();
  await page.getByLabel("Quantity (pcs)").nth(1).fill("5");
  await expect(page.getByText("Items: 2 · Total cost ₹1,150.00")).toBeVisible();
  await page.getByRole("button", { name: "Add stock" }).click();

  // Summary page: staff see quantities but not costs.
  await expect(page.getByRole("heading", { name: "Stock added" })).toBeVisible();
  await expect(page.getByText(`E2E-BILL-${tag}`)).toBeVisible();
  await expect(page.getByText("+50 pcs")).toBeVisible();
  await expect(page.getByText("+5 pcs")).toBeVisible();
  await expect(page.getByText(/Cost ₹19.00 each/)).toHaveCount(0);

  // Item page: stock went up and the history shows the bill.
  await page.getByRole("link", { name: new RegExp(pens) }).click();
  await expect(page.getByText("50 pcs", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `E2E-BILL-${tag}` })).toBeVisible();
  await expect(page.getByText("by Ramesh Kumar").first()).toBeVisible();
});

test("owner sees costs, gets the last cost pre-filled, and the average updates", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes data; run once");
  const name = `E2E Crayons ${stamp}`;
  await createTestItem(name);
  await loginAsOwner(page);

  // First bill: 10 @ ₹20.
  await page.goto("/stock/new");
  await page.getByRole("combobox", { name: "Item" }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.getByLabel("Quantity (pcs)").fill("10");
  await page.getByLabel("Cost price per pcs (₹)").fill("20");
  await page.getByRole("button", { name: "Add stock" }).click();
  await expect(page.getByText("Cost ₹20.00 each")).toBeVisible();
  await expect(page.getByText(/Total cost: ₹200.00/)).toBeVisible();

  // Second bill: the form starts empty again (not showing the bill just saved),
  // and the cost box starts with the last cost, ₹20. Change to ₹26 for 5 more.
  await page.getByRole("link", { name: "Add more stock" }).click();
  await expect(page.getByRole("heading", { name: "Add Stock" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Item" }).filter({ visible: true })).toHaveValue(
    "",
  );
  await expect(page.getByText("Items: 0 · Total cost ₹0.00")).toBeVisible();
  const picker = page.getByRole("combobox", { name: "Item" }).filter({ visible: true });
  await picker.fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  const cost = page.getByLabel("Cost price per pcs (₹)").filter({ visible: true });
  await expect(cost).toHaveValue("20");
  await page.getByLabel("Quantity (pcs)").filter({ visible: true }).fill("5");
  await cost.fill("26");
  await page.getByRole("button", { name: "Add stock" }).filter({ visible: true }).click();
  await expect(page.getByText("Cost ₹26.00 each")).toBeVisible();

  // (10 × 20 + 5 × 26) / 15 = ₹22.00
  await page
    .getByRole("link", { name: new RegExp(name) })
    .filter({ visible: true })
    .click();
  await expect(page.getByText("₹22.00", { exact: true })).toBeVisible();
  await expect(page.getByText("15 pcs", { exact: true }).filter({ visible: true })).toBeVisible();
});
