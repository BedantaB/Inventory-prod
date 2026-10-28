import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Creates a Drizzle client. `prepare: false` is required by Supabase's transaction pooler.
 * The app uses src/db/index.ts; scripts (seed) call this directly.
 */
export function createDb(url: string, options: postgres.Options<Record<string, never>> = {}) {
  const client = postgres(url, { prepare: false, ...options });
  const db = drizzle({ client, schema, casing: "snake_case" });
  return { db, client };
}
