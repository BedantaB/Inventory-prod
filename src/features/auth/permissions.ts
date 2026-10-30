export type Role = "ADMIN" | "STAFF";

/**
 * Things only the owner (ADMIN) may do. STAFF can do everything else.
 * Check with can() in server actions AND use it to hide buttons in the UI.
 */
export type Permission =
  | "manageUsers" // create, edit, deactivate logins
  | "editItemPrice" // change an existing item's usual selling price
  | "archive" // archive items, customers, orders
  | "viewCost" // see average cost and below-cost warnings
  | "manageUnits" // add or change units (pcs, kg, …)
  | "importItems" // add many items at once from a spreadsheet
  | "manageShop" // change the shop's name, address and phone
  | "correctStock" // set an item's stock to the counted quantity
  | "cancelOrder"; // cancel a completed order (stock goes back)

const ADMIN_ONLY: ReadonlySet<Permission> = new Set([
  "manageUsers",
  "editItemPrice",
  "archive",
  "viewCost",
  "manageUnits",
  "importItems",
  "manageShop",
  "correctStock",
  "cancelOrder",
]);

export function can(user: { role: Role }, permission: Permission): boolean {
  return user.role === "ADMIN" || !ADMIN_ONLY.has(permission);
}
