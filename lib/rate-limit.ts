import { createAdminClient } from "./supabase/admin";

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
   * Falls back to in-memory tracking in tests or when Supabase is unconfigured.
   */
  async check(id: string): Promise<boolean> {
    const useDatabase = 
      process.env.NODE_ENV !== "test" && 
      process.env.VITEST !== "true" && 
      !!process.env.NEXT_PUBLIC_SUPABASE_URL && 
      !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!useDatabase) {
      return this.checkInMemory(id);
    }

    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_key: id,
        p_limit: this.limit,
        p_window_ms: this.windowMs,
      });

      if (error) {
        console.error("Database rate limit RPC error:", error);
        return process.env.NODE_ENV !== "production";
      }

      return !!data;
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
 * Durable per-user rate limit backed by Supabase. Unlike the in-memory
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
  const admin = createAdminClient();
  const since = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("voice_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", opts.userId)
    .eq("type", opts.bucket)
    .gte("created_at", since);

  if (error) {
    return process.env.NODE_ENV === "production"
      ? { allowed: false, remaining: 0 }
      : { allowed: true, remaining: opts.limit };
  }

  const used = count ?? 0;
  return { allowed: used < opts.limit, remaining: Math.max(0, opts.limit - used) };
}
