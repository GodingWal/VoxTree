import { and, count, eq, gte, sql } from "drizzle-orm";

import { jobOwnedBy } from "./authz";
import { db } from "./db";
import { voiceJobs } from "./db/schema";

export class RateLimit {
  private limit: number;
  private windowMs: number;
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(options: { limit: number; windowMs: number }) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  /**
   * Checks if the request limit for the given key/IP has been exceeded.
   * Utilizes Postgres check_rate_limit function to be serverless-safe.
   * Falls back to in-memory tracking in tests or when no database is configured.
   */
  async check(id: string): Promise<boolean> {
    const useDatabase =
      process.env.NODE_ENV !== "test" &&
      process.env.VITEST !== "true" &&
      !!process.env.DATABASE_URL;

    if (!useDatabase) {
      return this.checkInMemory(id);
    }

    try {
      const result = await db.execute(
        sql`select check_rate_limit(${id}, ${this.limit}, ${this.windowMs}) as allowed`
      );
      const row = result.rows[0] as { allowed?: boolean } | undefined;
      return !!row?.allowed;
    } catch (err) {
      console.error("Rate limiter exception:", err);
      return process.env.NODE_ENV !== "production";
    }
  }

  private checkInMemory(id: string): boolean {
    const now = Date.now();

    // Cleanup expired entries
    if (this.store.size > 1000) {
      for (const [key, val] of this.store.entries()) {
        if (now > val.resetAt) {
          this.store.delete(key);
        }
      }
    }

    const record = this.store.get(id);

    if (!record || now > record.resetAt) {
      this.store.set(id, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.limit) {
      return false;
    }

    record.count++;
    return true;
  }
}

/**
 * Durable per-user rate limit backed by Postgres. Unlike the in-memory
 * RateLimit above, this survives server restarts and works across multiple
 * instances — so a malicious client can't reset their bucket by triggering
 * a redeploy or hitting a different replica.
 *
 * Counters live in the `voice_jobs` audit trail indirectly: we count rows
 * inserted in the last `windowMs` for a given (user, type). This avoids a
 * separate rate-limit table while still being correct.
 */
export interface UserRateLimitOptions {
  userId: string;
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export async function checkUserRateLimit(
  opts: UserRateLimitOptions
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const since = new Date(Date.now() - opts.windowSeconds * 1000);

    const [row] = await db
      .select({ value: count() })
      .from(voiceJobs)
      .where(
        and(
          jobOwnedBy(opts.userId),
          eq(voiceJobs.type, opts.bucket),
          gte(voiceJobs.createdAt, since)
        )
      );

    const used = row?.value ?? 0;
    return { allowed: used < opts.limit, remaining: Math.max(0, opts.limit - used) };
  } catch {
    return process.env.NODE_ENV === "production"
      ? { allowed: false, remaining: 0 }
      : { allowed: true, remaining: opts.limit };
  }
}
