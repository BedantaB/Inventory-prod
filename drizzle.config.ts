import { defineConfig } from "drizzle-kit";

// ENV_FILE=.env.production.local pnpm db:migrate  →  migrate the production database.
try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Optional here: `drizzle-kit generate` needs no database.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  casing: "snake_case",
  schemaFilter: ["public"],
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
