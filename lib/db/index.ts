/**
 * Local Postgres connection for VoxTree (local-stack migration, Phase 2).
 *
 * Reads `DATABASE_URL` (see `.env.local.example`); when unset, the `pg`
 * driver falls back to its own PG* env vars / localhost defaults, which
 * matches the docker-compose Postgres in dev. The pool is cached on
 * `globalThis` so Next.js dev hot-reloads don't leak pools.
 *
 * Nothing imports this yet — call sites migrate in Phase 4.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as { voxtreePool?: Pool };

export const pool =
  globalForDb.voxtreePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.voxtreePool = pool;
}

export const db = drizzle(pool, { schema });

export type Database = typeof db;

export { schema };
export * from "./schema";
