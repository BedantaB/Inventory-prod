import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Creates a Drizzle client for Supabase's pooler:
 * - `prepare: false` — required by the transaction pooler.
 * - `max_pipeline: 1` — never send a second query down a connection that is still busy.
 *   postgres-js pipelines up to 100 by default, and through the pooler that can stall a page
 *   forever (seen on the dashboard, which runs several queries at once).
 * The app uses src/db/index.ts; scripts (seed) call this directly.
 */
export function createDb(url: string, options: postgres.Options<Record<string, never>> = {}) {
  const client = postgres(url, {
    prepare: false,
    max_pipeline: 1,
    ...options,
  } as postgres.Options<Record<string, never>>);
  const db = drizzle({ client, schema, casing: "snake_case" });
  return { db, client };
}
