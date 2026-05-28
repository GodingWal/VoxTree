import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Replicate webhook signature per
 * https://replicate.com/docs/topics/webhooks/verify-webhook
 *
 * Replicate signs the payload with the secret from REPLICATE_WEBHOOK_SECRET
 * (a Svix-compatible value starting with `whsec_`). The signed string is
 * `${webhook-id}.${webhook-timestamp}.${rawBody}`; the signature header is
 * a space-separated list of `v1,${base64Hmac}` entries (in case of rotation).
 *
 * Returns { ok: true } when verification succeeds, or { ok: false, reason }
 * with a human-readable diagnosis otherwise. In simulation mode (no secret
 * configured) we accept the request and surface that fact so callers can log.
 */
export type VerifyResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; reason: string };

const TOLERANCE_SECONDS = 5 * 60;

function constantTimeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyReplicateWebhook(params: {
  rawBody: string;
  headers: Headers;
  secret?: string | null;
  now?: () => number;
}): VerifyResult {
  const secret = params.secret ?? process.env.REPLICATE_WEBHOOK_SECRET ?? null;
  if (!secret) {
    return { ok: true, simulated: true };
  }

  const id = params.headers.get("webhook-id");
  const ts = params.headers.get("webhook-timestamp");
  const sigHeader = params.headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) {
    return { ok: false, reason: "missing webhook headers" };
  }

  const tsNum = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, reason: "invalid timestamp" };
  }
  const now = Math.floor((params.now?.() ?? Date.now()) / 1000);
  if (Math.abs(now - tsNum) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp out of tolerance" };
  }

  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const signedContent = `${id}.${ts}.${params.rawBody}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Header looks like: "v1,abc== v1,def==" — accept any match.
  const provided = sigHeader
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(",");
      return idx === -1 ? entry : entry.slice(idx + 1);
    });

  for (const candidate of provided) {
    if (constantTimeStringEqual(candidate, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "signature mismatch" };
}
