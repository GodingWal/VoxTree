import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config (local-stack migration, Phase 2).
 * The Phase 1 SQL port in `db/init/01_schema.sql` is what provisions a
 * fresh local database; use `db:generate` for future schema changes
 * once Drizzle owns migrations.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://voxtree:voxtree_dev@localhost:5432/voxtree",
  },
});
