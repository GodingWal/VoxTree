import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { promises as fsp } from "fs";
import path from "path";
import { NextRequest } from "next/server";

/**
 * Signed trainer URLs (Phase 6 hardening).
 *
 * The LoRA trainer (Replicate) fetches `lora/<voiceId>/dataset.zip`
 * server-side and cannot present a session. That single fetch is
 * authorized by a short-lived HMAC token (`?t=`) minted by the train
 * route and bound to exactly that path. These tests pin:
 *
 *  1. Token semantics: valid token verifies; expired, tampered,
 *     wrong-path, and garbage tokens do not.
 *  2. Route behavior: anonymous + valid token → 200 for the zip;
 *     anonymous without/with a bad token → 401; the token never opens
 *     any other path (reference frames stay session-only).
 */

process.env.AUTH_SECRET = "test-secret-for-upload-tokens";

const VOICE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_VOICE_ID = "44444444-4444-4444-8444-444444444444";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ZIP_REL = `lora/${VOICE_ID}/dataset.zip`;
const FRAME_REL = `lora/${VOICE_ID}/ref_01.jpg`;

const state = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  voiceRow: true,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUserId: async () => state.sessionUserId,
  getCurrentUser: async () =>
    state.sessionUserId ? { id: state.sessionUserId } : null,
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const chain = (rows: unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve(rows).then(res, rej);
    return c;
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          if (name === "family_voices") {
            return chain(state.voiceRow ? [{ id: VOICE_ID }] : []);
          }
          return chain([]);
        },
      }),
    },
  };
});

import { GET as getUpload } from "@/app/uploads/[...path]/route";
import {
  createUploadToken,
  signedUploadUrl,
  verifyUploadToken,
} from "@/lib/upload-token";

// ── 1. Token semantics ───────────────────────────────────────────────

describe("upload token — HMAC semantics", () => {
  it("a freshly minted token verifies for its own path", () => {
    const token = createUploadToken(ZIP_REL);
    expect(verifyUploadToken(ZIP_REL, token)).toBe(true);
  });

  it("an expired token is rejected", () => {
    const token = createUploadToken(ZIP_REL, -60); // expired a minute ago
    expect(verifyUploadToken(ZIP_REL, token)).toBe(false);
  });

  it("a token minted for a different path is rejected (wrong path)", () => {
    const otherZip = `lora/${OTHER_VOICE_ID}/dataset.zip`;
    const token = createUploadToken(otherZip);
    expect(verifyUploadToken(ZIP_REL, token)).toBe(false);
    // ...and a zip token never authorizes the reference frames beside it.
    expect(verifyUploadToken(FRAME_REL, createUploadToken(ZIP_REL))).toBe(false);
  });

  it("tampered and malformed tokens are rejected", () => {
    const token = createUploadToken(ZIP_REL);
    const [exp, sig] = token.split(".");
    const flipped = `${exp}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
    expect(verifyUploadToken(ZIP_REL, flipped)).toBe(false);
    expect(verifyUploadToken(ZIP_REL, "not-a-token")).toBe(false);
    expect(verifyUploadToken(ZIP_REL, "")).toBe(false);
    expect(verifyUploadToken(ZIP_REL, null)).toBe(false);
    expect(verifyUploadToken(ZIP_REL, undefined)).toBe(false);
  });

  it("signedUploadUrl embeds a verifiable token for the exact path", () => {
    const url = signedUploadUrl("http://localhost:3100/", ZIP_REL);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe(`/uploads/${ZIP_REL}`);
    expect(verifyUploadToken(ZIP_REL, parsed.searchParams.get("t"))).toBe(true);
  });
});

// ── 2. Route behavior ────────────────────────────────────────────────

const uploadsDir = path.join(process.cwd(), "data", "uploads");

beforeAll(async () => {
  for (const rel of [ZIP_REL, FRAME_REL]) {
    const p = path.join(uploadsDir, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, rel.endsWith(".zip") ? "trainer-zip-bytes" : "ref-frame");
  }
});

afterAll(async () => {
  await fsp.rm(path.join(uploadsDir, "lora", VOICE_ID), {
    recursive: true,
    force: true,
  });
});

beforeEach(() => {
  state.sessionUserId = null;
  state.voiceRow = true;
});

function uploadRequest(rel: string, query = "") {
  return getUpload(
    new NextRequest(`http://localhost/uploads/${rel}${query}`),
    { params: Promise.resolve({ path: rel.split("/") }) },
  );
}

describe("uploads route — signed trainer zip access", () => {
  it("anonymous + valid token → 200 with the zip bytes", async () => {
    const res = await uploadRequest(ZIP_REL, `?t=${createUploadToken(ZIP_REL)}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("trainer-zip-bytes");
  });

  it("anonymous + no token → 401", async () => {
    const res = await uploadRequest(ZIP_REL);
    expect(res.status).toBe(401);
  });

  it("anonymous + expired token → 401", async () => {
    const expired = createUploadToken(ZIP_REL, -60);
    const res = await uploadRequest(ZIP_REL, `?t=${expired}`);
    expect(res.status).toBe(401);
  });

  it("anonymous + token minted for another voice's zip → 401", async () => {
    const wrongPath = createUploadToken(`lora/${OTHER_VOICE_ID}/dataset.zip`);
    const res = await uploadRequest(ZIP_REL, `?t=${wrongPath}`);
    expect(res.status).toBe(401);
  });

  it("anonymous + zip token presented for a reference frame → 401 (token only covers the zip pattern)", async () => {
    const res = await uploadRequest(FRAME_REL, `?t=${createUploadToken(ZIP_REL)}`);
    expect(res.status).toBe(401);
  });

  it("anonymous + valid token but the voice does not exist → 401", async () => {
    state.voiceRow = false;
    const res = await uploadRequest(ZIP_REL, `?t=${createUploadToken(ZIP_REL)}`);
    expect(res.status).toBe(401);
  });

  it("the owner session can still read the zip without any token", async () => {
    state.sessionUserId = OWNER;
    const res = await uploadRequest(ZIP_REL);
    expect(res.status).toBe(200);
  });
});
