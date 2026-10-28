import { describe, expect, it } from "vitest";
import { isActive, visibleItems } from "./nav-items";

describe("isActive", () => {
  it("matches Home only on /", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/items")).toBe(false);
  });
  it("separates New Order from Orders", () => {
    expect(isActive("/orders/new", "/orders/new")).toBe(true);
    expect(isActive("/orders", "/orders/new")).toBe(false);
    expect(isActive("/orders", "/orders/123")).toBe(true);
  });
  it("matches sub-pages", () => {
    expect(isActive("/items", "/items/abc/edit")).toBe(true);
    expect(isActive("/items", "/itemsx")).toBe(false);
  });
});

describe("visibleItems", () => {
  it("hides Staff & Logins from staff", () => {
    expect(visibleItems(false).map((i) => i.href)).not.toContain("/users");
    expect(visibleItems(true).map((i) => i.href)).toContain("/users");
  });
});
