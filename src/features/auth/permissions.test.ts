import { describe, expect, it } from "vitest";
import { can, type Permission } from "./permissions";

const all: Permission[] = ["manageUsers", "editItemPrice", "archive", "viewCost", "manageUnits"];

describe("can", () => {
  it.each(all)("lets the owner %s", (permission) => {
    expect(can({ role: "ADMIN" }, permission)).toBe(true);
  });
  it.each(all)("does not let staff %s", (permission) => {
    expect(can({ role: "STAFF" }, permission)).toBe(false);
  });
});
