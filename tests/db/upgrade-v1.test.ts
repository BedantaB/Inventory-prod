import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

/**
 * The live database was created by v1 (migrations 0000–0005) and already holds real data.
 * This test builds such a database, then runs the v2 upgrade and checks nothing is lost.
 */

const STUBS = /* sql */ `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  SET search_path TO "$user", public, extensions;
`;

/** A copy of the migrations folder that stops after `lastTag`. */
function migrationsUpTo(lastTag: string): string {
  const dir = mkdtempSync(join(tmpdir(), "v1-migrations-"));
  mkdirSync(join(dir, "meta"));
  const journal = JSON.parse(readFileSync("src/db/migrations/meta/_journal.json", "utf8"));
  const lastIndex = journal.entries.findIndex((e: { tag: string }) => e.tag === lastTag);
  journal.entries = journal.entries.slice(0, lastIndex + 1);
  writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    copyFileSync(`src/db/migrations/${entry.tag}.sql`, join(dir, `${entry.tag}.sql`));
  }
  return dir;
}

let client: PGlite;
const ids = {
  owner: "11111111-1111-4111-8111-111111111111",
  item: "22222222-2222-4222-8222-222222222222",
  vendor: "33333333-3333-4333-8333-333333333333",
  entry: "44444444-4444-4444-8444-444444444444",
  order: "55555555-5555-4555-8555-555555555555",
};

beforeAll(async () => {
  client = new PGlite({ extensions: { pg_trgm } });
  await client.exec(STUBS);
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: migrationsUpTo("0005_movement_seq") });

  // v1 data, written the way v1 wrote it (no shops yet).
  await client.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${ids.owner}', 'owner@example.com');
    INSERT INTO profiles (id, username, full_name, email, role) VALUES ('${ids.owner}', 'owner', 'Owner', 'owner@example.com', 'ADMIN');
    INSERT INTO categories (name, created_by) VALUES ('Pens', '${ids.owner}');
    INSERT INTO items (id, name, sku, unit_id, category_id, selling_price_paise, created_by)
      SELECT '${ids.item}', 'Gel Pen', 'PEN-1', u.id, c.id, 1000, '${ids.owner}' FROM units u, categories c WHERE u.name = 'pcs';
    INSERT INTO vendors (id, business_name, phone, created_by) VALUES ('${ids.vendor}', 'Sarkar Book Stall', '+919436012345', '${ids.owner}');
    INSERT INTO stock_entries (id, reference, created_by) VALUES ('${ids.entry}', 'BILL-1', '${ids.owner}');
    INSERT INTO stock_movements (type, item_id, quantity_change, unit_cost_paise, stock_entry_id, created_by)
      VALUES ('IN', '${ids.item}', 10, 600, '${ids.entry}', '${ids.owner}');
    INSERT INTO orders (id, vendor_id, created_by) VALUES ('${ids.order}', '${ids.vendor}', '${ids.owner}');
    INSERT INTO order_lines (order_id, item_id, quantity, unit_price_paise, created_by)
      VALUES ('${ids.order}', '${ids.item}', 2, 1000, '${ids.owner}');
    INSERT INTO stock_movements (type, item_id, quantity_change, unit_price_paise, order_id, created_by)
      VALUES ('OUT', '${ids.item}', -2, 1000, '${ids.order}', '${ids.owner}');
    INSERT INTO order_counters (financial_year, last_value) VALUES ('2026-27', 1);
    UPDATE orders SET status = 'COMPLETED', order_number = 'ORD-2026-27-00001', subtotal_paise = 2000,
      discount_paise = 0, total_paise = 2000, completed_at = now(), completed_by = '${ids.owner}'
      WHERE id = '${ids.order}';
  `);

  // The v2 upgrade.
  await migrate(db, { migrationsFolder: "src/db/migrations" });
});

const one = async <T>(query: string) => (await client.query<T>(query)).rows[0];

describe("upgrading a v1 database to multi-shop", () => {
  it("puts everything into one shop called My Shop", async () => {
    const shops = (await client.query<{ id: string; name: string }>("SELECT id, name FROM shops"))
      .rows;
    expect(shops).toEqual([{ id: expect.any(String), name: "My Shop" }]);
    const shopId = shops[0].id;

    for (const table of [
      "profiles",
      "units",
      "categories",
      "items",
      "vendors",
      "stock_entries",
      "stock_movements",
      "orders",
      "order_lines",
      "order_counters",
    ]) {
      const row = await one<{ other: number; total: number }>(
        `SELECT count(*) FILTER (WHERE shop_id IS DISTINCT FROM '${shopId}')::int AS other, count(*)::int AS total FROM ${table}`,
      );
      expect({ table, ...row }).toEqual({ table, other: 0, total: expect.any(Number) });
      expect(row.total).toBeGreaterThan(0);
    }
  });

  it("keeps stock, average cost, the order and the owner login exactly as they were", async () => {
    expect(
      await one(`SELECT current_stock, avg_cost_paise FROM items WHERE id = '${ids.item}'`),
    ).toEqual({
      current_stock: "8.000",
      avg_cost_paise: 600,
    });
    expect(
      await one(`SELECT order_number, total_paise, status FROM orders WHERE id = '${ids.order}'`),
    ).toEqual({
      order_number: "ORD-2026-27-00001",
      total_paise: 2000,
      status: "COMPLETED",
    });
    expect(
      await one(`SELECT is_platform_admin, role FROM profiles WHERE id = '${ids.owner}'`),
    ).toEqual({
      is_platform_admin: false,
      role: "ADMIN",
    });
  });

  it("leaves stock history and completed orders protected again", async () => {
    await expect(client.exec("UPDATE stock_movements SET note = 'x'")).rejects.toThrow(
      /cannot be changed or deleted/,
    );
    await expect(client.exec("UPDATE order_lines SET quantity = 5")).rejects.toThrow(
      /completed order cannot be changed/,
    );
    await expect(client.exec("UPDATE orders SET total_paise = 1")).rejects.toThrow(
      /Completed orders cannot be changed/,
    );
  });

  it("still records new stock (and the next order number continues)", async () => {
    const shopId = (await one<{ id: string }>("SELECT id FROM shops")).id;
    await client.exec(`
      INSERT INTO stock_entries (id, shop_id, reference, created_by) VALUES ('66666666-6666-4666-8666-666666666666', '${shopId}', 'BILL-2', '${ids.owner}');
      INSERT INTO stock_movements (shop_id, type, item_id, quantity_change, unit_cost_paise, stock_entry_id, created_by)
        VALUES ('${shopId}', 'IN', '${ids.item}', 2, 600, '66666666-6666-4666-8666-666666666666', '${ids.owner}');
    `);
    expect(await one(`SELECT current_stock FROM items WHERE id = '${ids.item}'`)).toEqual({
      current_stock: "10.000",
    });
    expect(await one(`SELECT last_value FROM order_counters WHERE shop_id = '${shopId}'`)).toEqual({
      last_value: 1,
    });
  });
});

describe("upgrading an empty (new) database", () => {
  it("creates no shop and no orphan units", async () => {
    const fresh = new PGlite({ extensions: { pg_trgm } });
    await fresh.exec(STUBS);
    await migrate(drizzle({ client: fresh, schema, casing: "snake_case" }), {
      migrationsFolder: "src/db/migrations",
    });
    expect((await fresh.query("SELECT count(*)::int AS n FROM shops")).rows).toEqual([{ n: 0 }]);
    expect((await fresh.query("SELECT count(*)::int AS n FROM units")).rows).toEqual([{ n: 0 }]);
  });
});
