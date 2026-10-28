import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it.each(["/login", "/forgot-password", "/auth/callback", "/auth/signout"])(
    "%s is public",
    (p) => {
      expect(isPublicPath(p)).toBe(true);
    },
  );
  it.each(["/", "/items", "/users", "/reset-password", "/loginx"])("%s needs a login", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/items?q=dal")).toBe("/items?q=dal");
  });
  it.each([undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "/login"])(
    "falls back to home for %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/");
    },
  );
});
