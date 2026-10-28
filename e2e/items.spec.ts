import { expect, test } from "@playwright/test";
import { cleanupTestData, creds, login, loginAsOwner, testPng } from "./helpers";

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("items (staff)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "ramesh", creds.staffPassword);
    await expect(page.getByRole("heading", { name: /^Namaste/ })).toBeVisible();
    await page.goto("/items");
  });

  test("search filters as you type", async ({ page }) => {
    await page.getByRole("searchbox").fill("dal toor");
    await expect(page).toHaveURL(/q=dal\+toor/);
    await expect(page.getByRole("link", { name: /Toor Dal/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Chana Dal/ })).toHaveCount(0);
  });

  test("filter by stock level and see warnings", async ({ page }) => {
    await page.getByLabel("Stock", { exact: true }).selectOption("out");
    await expect(page).toHaveURL(/stock=out/);
    await expect(page.getByRole("link", { name: /Elaichi/ })).toBeVisible();
    await expect(page.getByRole("list").getByText("Out of stock").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Toor Dal/ })).toHaveCount(0);
  });

  test("pages through the list", async ({ page }) => {
    await expect(page.getByText(/Showing 1–20 of \d+/)).toBeVisible();
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Showing 21–40 of \d+/)).toBeVisible();
  });

  test("staff don't see costs and can't change an existing price", async ({ page }) => {
    await page.getByRole("searchbox").fill("basmati");
    await page.getByRole("link", { name: /Basmati Rice Premium/ }).click();
    await expect(page.getByText("Stock now")).toBeVisible();
    await expect(page.getByText("Average cost")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archive item" })).toHaveCount(0);

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByLabel(/Usual selling price/)).toBeDisabled();
    await expect(page.getByText("Only the owner can change the selling price.")).toBeVisible();
  });
});

test.describe("items (owner)", () => {
  test("shows the weighted average cost and stock value", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/items?q=basmati");
    await page.getByRole("link", { name: /Basmati Rice Premium/ }).click();
    await expect(page.getByText("70 pcs")).toBeVisible();
    await expect(page.getByText("₹2,167.14", { exact: true })).toBeVisible(); // (40 × 2150 + 30 × 2190) / 70
    await expect(page.getByText("₹1,51,699.80", { exact: true })).toBeVisible(); // 70 × ₹2,167.14
  });

  test("adds an item with a photo and a new category, then archives it", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "changes data; run once");
    const name = `E2E Kaju ${Date.now()}`;
    const category = `E2E Dry Fruits ${Date.now()}`;
    await loginAsOwner(page);
    await page.goto("/items/new");

    // Inline errors before anything is sent.
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Please fill this in.")).toBeVisible();

    await page.getByLabel("Item name").fill(name);
    await page.getByLabel("Unit").selectOption({ label: "Pieces (pcs)" });
    await page.getByLabel("Warn me when stock falls to").fill("2.5");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("This unit uses whole numbers only (no decimals).")).toBeVisible();

    await page.getByLabel("Unit").selectOption({ label: "Kilogram (kg)" });
    await page.getByRole("button", { name: "New category" }).click();
    await page.getByLabel("Category name").fill(category);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    const categorySelect = page.getByRole("combobox", { name: "Category (optional)" });
    await expect(categorySelect).toHaveValue(/[0-9a-f-]{36}/);
    await expect(categorySelect.locator("option:checked")).toHaveText(category);

    await page.getByLabel(/Usual selling price/).fill("950");
    await page.locator('input[type="file"]').setInputFiles(testPng());
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await page.getByRole("button", { name: "Add item" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("₹950.00")).toBeVisible();
    await expect(page.getByText(/^ITM-\d{5}$/)).toBeVisible();
    const photo = page.getByRole("img", { name });
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Archive, check it's hidden, bring it back.
    await page.getByRole("button", { name: "Archive item" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive item" }).click();
    await expect(page.getByText("This item is archived.")).toBeVisible();
    await page.goto(`/items?q=${encodeURIComponent(name)}`);
    await expect(page.getByText("No items match your search")).toBeVisible();
    await page.getByLabel("Stock", { exact: true }).selectOption("archived");
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "Bring back item" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Bring back item" }).click();
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  });

  test("photos are private", async ({ page }) => {
    const response = await page.request.get(
      "/photos/items/00000000-0000-0000-0000-000000000000.jpg",
    );
    expect(response.status()).toBe(401);
  });
});
