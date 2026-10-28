import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database or transaction using our schema (postgres-js in the app,
 * PGlite in tests). Feature code that writes data should accept this type.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
