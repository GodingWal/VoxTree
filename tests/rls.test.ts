import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { NextRequest } from "next/server";

/**
 * Cross-family isolation — the successor to the RLS policy tests.
 *
 * History: this suite statically asserted the Postgres RLS policies in the
 * hosted migration files. Those policies are gone: authorization is now
 * enforced in the application layer (lib/authz.ts), and every removed
 * policy is inventoried in db/rls-policy-map.md. The contract is the
 * same — no user can read or write another user's rows — so this suite
 * now pins:
 *
 *  1. Coverage: every policy in db/rls-policy-map.md has a corresponding
 *     owner predicate exported from lib/authz.ts (SQL-level rendering of
 *     each predicate is pinned in tests/authz.test.ts), and the ported
 *     local schema defines no database policies at all.
 *  2. Behavior: the authenticated upload route (the one read path that
 *     used to rely on public storage + RLS-era assumptions) refuses
 *     anonymous and cross-owner access.
 */

// ── Mocks for the upload-route behavioral tests ──────────────────────

const VOICE_ID = "11111111-1111-4111-8111-111111111111";
const CLIP_ID = "22222222-2222-4222-8222-222222222222";
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const state = vi.hoisted(() => ({
  sessionUserId: null as string | null,
  voiceRow: false,
  clipRow: false,
  userRow: false,
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
          if (name === "family_voices") return chain(state.voiceRow ? [{ id: VOICE_ID }] : []);
          if (name === "generated_clips") return chain(state.clipRow ? [{ id: CLIP_ID }] : []);
          if (name === "users") return chain(state.userRow ? [{ id: ALICE }] : []);
          return chain([]);
        },
      }),
    },
  };
});

import { GET as getUpload } from "@/app/uploads/[...path]/route";
import * as authz from "@/lib/authz";

// ── 1. Policy coverage: db/rls-policy-map.md ↔ lib/authz.ts ─────────

const policyMap = fs.readFileSync(
  path.join(process.cwd(), "db/rls-policy-map.md"),
  "utf8",
);
const schemaSql = fs.readFileSync(
  path.join(process.cwd(), "db/init/01_schema.sql"),
  "utf8",
);

// Every user-owned table from the removed policies and the predicate
// that replaces its policies. content_library is intentionally absent:
// its only policy was "any authenticated user can read".
const OWNER_TABLES: Array<[string, string]> = [
  ["public.users", "selfUser"],
  ["public.family_voices", "voiceOwnedBy"],
  ["public.generated_clips", "clipOwnedBy"],
  ["public.family_invitations", "invitationOwnedBy"],
  ["public.family_children", "childOwnedBy"],
  ["public.user_saved_stories", "savedStoryOwnedBy"],
  ["public.user_story_progress", "progressOwnedBy"],
  ["public.voice_jobs", "jobOwnedBy"],
  ["public.consent_records", "consentOwnedBy"],
  ["public.data_lifecycle_requests", "lifecycleOwnedBy"],
  ["public.invites", "inviteSentBy"],
  ["public.digital_actors", "actorOwnedBy"],
  ["public.digital_actor_versions", "actorVersionOwnedBy"],
  ["public.digital_actor_assets", "actorAssetOwnedBy"],
  ["public.digital_actor_jobs", "actorJobOwnedBy"],
];

describe("removed-policy coverage — every policy has an app-level replacement", () => {
  it("the policy map inventories all 36 removed policies", () => {
    const bullets = policyMap.split("\n").filter((l) => l.startsWith("- **"));
    expect(bullets.length).toBe(36);
  });

  it.each(OWNER_TABLES)(
    "%s policies are mapped and %s exists in lib/authz",
    (table, predicate) => {
      expect(policyMap).toMatch(new RegExp(`on ${table.replace(".", "\\.")}`, "i"));
      expect(typeof (authz as Record<string, unknown>)[predicate]).toBe("function");
    },
  );

  it("content_library's authenticated-read policy is documented as session-only", () => {
    expect(policyMap).toMatch(/on public\.content_library/i);
    const authzSrc = fs.readFileSync(path.join(process.cwd(), "lib/authz.ts"), "utf8");
    expect(authzSrc).toContain("content_library has no predicate");
  });

  it("consent + lifecycle policies (highest-risk) are mapped", () => {
    expect(policyMap).toMatch(/on public\.consent_records/i);
    expect(policyMap).toMatch(/on public\.data_lifecycle_requests/i);
  });

  it("rate_limits had no user policy (service-only) and stays unscoped", () => {
    // No rate_limits entry exists in the policy map; the table and its
    // check function live in the local schema, accessed only server-side.
    expect(policyMap).not.toContain("rate_limits");
    expect(schemaSql).toContain("public.rate_limits");
    expect(schemaSql).toContain("check_rate_limit");
  });

  it("the local schema defines no database policies (authorization is app-level)", () => {
    expect(schemaSql).not.toMatch(/create policy/i);
    expect(schemaSql).not.toContain("auth.uid()");
    expect(schemaSql).toContain("[RLS policy removed -> app-level check");
  });
});

// ── 2. Behavioral: authenticated upload serving ──────────────────────

const uploadsDir = path.join(process.cwd(), "data", "uploads");
const testFiles: Array<[string, string]> = [
  [`voice_sample_${VOICE_ID}.wav`, "alice-voice-sample"],
  [`talking_${CLIP_ID}.mp4`, "alice-talking-video"],
  [`lora/${VOICE_ID}/dataset.zip`, "trainer-zip"],
  [`lora/${VOICE_ID}/ref_01.jpg`, "alice-ref-frame"],
];

beforeAll(async () => {
  for (const [rel, content] of testFiles) {
    const p = path.join(uploadsDir, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  }
});

afterAll(async () => {
  for (const [rel] of testFiles) {
    await fsp.rm(path.join(uploadsDir, rel), { force: true });
  }
  await fsp.rm(path.join(uploadsDir, "lora", VOICE_ID), { recursive: true, force: true });
});

function uploadRequest(rel: string, headers: Record<string, string> = {}) {
  return getUpload(new NextRequest(`http://localhost/uploads/${rel}`, { headers }), {
    params: Promise.resolve({ path: rel.split("/") }),
  });
}

describe("uploads route — cross-user access denied", () => {
  it("anonymous callers get 401 for a voice sample", async () => {
    state.sessionUserId = null;
    const res = await uploadRequest(`voice_sample_${VOICE_ID}.wav`);
    expect(res.status).toBe(401);
  });

  it("Alice (owner) can read her voice sample", async () => {
    state.sessionUserId = ALICE;
    state.voiceRow = true;
    const res = await uploadRequest(`voice_sample_${VOICE_ID}.wav`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("alice-voice-sample");
  });

  it("a signed-in non-owner gets 404 (existence not leaked)", async () => {
    state.sessionUserId = ALICE;
    state.voiceRow = false;
    state.clipRow = false;
    state.userRow = false;
    const res = await uploadRequest(`voice_sample_${VOICE_ID}.wav`);
    expect(res.status).toBe(404);
  });

  it("clip owner can read her talking video; range requests are honored", async () => {
    state.sessionUserId = ALICE;
    state.voiceRow = false;
    state.clipRow = true;
    const res = await uploadRequest(`talking_${CLIP_ID}.mp4`, { range: "bytes=0-4" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(
      `bytes 0-4/${"alice-talking-video".length}`,
    );
    expect(await res.text()).toBe("alice");
  });

  it("LoRA dataset zip and reference frames both refuse anonymous callers without a signed trainer token", async () => {
    state.sessionUserId = null;
    state.voiceRow = true; // voice exists — existence alone no longer grants the zip
    const zip = await uploadRequest(`lora/${VOICE_ID}/dataset.zip`);
    expect(zip.status).toBe(401);

    const frame = await uploadRequest(`lora/${VOICE_ID}/ref_01.jpg`);
    expect(frame.status).toBe(401);
  });

  it("path traversal is rejected", async () => {
    state.sessionUserId = ALICE;
    const res = await getUpload(
      new NextRequest("http://localhost/uploads/.."),
      { params: Promise.resolve({ path: ["..", "env.local"] }) },
    );
    expect(res.status).toBe(404);
  });
});
