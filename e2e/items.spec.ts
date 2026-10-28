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

  test("search by name and colour, in any order", async ({ page }) => {
    await page.getByRole("searchbox").fill("blue marker permanent");
    await expect(page).toHaveURL(/q=blue\+marker\+permanent/);
    await expect(page.getByRole("link", { name: /Permanent Marker – Blue/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Permanent Marker – Black/ })).toHaveCount(0);
  });

  test("search by pack size", async ({ page }) => {
    await page.getByRole("searchbox").fill("glue 45");
    await expect(page.getByRole("link", { name: /White Glue/ })).toHaveCount(1);
    await expect(page.getByText("45 g", { exact: false }).first()).toBeVisible();
  });

  test("filter by stock level and see warnings", async ({ page }) => {
    await page.getByLabel("Stock", { exact: true }).selectOption("out");
    await expect(page).toHaveURL(/stock=out/);
    await expect(page.getByRole("link", { name: /Superio Pencils/ })).toBeVisible();
    await expect(page.getByRole("list").getByText("Out of stock").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Gum/ })).toHaveCount(0);
  });

  test("pages through the list", async ({ page }) => {
    await expect(page.getByText(/Showing 1–20 of 150/)).toBeVisible();
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Showing 21–40 of 150/)).toBeVisible();
  });

  test("staff see MRP but not costs, and can't change existing prices", async ({ page }) => {
    await page.getByRole("searchbox").fill("glue stick 8");
    await page.getByRole("link", { name: /Glue Stick/ }).click();
    await expect(page.getByText("Stock now", { exact: true })).toBeVisible();
    await expect(page.getByText("₹25.00", { exact: true })).toBeVisible(); // MRP
    await expect(page.getByText("Average cost")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archive item" })).toHaveCount(0);

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
    await expect(page.getByLabel(/^MRP/).filter({ visible: true })).toBeDisabled();
    await expect(page.getByLabel(/Usual selling price/).filter({ visible: true })).toBeDisabled();
  });
});

test.describe("items (owner)", () => {
  test("shows the weighted average cost and stock value", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/items?q=glue+stick+8");
    await page.getByRole("link", { name: /Glue Stick/ }).click();
    await expect(page.getByText("300 pcs")).toBeVisible();
    await expect(page.getByText("₹17.67", { exact: true })).toBeVisible(); // 200 @ 17.50 + 100 @ 18.00
    await expect(page.getByText("₹5,301.00", { exact: true })).toBeVisible(); // 300 × ₹17.67
  });

  test("adds an item with brand, MRP and photo, adds another colour, archives", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "changes data; run once");
    const stamp = Date.now();
    const name = `E2E Gel Pen ${stamp}`;
    const brand = `E2E Brand ${stamp}`;
    await loginAsOwner(page);
    await page.goto("/items/new");

    // Inline errors before anything is sent.
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Please fill this in.")).toBeVisible();

    await page.getByLabel("Item name").fill(name);
    await page.getByLabel(/Colour \/ variant/).fill("Blue");
    await page.getByLabel("Unit").selectOption({ label: "Pieces (pcs)" });
    await page.getByLabel("Warn me when stock falls to").fill("2.5");
    await page.getByLabel(/^MRP/).fill("10");
    await page.getByLabel(/Usual selling price/).fill("12");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("The selling price can't be more than the MRP.")).toBeVisible();
    await page.getByLabel(/Usual selling price/).fill("8.50");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("This unit uses whole numbers only (no decimals).")).toBeVisible();
    await page.getByLabel("Warn me when stock falls to").fill("20");

    await page.getByRole("button", { name: "New brand" }).click();
    await page.getByLabel("Brand name").fill(brand);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("combobox", { name: "Brand (optional)" }).locator("option:checked"),
    ).toHaveText(brand);

    await page.locator('input[type="file"]').setInputFiles(testPng());
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await page.getByRole("button", { name: "Add item" }).click();

    await expect(page.getByRole("heading", { name: `${name} – Blue` })).toBeVisible();
    await expect(page.getByText("₹10.00", { exact: true })).toBeVisible();
    await expect(page.getByText("₹8.50", { exact: true })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: brand })).toBeVisible();
    await expect(page.getByText(/^ITM-\d{5}$/)).toBeVisible();
    const photo = page.getByRole("img", { name: `${name} – Blue` });
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Another colour: everything is copied except colour, SKU and photo.
    await page.getByRole("link", { name: "Add another colour" }).click();
    await expect(page.getByRole("heading", { name: `New colour of ${name}` })).toBeVisible();
    const variant = page.getByLabel(/Colour \/ variant/).filter({ visible: true });
    await expect(variant).toBeFocused();
    await variant.fill("Red");
    await page.getByRole("button", { name: "Add item" }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: `${name} – Red` })).toBeVisible();
    // The Blue page is still mounted (hidden) by Next, so only look at what's visible.
    await expect(page.getByText("₹10.00", { exact: true }).filter({ visible: true })).toBeVisible();

    // Both colours show together in the list.
    await page.goto(`/items?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("link", { name: new RegExp(`${name} – (Blue|Red)`) })).toHaveCount(
      2,
    );

    // Archive one, check it's hidden, bring it back.
    await page.getByRole("link", { name: new RegExp(`${name} – Red`) }).click();
    await page.getByRole("button", { name: "Archive item" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archive item" }).click();
    await expect(page.getByText("This item is archived.")).toBeVisible();
    await page.goto(`/items?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(1);
    await page.getByLabel("Stock", { exact: true }).selectOption("archived");
    await page.getByRole("link", { name: new RegExp(`${name} – Red`) }).click();
    await page.getByRole("button", { name: "Bring back item" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Bring back item" }).click();
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  });

  test("imports items from a CSV file", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "changes data; run once");
    const stamp = Date.now();
    await loginAsOwner(page);
    await page.goto("/items");
    await page.getByRole("link", { name: "Import from spreadsheet" }).click();
    await expect(page.getByRole("heading", { name: "Import items" })).toBeVisible();
    const file = page.locator('input[type="file"]');

    // A sheet with mistakes lists each problem by row.
    await file.setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`Name,Unit,MRP\nE2E Ruler ${stamp},carton,10\n,pcs,5\n`),
    });
    await expect(page.getByText(/Unit “carton” not found/)).toBeVisible();
    await expect(page.getByText("Please fill this in.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Import \d+ items/ })).toHaveCount(0);

    // A good sheet imports in one go.
    await file.setInputFiles({
      name: "good.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        `Name,Colour/Variant,Brand,Unit,Pack size,MRP,Selling price\n` +
          `E2E Ruler ${stamp},Green,E2E Brand ${stamp},pcs,30 cm,12,10\n` +
          `E2E Ruler ${stamp},Yellow,E2E Brand ${stamp},pcs,30 cm,12,10\n`,
      ),
    });
    await expect(page.getByText("2 items are ready to import.")).toBeVisible();
    await expect(page.getByText(/1 new brands/)).toBeVisible();
    await page.getByRole("button", { name: "Import 2 items" }).click();
    await expect(page.getByText("2 items imported.")).toBeVisible();
    await expect(page).toHaveURL(/\/items\?sort=recent/);
    await expect(
      page.getByRole("link", { name: new RegExp(`E2E Ruler ${stamp} – Green`) }),
    ).toBeVisible();
  });

  test("photos are private", async ({ page }) => {
    const response = await page.request.get(
      "/photos/items/00000000-0000-0000-0000-000000000000.jpg",
    );
    expect(response.status()).toBe(401);
  });
});
