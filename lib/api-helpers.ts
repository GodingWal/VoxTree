import { NextResponse } from "next/server";
import { RateLimit, checkUserRateLimit } from "./rate-limit";

/**
 * Parse a JSON request body without crashing on malformed input.
 * Returns the parsed body on success or a 400 NextResponse on failure.
 */
export async function safeJson(
  request: Request
): Promise<{ body: unknown } | { error: NextResponse }> {
  try {
    const text = await request.text();
    return { body: text ? JSON.parse(text) : {} };
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}

/**
 * Per-IP rate limiter shared across paid external-API endpoints
 * (ElevenLabs, Replicate, GCS uploads). Limit is intentionally low
 * since each call costs money and/or compute.
 *
 * NOTE: in-memory, so it resets on restart and does not scale across
 * instances. Use enforceUserRateLimit() for per-user durable limits.
 */
export const paidApiRateLimiter = new RateLimit({ limit: 10, windowMs: 60_000 });

/**
 * Apply paidApiRateLimiter using the caller's forwarded IP.
 * Returns a 429 NextResponse if the limit is exceeded, null otherwise.
 */
export function enforcePaidRateLimit(request: Request): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!paidApiRateLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

/**
 * Per-user durable rate limit. Counts rows of the given `bucket` job type
 * created by `userId` within the window. Returns a 429 response if the user
 * has exceeded their quota, or null to continue.
 *
 * Use this on routes that enqueue jobs (clone, train, generate) so a single
 * user can't burn an organization-wide budget by holding down the button.
 */
export async function enforceUserRateLimit(opts: {
  userId: string;
  bucket: string;
  limit: number;
  windowSeconds: number;
}): Promise<NextResponse | null> {
  const result = await checkUserRateLimit(opts);
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfterSeconds: opts.windowSeconds,
      },
      { status: 429, headers: { "Retry-After": String(opts.windowSeconds) } }
    );
  }
  return null;
}
