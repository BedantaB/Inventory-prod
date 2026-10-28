import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner } from "./helpers";

/**
 * Fails on serious or critical accessibility problems (WCAG 2.1 A/AA rules), and on pages
 * that are wider than the screen (sideways scrolling on a phone).
 */
async function expectAccessible(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: page is ${overflow}px wider than the screen`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const problems = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${label}: ${v.id} (${v.impact}) — ${v.help}\n    ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join("\n    ")}`,
    );
  expect(problems, problems.join("\n")).toEqual([]);
}

test("login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expectAccessible(page, "login");
});

test("main screens", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  const pages: [string, string, RegExp | string][] = [
    ["/", "home", /^Namaste/],
    ["/items", "items", "Items"],
    ["/items/new", "new item", "New item"],
    ["/items/units", "units", "Units"],
    ["/items/import", "import", "Import items"],
    ["/stock/new", "add stock", "Add Stock"],
    ["/orders/new", "new order", "New Order"],
    ["/orders", "orders", "Orders"],
    ["/customers", "customers", "Customers"],
    ["/customers/new", "new customer", "New customer"],
    ["/users", "users", "Staff & Logins"],
  ];
  for (const [path, label, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectAccessible(page, label);
  }

  // A detail page of each kind.
  await page.goto("/items?q=glue+stick");
  await page
    .getByRole("link", { name: /Glue Stick/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Stock history" })).toBeVisible();
  await expectAccessible(page, "item page");

  // The cart (an empty new order), then throw it away again.
  await page.goto("/orders/new");
  await page.getByRole("button", { name: "Start new order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await expectAccessible(page, "cart");
  await page.getByRole("button", { name: "Throw away this order" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Throw away this order" })
    .click();
  await expect(page).toHaveURL(/\/orders\/new$/);

  await page.goto("/customers?q=sarkar");
  await page.getByRole("link", { name: /^Sarkar Book Stall/ }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expectAccessible(page, "customer page");
});
