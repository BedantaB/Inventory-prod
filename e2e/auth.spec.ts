import { expect, test } from "@playwright/test";
import {
  creds,
  deleteLoginByEmail,
  isMobile,
  login,
  loginAsOwner,
  logout,
  openMenu,
} from "./helpers";

test.describe("login", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    await page.goto("/items");
    await expect(page).toHaveURL(/\/login\?next=%2Fitems$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("shows inline errors for empty fields", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Please fill this in.")).toHaveCount(2);
  });

  test("a wrong password gets a friendly message", async ({ page }) => {
    await login(page, "ramesh", "definitely-wrong");
    await expect(page.getByText(/Wrong username or password/)).toBeVisible();
    await expect(page.getByLabel("Username or email")).toHaveValue("ramesh");
  });

  test("Enter in the username box moves to the password box", async ({ page }) => {
    test.skip(isMobile(page), "keyboard flow is for the desktop counter");
    await page.goto("/login");
    await page.getByLabel("Username or email").fill("ramesh");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  });

  test("staff log in with a username and cannot open owner pages", async ({ page }) => {
    await login(page, "Ramesh", creds.staffPassword);
    await expect(page.getByRole("heading", { name: "Namaste, Ramesh" })).toBeVisible();

    await openMenu(page);
    await expect(page.getByRole("link", { name: "Staff & Logins" })).toHaveCount(0);

    await page.goto("/users");
    await expect(page).toHaveURL(/\/\?denied=1$/);
    await expect(page.getByText("Only the owner can open that page.")).toBeVisible();
  });

  test("after logging in, people land on the page they asked for", async ({ page }) => {
    await page.goto("/customers");
    await login(page, "sunita", creds.staffPassword);
    await expect(page).toHaveURL(/\/customers$/);
  });

  test("the owner logs in with email, sees staff logins, and logs out", async ({ page }) => {
    await loginAsOwner(page);
    await openMenu(page);
    await page.getByRole("link", { name: "Staff & Logins" }).first().click();
    await expect(page.getByRole("heading", { name: "Staff & Logins" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ramesh Kumar/ })).toBeVisible();

    await page.getByRole("searchbox").fill("sun");
    await expect(page).toHaveURL(/q=sun/);
    await expect(page.getByRole("link", { name: /Ramesh Kumar/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Sunita Devi/ })).toBeVisible();

    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("managing staff logins", () => {
  // Ends in a letter, so the suggested alternative is predictable (username + "2").
  const username = `e2e${Date.now().toString(36)}x`;
  const password = "e2e-pass-1234";

  test.afterAll(async () => {
    await deleteLoginByEmail(`${username}@${process.env.STAFF_EMAIL_DOMAIN}`);
  });

  test("owner creates a login, it works, and turning it off ends the session", async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "changes data; run once");

    // Owner creates the login.
    await loginAsOwner(page);
    await page.goto("/users/new");
    await page.getByLabel("Full name").fill("Test Cashier");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Add staff login" }).click();
    await expect(page.getByText(/Login created for Test Cashier/)).toBeVisible();
    await expect(page).toHaveURL(/\/users$/);

    // Using the same username again suggests another one.
    await page.goto("/users/new");
    await page.getByLabel("Full name").fill("Duplicate");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Add staff login" }).click();
    await expect(
      page.getByText(new RegExp(`already used. Try another, e.g. ${username}2`)),
    ).toBeVisible();

    // The new person logs in on their own phone.
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await login(staffPage, username, password);
    await expect(staffPage.getByRole("heading", { name: "Namaste, Test" })).toBeVisible();

    // Owner turns the login off (with a confirmation step).
    await page.goto("/users");
    await page.getByRole("link", { name: /Test Cashier/ }).click();
    await page.getByRole("button", { name: "Turn off login" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Turn off Test Cashier's login?");
    await page.getByRole("alertdialog").getByRole("button", { name: "Turn off login" }).click();
    await expect(page.getByText("Test Cashier's login is turned off.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn login back on" })).toBeVisible();

    // Their open session stops working on the next page they open...
    await staffPage.goto("/items");
    await expect(staffPage).toHaveURL(/\/login\?reason=inactive/);
    await expect(staffPage.getByText(/login was turned off/)).toBeVisible();

    // ...and they cannot log in again.
    await login(staffPage, username, password);
    await expect(staffPage.getByText(/This login or shop has been turned off/)).toBeVisible();
    await staffContext.close();
  });

  test("the owner cannot turn off their own login", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "same check on both sizes");
    await loginAsOwner(page);
    await page.goto("/users");
    await page.getByRole("link", { name: /\(You\)/ }).click();
    await expect(page.getByRole("button", { name: "Reset password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn off login" })).toHaveCount(0);
    await expect(page.getByText("You cannot change your own role.")).toBeVisible();
  });
});
