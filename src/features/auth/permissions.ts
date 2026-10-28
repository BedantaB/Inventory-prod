export type Role = "ADMIN" | "STAFF";

/**
 * Things only the owner (ADMIN) may do. STAFF can do everything else.
 * Check with can() in server actions AND use it to hide buttons in the UI.
 */
export type Permission =
  | "manageUsers" // create, edit, deactivate logins
  | "editItemPrice" // change an existing item's usual selling price
  | "archive" // archive items, customers, orders
  | "viewCost"; // see average cost and below-cost warnings

const ADMIN_ONLY: ReadonlySet<Permission> = new Set([
  "manageUsers",
  "editItemPrice",
  "archive",
  "viewCost",
]);

export function can(user: { role: Role }, permission: Permission): boolean {
  return user.role === "ADMIN" || !ADMIN_ONLY.has(permission);
}
