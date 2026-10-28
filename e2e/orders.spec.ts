import { expect, test, type Page } from "@playwright/test";
import {
  cleanupTestData,
  createTestCustomer,
  createTestItem,
  creds,
  login,
  loginAsOwner,
} from "./helpers";

// Throwaway items and customers per run (removed in afterAll). Items: MRP ₹25, usual price ₹20.
const stamp = Date.now();

test.afterAll(async () => {
  await cleanupTestData();
});

async function loginStaff(page: Page) {
  await login(page, "sunita", creds.staffPassword);
  await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
}

async function startOrder(page: Page) {
  await page.goto("/orders/new");
  await page.getByRole("button", { name: "Start new order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
}

async function addItem(page: Page, name: string) {
  const box = page.getByRole("combobox", { name: "Add items" }).filter({ visible: true });
  await box.fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await expect(line(page, name)).toBeVisible();
}

/** One line of the cart (not the "added" message, which also mentions the item). */
function line(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Items in this order" })
    .filter({ visible: true })
    .getByRole("listitem")
    .filter({ hasText: name });
}

async function waitSaved(page: Page) {
  await expect(page.getByText("All changes saved").filter({ visible: true })).toBeVisible();
}

test("staff take an order: new customer, two items, discount; it survives a refresh and completes", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const tag = `${stamp}-${testInfo.project.name}`;
  const pens = `E2E Order Pens ${tag}`;
  const books = `E2E Order Books ${tag}`;
  await createTestItem(pens, "pcs", { qty: 100, costPaise: 1500 });
  await createTestItem(books, "pcs", { qty: 50, costPaise: 1200 });
  await loginStaff(page);
  await startOrder(page);

  // A new customer, added without leaving the cart.
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByRole("dialog").getByLabel("Business / shop name").fill(`E2E Shop ${tag}`);
  await page.getByRole("dialog").getByLabel("Mobile number").fill("98765 43210");
  await page.getByRole("dialog").getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByText(`E2E Shop ${tag}`, { exact: true })).toBeVisible();

  // Item 1: price starts at the usual ₹20; + then type 5.
  await addItem(page, pens);
  await expect(line(page, pens).getByLabel("Price per pcs (₹)")).toHaveValue("20");
  await line(page, pens)
    .getByRole("button", { name: `One more ${pens}` })
    .click();
  await expect(line(page, pens).getByLabel("Quantity (pcs)")).toHaveValue("2");
  await line(page, pens).getByLabel("Quantity (pcs)").fill("5");

  // Item 2 at a special price.
  await addItem(page, books);
  await line(page, books).getByLabel("Quantity (pcs)").fill("3");
  await line(page, books).getByLabel("Price per pcs (₹)").fill("18");

  // 10% off: (5 × 20 + 3 × 18) = 154 → −15.40 → ₹138.60
  await page.getByRole("radio", { name: "%" }).click();
  await page.getByLabel("Discount", { exact: true }).filter({ visible: true }).fill("10");
  await expect(page.getByTestId("cart-total").filter({ visible: true })).toHaveText("₹138.60");
  await waitSaved(page);

  // The cart is saved: a refresh brings everything back.
  await page.reload();
  await expect(line(page, pens).getByLabel("Quantity (pcs)")).toHaveValue("5");
  await expect(line(page, books).getByLabel("Price per pcs (₹)")).toHaveValue("18");
  await expect(page.getByTestId("cart-total")).toHaveText("₹138.60");

  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page).toHaveURL(/\?done=1$/);
  await expect(page.getByText("Order complete. Stock has been updated.")).toBeVisible();
  const heading = page.getByRole("heading", { name: /^Order ORD-\d{4}-\d{2}-\d{5}$/ });
  await expect(heading).toBeVisible();
  const number = (await heading.textContent())!.replace("Order ", "");
  await expect(page.getByText("₹138.60").first()).toBeVisible();
  await expect(page.getByText(/Cost ₹/)).toHaveCount(0); // staff don't see costs

  // Print opens the browser's print window.
  await page.evaluate(() => {
    (window as unknown as { printed: boolean }).printed = false;
    window.print = () => ((window as unknown as { printed: boolean }).printed = true);
  });
  await page.getByRole("button", { name: "Print" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: boolean }).printed)).toBe(true);

  // Stock went down, and the sale is in the item's history.
  await page.goto(`/items?q=${encodeURIComponent(pens)}`);
  await expect(page.getByText("95 pcs")).toBeVisible();

  // The order is in the list, found by its number.
  await page.goto(`/orders?q=${number}`);
  await expect(page.getByRole("link", { name: new RegExp(`E2E Shop ${tag}`) })).toBeVisible();
});

test("not enough stock: nothing is sold, short items are listed and can be fixed", async ({
  page,
}, testInfo) => {
  const tag = `${stamp}-${testInfo.project.name}`;
  const rare = `E2E Rare Item ${tag}`;
  const plenty = `E2E Plenty Item ${tag}`;
  await createTestItem(rare, "pcs", { qty: 3, costPaise: 1000 });
  await createTestItem(plenty, "pcs", { qty: 100, costPaise: 1000 });
  await createTestCustomer(`E2E Short Shop ${tag}`);
  await loginStaff(page);
  await startOrder(page);

  await page.getByRole("combobox", { name: "Customer" }).fill(`E2E Short Shop ${tag}`);
  await page.getByRole("option", { name: new RegExp(`E2E Short Shop ${tag}`) }).click();
  await addItem(page, rare);
  await line(page, rare).getByLabel("Quantity (pcs)").fill("10");
  await addItem(page, plenty);
  await line(page, plenty).getByLabel("Quantity (pcs)").fill("4");
  await waitSaved(page);

  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Not enough stock — nothing was sold" }),
  ).toBeVisible();
  await expect(line(page, rare).getByText(/you want 10 pcs, only 3 pcs in stock/)).toBeVisible();

  // Nothing was taken from the item that did have enough.
  await expect(line(page, plenty).getByText("In stock: 100 pcs")).toBeVisible();

  await line(page, rare).getByRole("button", { name: "Change to 3 pcs" }).click();
  await expect(line(page, rare).getByLabel("Quantity (pcs)")).toHaveValue("3");
  await page.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order complete. Stock has been updated.")).toBeVisible();
});

test("price warnings: above MRP for everyone, below cost only for the owner", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "same checks on both sizes");
  const item = `E2E Priced Item ${stamp}`;
  await createTestItem(item, "pcs", { qty: 10, costPaise: 1500 }); // cost ₹15, MRP ₹25
  await loginAsOwner(page);
  await startOrder(page);
  await addItem(page, item);
  const price = line(page, item).getByLabel("Price per pcs (₹)");

  await price.fill("30");
  await expect(line(page, item).getByText(/Price is above MRP \(₹25.00\)/)).toBeVisible();
  await price.fill("12");
  await expect(line(page, item).getByText(/Price is below cost \(₹15.00\)/)).toBeVisible();
  await price.fill("");
  await expect(line(page, item).getByText("Enter a price.")).toBeVisible();

  // Throw the unfinished order away.
  await page.getByRole("button", { name: "Throw away this order" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Throw away this order" })
    .click();
  await expect(page).toHaveURL(/\/orders\/new$/);
});

test("staff don't get below-cost warnings", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "same checks on both sizes");
  const item = `E2E Staff Priced ${stamp}`;
  await createTestItem(item, "pcs", { qty: 10, costPaise: 1500 });
  await loginStaff(page);
  await startOrder(page);
  await addItem(page, item);
  await line(page, item).getByLabel("Price per pcs (₹)").fill("12");
  await expect(line(page, item).getByText(/below cost/)).toHaveCount(0);
});

test("orders list filters by date and opens from the customer page", async ({ page }) => {
  await loginStaff(page);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  await page.goto(`/orders?from=${today}&to=${today}`);
  await expect(page.getByText(/^Orders: \d+ · Total ₹/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Dey Stationers/ })).toBeVisible(); // sample order from today

  await page.goto("/customers?q=sarkar");
  await page.getByRole("link", { name: /^Sarkar Book Stall/ }).click();
  await page.getByRole("link", { name: /^Orders: \d+ · ₹/ }).click();
  await expect(page.getByRole("button", { name: /Customer: Sarkar Book Stall/ })).toBeVisible();
});
