import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config.
 *
 * Decision (see README.md, "Database schema: init SQL is canonical"):
 * `db/init/01_schema.sql` is the single source of truth for provisioning
 * a fresh database — it is what docker-compose applies at init.
 * Drizzle Kit is used here for Studio/inspection against
 * `lib/db/schema.ts` only. The `out: ./db/migrations` directory does not
 * exist by design: do NOT run `db:generate` expecting generated
 * migrations to be the provisioning path. Schema changes are made by
 * editing `db/init/01_schema.sql` AND `lib/db/schema.ts` together and
 * updating `tests/migrations-integrity.test.ts`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://voxtree:voxtree_dev@localhost:5432/voxtree",
  },
});
