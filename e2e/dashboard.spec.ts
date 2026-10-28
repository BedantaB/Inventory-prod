import { expect, test } from "@playwright/test";
import { creds, login, loginAsOwner } from "./helpers";

test("the owner's Home shows sales, stock value, low stock and recent activity", async ({
  page,
}) => {
  await loginAsOwner(page);
  await expect(page.getByText("Today's sales")).toBeVisible();
  await expect(page.getByText(/^Orders today: \d+$/)).toBeVisible();
  await expect(page.getByText("Stock value", { exact: true })).toBeVisible();

  const low = page.locator("section", {
    has: page.getByRole("heading", { name: "Low or out of stock" }),
  });
  await expect(low.getByRole("link", { name: /Superio Pencils/ })).toBeVisible(); // out of stock
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();

  await page.getByRole("link", { name: /Needs attention/ }).click();
  await expect(page).toHaveURL(/\/items\?sort=stock-asc/);
});

test("staff see the same Home without the stock value", async ({ page }) => {
  await login(page, "ramesh", creds.staffPassword);
  await expect(page.getByText("Today's sales")).toBeVisible();
  await expect(page.getByText("Stock value", { exact: true })).toHaveCount(0);
  await page
    .getByRole("link", { name: /New Order/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/orders\/new$/);
});
