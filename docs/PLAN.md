# Plan (approved 2026-10-28)

## Decisions

| Topic         | Decision                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cost price    | **Add Stock** asks for the cost price on every line. Items have no fixed purchase price.                                                                                                  |
| Average cost  | Weighted average per item, recalculated on every stock-in by a DB trigger. Sales don't change it. When stock reaches 0, the last average is kept, and the next purchase sets a fresh one. |
| Who sees cost | Average cost and the below-cost warning are **ADMIN only**.                                                                                                                               |
| Selling price | Asked on every cart line, pre-filled with the item's usual selling price (optional field on the item). Checkout is blocked while any line has no price.                                   |
| GST           | None in v1 (see ROADMAP).                                                                                                                                                                 |
| Vendors       | They are the **customers we sell to**. UI says "Customer"; code says `vendors`.                                                                                                           |
| Quantities    | Up to 3 decimals, allowed only for units marked `allows_decimal` (kg, litre).                                                                                                             |
| Pack size     | Display text only. Stock is counted in the item's own unit.                                                                                                                               |
| Order numbers | `ORD-2026-27-00001`: Indian financial year, gapless, restarts each 1 April.                                                                                                               |
| Drafts        | Several at once. Every staff member can see and continue any draft. Drafts don't reserve stock; stock is checked at checkout.                                                             |
| Logins        | Staff use username + password (internal email `username@STAFF_EMAIL_DOMAIN`), and the admin resets their passwords. The admin uses a real email and "forgot password".                    |
| Environments  | A separate Supabase dev project (Mumbai), no Docker. Production is its own project.                                                                                                       |
| Locations     | One godown.                                                                                                                                                                               |

**Roles**

- **STAFF can:** create items (including setting the usual price when creating), add stock,
  create and check out orders, and set the selling price per order line.
- **STAFF cannot:** change an existing item's usual price, archive anything, or manage users.
- **ADMIN:** everything.

## Architecture

- **Data access:** Drizzle on the server only, via Supabase's transaction pooler (`prepare: false`).
- **Auth:**
  - `@supabase/ssr` cookies, and `proxy.ts` redirects signed-out users to `/login`.
  - Every server action checks the login, `is_active` and the role.
  - Deactivating a user also bans them in Supabase Auth.
- **RLS:** on for every table. Active logged-in users can SELECT; there are no write policies.
- **Stock integrity (in the database):**
  - Inserting a `stock_movements` row is the only way stock changes. The trigger updates
    `current_stock` and `avg_cost_paise`.
  - A guard trigger rejects direct changes.
  - `CHECK (current_stock >= 0)`.
  - The ledger can't be changed once written.
- **Checkout:** one transaction:
  1. Lock the draft.
  2. Lock the items in `id` order.
  3. Collect **all** shortages; if there are any, roll back and list them.
  4. Recalculate totals from DB values.
  5. Take the next order number.
  6. Insert OUT movements.
  7. Mark the order completed.
- **Search:** `pg_trgm`. Search boxes update URL params after 250 ms; the server returns 20 rows
  per page.
- **Photos:** private Storage bucket `item-photos`. Photos are shrunk on the phone before
  upload, uploaded by the server, and shown via signed URLs.
- **Text:** all UI text in `src/i18n/`, through a typed `t()` helper.
- **Tests:**
  - Vitest for helpers and validation.
  - PGlite runs the real migrations to test triggers, RLS and checkout.
  - Playwright covers the main flows.

## Schema

See `src/db/schema/*` and `src/db/migrations/`. Tables:

- `profiles`: one row per login, with role and active flag.
- `units`, `categories`: lookup lists.
- `items`: the catalogue.
- `vendors`: the customers.
- `stock_entries`: one row per Add Stock save.
- `stock_movements`: the ledger.
- `orders`: drafts and completed orders.
- `order_lines`
- `order_counters`: next order number per financial year.

## Phases (stop after each one for review; each ends with `pnpm check` and a commit)

**Phase 0: Setup**

- Scaffold, configs, schema and migrations (triggers, RLS)
- Seed script, CLAUDE.md, README, ROADMAP

**Phase 1: Login and app shell**

- Login, logout, forgot/reset password, `proxy.ts`, role helpers
- Admin user management
- App shell: bottom navigation on mobile, sidebar on desktop
- i18n helper, toasts, empty states, confirm dialogs

**Phase 2: Items and customers**

- Items: lists with search, filters, sort and pagination; forms; photos; archive
- Units list
- Customer page with order history

**Phase 2.5: Stationery changes**

- MRP, brand, colour/variant, wider search
- DOMS sample data, CSV import

**Phase 3: Add Stock**

- Form with multiple lines
- Stock history on the item page

**Phase 4: Cart, checkout and orders**

- Drafts, customer picker with inline add, cart, checkout with shortages list
- Confirmation screen and print view
- Orders list and order page
- Sample orders added to the seed

**Phase 5: Dashboard and finishing**

- Dashboard: today's sales, items, stock value (owner), low/out of stock, unfinished orders,
  recent activity
- Polish pass: axe accessibility audit on all main screens, contrast fix, global error page,
  database connection fix
- Playwright flows for every feature
- DEPLOYMENT.md, `pnpm owner:create`, Vercel region (Mumbai)

---

# Version 2 plan (approved 2026-10-30)

## Decisions

| Topic                          | Decision                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-shop                     | Shops are completely separate: logins, items, customers, orders, units, brands, categories and settings. One deployment and one database.                                                                                         |
| Who creates shops              | A **platform admin** login creates shops and each shop's first owner. It cannot see any shop's data.                                                                                                                              |
| Logins                         | **One login = one shop.** Usernames stay unique across all shops, so the login screen is unchanged.                                                                                                                               |
| Existing data                  | Becomes the first shop, called "My Shop"; rename it on the new Shop settings page. Existing logins keep working.                                                                                                                  |
| Shop details on printed orders | Move from `BUSINESS_*` env settings to **Shop settings** (owner).                                                                                                                                                                 |
| Stock correction               | Owner only. The owner enters the counted quantity and a reason, which creates an `ADJUST` movement. Average cost is unchanged.                                                                                                    |
| "Delete order"                 | **Cancel** (owner only, reason required). Stock goes back through `RETURN` movements at the original cost. The order stays visible as "Cancelled", is excluded from sales and balances, and its number stays (no gaps).           |
| Payments                       | "Record payment" on the customer page, and an optional **"Paid now"** at checkout (cash / UPI / bank / cheque). Outstanding = completed orders − payments. Wrong payments are voided by the owner (kept on record with a reason). |

## How shops are kept apart

1. Every business table has `shop_id`. Every data function takes `shopId`, filters by it, and
   writes it.
2. **Composite foreign keys** (`(shop_id, item_id) → items(shop_id, id)` and so on). The database
   itself refuses a row that points into another shop, such as an order line with another shop's
   item.
3. Uniqueness is per shop: SKU, unit, category and brand names, order numbers, and the order
   counters for each shop and financial year.
4. RLS policies allow reads only within the user's own shop. Turning a shop off logs all its
   users out.
5. Tests create **two shops** and check that no list, page, photo or action can reach the other
   shop's data.

## Phases (stop after each one for review)

**Phase 6: Multi-shop foundation**

- `shops` table and platform admin.
- `shop_id` everywhere: migration of existing data, composite FKs, uniqueness per shop, RLS.
- Every query and action scoped to the shop.
- Platform pages: list and create shops (with their owner login), edit a shop, turn it off or
  on, reset an owner's password.
- Shop settings page (name, address, phone printed on orders).
- Seed with two shops plus a platform admin; isolation tests.
- `pnpm platform-admin:create` for production; DEPLOYMENT.md "upgrading to v2".

**Phase 7: Stock correction and order cancellation**

- "Correct stock" on the item page (owner).
- "Cancel order" on the order page (owner) with reason; stock returned.
- "Cancelled" shown in lists, history and the dashboard; excluded from sales totals.

**Phase 8: Customer payments and outstanding**

- Payments table.
- Record payment on the customer page; payment list with void (owner).
- Outstanding on the customer list (filter and sort by dues) and customer page.
- "Paid now" at checkout; paid amount shown on the order and print.
- Dashboard: total to collect, and today's collections.
