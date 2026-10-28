import "server-only";
import { createDb } from "./create";
import { serverEnv } from "@/lib/env.server";

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof createDb> };

/** The app's database client (server only). Created on first use, reused across hot reloads. */
export function getDb() {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb(serverEnv().DATABASE_URL, { max: 5 });
  }
  return globalForDb.__db.db;
}
