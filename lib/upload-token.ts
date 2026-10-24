import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed URLs for the one upload that must be fetchable
 * without a session: the LoRA trainer dataset
 * (`uploads/lora/<voiceId>/dataset.zip`), which the external Replicate
 * trainer pulls server-side and therefore cannot present a session
 * cookie for.
 *
 * A token binds an HMAC-SHA256 (keyed with AUTH_SECRET) to exactly one
 * uploads-relative path plus an expiry: `<exp>.<sig>` where `sig`
 * covers `"<path>.<exp>"`. It is valid only for that path, only until
 * `exp`, and cannot be minted without the server secret. The train
 * route generates one per training run (see
 * app/api/avatar/train/route.ts); the /uploads route accepts it ONLY
 * for the dataset.zip pattern — every other path still requires a
 * session + ownership.
 */

export const UPLOAD_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error("AUTH_SECRET is not set; cannot sign or verify upload tokens");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Mint a token for an uploads-relative path (e.g. `lora/<id>/dataset.zip`). */
export function createUploadToken(
  relativePath: string,
  ttlSeconds: number = UPLOAD_TOKEN_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${sign(`${relativePath}.${exp}`)}`;
}

/** True iff `token` is a well-formed, unexpired token minted for exactly `relativePath`. */
export function verifyUploadToken(
  relativePath: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isSafeInteger(exp) || exp * 1000 <= Date.now()) return false;
  let expected: string;
  try {
    expected = sign(`${relativePath}.${exp}`);
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Absolute signed URL the trainer fetches: `<appUrl>/uploads/<path>?t=<token>`. */
export function signedUploadUrl(appUrl: string, relativePath: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/uploads/${relativePath}?t=${createUploadToken(relativePath)}`;
}
