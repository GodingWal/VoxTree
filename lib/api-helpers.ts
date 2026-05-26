import { NextResponse } from "next/server";
import { RateLimit } from "./rate-limit";

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
