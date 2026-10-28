import { describe, expect, it } from "vitest";
import { USERNAME_PATTERN, loginEmail, staffEmail } from "./login-identity";

describe("login identity", () => {
  it("maps a username to the internal staff email", () => {
    expect(staffEmail(" Ramesh ", "staff.example.com")).toBe("ramesh@staff.example.com");
    expect(loginEmail("ramesh", "staff.example.com")).toBe("ramesh@staff.example.com");
  });
  it("passes real emails through", () => {
    expect(loginEmail(" Owner@Example.com ", "staff.example.com")).toBe("owner@example.com");
  });
  it.each(["ramesh", "sunita.devi", "staff_01"])("accepts username %s", (u) => {
    expect(USERNAME_PATTERN.test(u)).toBe(true);
  });
  it.each(["ab", "-ramesh", "Ramesh", "ram esh", "a".repeat(31)])("rejects username %s", (u) => {
    expect(USERNAME_PATTERN.test(u)).toBe(false);
  });
});
