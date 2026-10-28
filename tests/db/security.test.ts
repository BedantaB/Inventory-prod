import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, type TestDb } from "./test-db";

let client: PGlite;
let db: TestDb;
let activeUserId: string;
let inactiveUserId: string;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  activeUserId = (await createUser(db, { username: "ramesh" })).id;
  inactiveUserId = (await createUser(db, { username: "left-the-job", isActive: false })).id;
});

/** Runs `fn` as a Supabase API caller (anon, or a logged-in user), then rolls back. */
async function asRole<T>(
  role: "anon" | "authenticated",
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T;
  await client.transaction(async (tx) => {
    await tx.query(`SET LOCAL ROLE ${role}`);
    if (userId) await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    result = await fn(tx);
    await tx.rollback();
  });
  return result!;
}

describe("row level security", () => {
  it("is enabled on every table in the public schema", async () => {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it("gives anonymous visitors no access at all", async () => {
    await expect(asRole("anon", null, (tx) => tx.query(`SELECT * FROM items`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("lets active logged-in users read", async () => {
    const result = await asRole("authenticated", activeUserId, (tx) =>
      tx.query<{ name: string }>(`SELECT name FROM units`),
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it("shows nothing to deactivated users", async () => {
    const result = await asRole("authenticated", inactiveUserId, (tx) =>
      tx.query(`SELECT name FROM units`),
    );
    expect(result.rows).toHaveLength(0);
  });

  it("does not let logged-in users write directly", async () => {
    await expect(
      asRole("authenticated", activeUserId, (tx) =>
        tx.query(`UPDATE profiles SET role = 'ADMIN' WHERE id = $1`, [activeUserId]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("authenticated", activeUserId, (tx) =>
        tx.query(`INSERT INTO units (name, label) VALUES ('crate', 'Crate')`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("hides the order counter from API callers", async () => {
    const result = await asRole("authenticated", activeUserId, (tx) =>
      tx.query(`SELECT * FROM order_counters`),
    );
    expect(result.rows).toHaveLength(0);
  });
});
