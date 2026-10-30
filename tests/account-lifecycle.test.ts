import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route-level tests for the account data-lifecycle routes:
 *   POST /api/account/delete  (app/api/account/delete/route.ts)
 *   GET  /api/account/export  (app/api/account/export/route.ts)
 *
 * Real semantics pinned here:
 * - Both routes resolve identity ONLY from the session
 *   (getCurrentUser); there is no user-id parameter, so a caller can
 *   only ever act on their own account. Delete's final
 *   `db.delete(users)` is scoped by selfUser(session user id) and the
 *   export's every select is scoped by the session user id — the db
 *   mock captures the bound where-params so the tests assert exactly
 *   that scoping.
 * - Delete additionally requires a JSON body
 *   { confirmation: "DELETE", email: <the account's own email> }
 *   (email compared case-insensitively); anything else is a 400 and
 *   no deletion step runs.
 * - Delete happy path: lifecycle row inserted as processing, Stripe
 *   customer deleted (when one exists), every provider voice deleted,
 *   the three storage prefixes purged, active consent rows marked
 *   revoked, then the users row deleted. A failure mid-way marks the
 *   lifecycle row failed and returns 502 without deleting the user.
 * - Export: password_hash is stripped from the users row, keys are
 *   serialized snake_case with Dates as ISO strings, per-table
 *   failures degrade to { unavailable: true } instead of failing the
 *   export, and the media listing degrades the same way.
 */

const getUser = vi.fn();
const stripeDel = vi.fn();
const deleteVoiceProvider = vi.fn();
const deletePrefix = vi.fn();
const listMedia = vi.fn();

const USER = { id: "u1", email: "owner@example.com", name: "Owner" };

const state = vi.hoisted(() => ({
  voices: [] as Array<{ providerVoiceId: string | null }>,
  stripeCustomerId: null as string | null,
  failTable: null as string | null,
  lifecycleSeq: 0,
  inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; values: Record<string, unknown>; params: unknown[] }>,
  deletes: [] as Array<{ table: string; params: unknown[] }>,
  selectWheres: [] as Array<{ table: string; params: unknown[] }>,
}));

/** Recursively collect Drizzle `Param` values bound in a where clause, in order. */
function paramsOf(cond: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const c = node as { queryChunks?: unknown[]; value?: unknown };
    if ((node as object).constructor?.name === "Param") {
      out.push(c.value);
      return;
    }
    if (Array.isArray(c.queryChunks)) c.queryChunks.forEach(walk);
  };
  walk(cond);
  return out;
}

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => (await getUser()) as unknown,
  getCurrentUserId: async () => ((await getUser()) as { id?: string } | null)?.id ?? null,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { customers: { del: (...a: unknown[]) => stripeDel(...a) } },
}));

vi.mock("@/lib/voice-provider", () => ({
  deleteVoice: (...a: unknown[]) => deleteVoiceProvider(...a),
}));

vi.mock("@/lib/gcp", () => ({
  deleteObjectPrefix: (...a: unknown[]) => deletePrefix(...a),
  listObjectsWithDownloadUrls: (...a: unknown[]) => listMedia(...a),
  GCP_PATHS: {
    consentVideoPrefix: (userId: string) => `consent-videos/${userId}/`,
    clipAudio: (u: string, c: string, v: string) => `clips/${u}/${c}/${v}/audio.mp3`,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");

  const exportRowFor = (table: string): Array<Record<string, unknown>> => {
    if (table === "users") {
      return [
        {
          id: "u1",
          email: "owner@example.com",
          name: "Owner",
          passwordHash: "BCRYPT_HASH_MUST_NOT_LEAK",
          stripeCustomerId: "cus_123",
          createdAt: new Date("2026-01-02T03:04:05.000Z"),
        },
      ];
    }
    if (table === "family_voices") {
      return [{ id: "v1", userId: "u1", providerVoiceId: "pv-1", createdAt: new Date("2026-02-03T00:00:00.000Z") }];
    }
    return [{ id: `${table}-row`, userId: "u1" }];
  };

  const chainFor = (result: unknown, shouldThrow = false) => {
    const c: Record<string, unknown> = {};
    for (const m of ["where", "limit", "orderBy"]) c[m] = () => c;
    c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      (shouldThrow
        ? Promise.reject(new Error("select failed"))
        : Promise.resolve(result)
      ).then(res, rej);
    return c;
  };

  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          const c: Record<string, unknown> = {};
          let result: unknown[] = [];
          if (name === "family_voices") {
            // Delete route projects { providerVoiceId }; export wants full rows.
            result = exportMode.current ? exportRowFor(name) : state.voices;
          } else if (name === "users") {
            result = [{ stripeCustomerId: state.stripeCustomerId }];
          } else {
            result = exportRowFor(name);
          }
          c.where = (cond: unknown) => {
            state.selectWheres.push({ table: name, params: paramsOf(cond) });
            return chainFor(
              name === "users" && exportMode.current ? exportRowFor("users") : result,
              state.failTable === name,
            );
          };
          c.limit = () => c;
          c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
            Promise.resolve(result).then(res, rej);
          return c;
        },
      }),
      insert: (table: unknown) => ({
        values: (v: Record<string, unknown>) => {
          const name = getTableName(table as never);
          state.inserts.push({ table: name, values: v });
          const c: Record<string, unknown> = {};
          c.returning = async () => [{ id: `lifecycle-${++state.lifecycleSeq}` }];
          c.then = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
            Promise.resolve([]).then(res, rej);
          return c;
        },
      }),
      update: (table: unknown) => ({
        set: (v: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            const name = getTableName(table as never);
            state.updates.push({ table: name, values: v, params: paramsOf(cond) });
            return Promise.resolve([]);
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: (cond: unknown) => {
          const name = getTableName(table as never);
          state.deletes.push({ table: name, params: paramsOf(cond) });
          return Promise.resolve([]);
        },
      }),
    },
  };
});

// The shared users-select above serves two routes with different
// projections; this flag flips it to the full export row for GET tests.
const exportMode = { current: false };

import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { GET as exportAccount } from "@/app/api/account/export/route";

const jsonReq = (body: unknown) =>
  new Request("http://x/api/account/delete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  exportMode.current = false;
  state.voices = [{ providerVoiceId: "pv-1" }, { providerVoiceId: null }, { providerVoiceId: "pv-2" }];
  state.stripeCustomerId = "cus_123";
  state.failTable = null;
  state.lifecycleSeq = 0;
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.selectWheres = [];
  getUser.mockResolvedValue(USER);
  stripeDel.mockResolvedValue({});
  deleteVoiceProvider.mockResolvedValue(undefined);
  deletePrefix.mockResolvedValue(3);
  listMedia.mockResolvedValue([{ key: "voice-samples/u1/a.mp3", url: "https://signed.example/a" }]);
});

describe("POST /api/account/delete", () => {
  it("401 when unauthenticated — no lifecycle row, no deletion steps", async () => {
    getUser.mockResolvedValue(null);
    const res = await deleteAccount(jsonReq({ confirmation: "DELETE", email: USER.email }));
    expect(res.status).toBe(401);
    expect(state.inserts).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
    expect(stripeDel).not.toHaveBeenCalled();
    expect(deletePrefix).not.toHaveBeenCalled();
  });

  it("401 when the session user has no email", async () => {
    getUser.mockResolvedValue({ id: "u1", email: null });
    const res = await deleteAccount(jsonReq({ confirmation: "DELETE", email: USER.email }));
    expect(res.status).toBe(401);
    expect(state.deletes).toHaveLength(0);
  });

  it("400 when the confirmation is not exactly DELETE", async () => {
    const res = await deleteAccount(jsonReq({ confirmation: "delete", email: USER.email }));
    expect(res.status).toBe(400);
    expect(state.inserts).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
    expect(stripeDel).not.toHaveBeenCalled();
  });

  it("400 when the email belongs to a different account — cannot delete someone else", async () => {
    const res = await deleteAccount(
      jsonReq({ confirmation: "DELETE", email: "victim@example.com" }),
    );
    expect(res.status).toBe(400);
    expect(state.deletes).toHaveLength(0);
    expect(stripeDel).not.toHaveBeenCalled();
    expect(deleteVoiceProvider).not.toHaveBeenCalled();
    expect(deletePrefix).not.toHaveBeenCalled();
  });

  it("400 on a malformed JSON body", async () => {
    const res = await deleteAccount(
      new Request("http://x/api/account/delete", { method: "POST", body: "{nope" }),
    );
    expect(res.status).toBe(400);
    expect(state.deletes).toHaveLength(0);
  });

  it("happy path runs every deletion step, scoped to the session user", async () => {
    const res = await deleteAccount(jsonReq({ confirmation: "DELETE", email: USER.email }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    // Lifecycle audit row opened as a delete in processing state.
    expect(state.inserts).toEqual([
      { table: "data_lifecycle_requests", values: { userId: "u1", requestType: "delete", status: "processing" } },
    ]);
    // Stripe customer removed.
    expect(stripeDel).toHaveBeenCalledTimes(1);
    expect(stripeDel).toHaveBeenCalledWith("cus_123");
    // Every non-null provider voice deleted; the null one skipped.
    expect(deleteVoiceProvider.mock.calls.map((c) => c[0]).sort()).toEqual(["pv-1", "pv-2"]);
    // All three storage prefixes for THIS user purged.
    expect(deletePrefix.mock.calls.map((c) => c[0]).sort()).toEqual([
      "clips/u1/",
      "consent-videos/u1/",
      "voice-samples/u1/",
    ]);
    // Consent rows marked revoked before the cascading user delete.
    const consentUpdate = state.updates.find((u) => u.table === "consent_records");
    expect(consentUpdate).toBeDefined();
    expect(consentUpdate!.values.revokedAt).toBeInstanceOf(Date);
    expect(consentUpdate!.params).toContain("u1");
    // The users-row delete — the cascade source — is scoped to the
    // session user's own id and nothing else.
    expect(state.deletes).toEqual([{ table: "users", params: ["u1"] }]);
    // Every read along the way was owner-scoped to u1 as well.
    for (const w of state.selectWheres) {
      expect(w.params).toContain("u1");
      expect(w.params).not.toContain("victim@example.com");
    }
  });

  it("accepts the account email in different letter case", async () => {
    const res = await deleteAccount(
      jsonReq({ confirmation: "DELETE", email: "OWNER@Example.COM" }),
    );
    expect(res.status).toBe(200);
    expect(state.deletes).toEqual([{ table: "users", params: ["u1"] }]);
  });

  it("skips the Stripe deletion when the account has no Stripe customer", async () => {
    state.stripeCustomerId = null;
    const res = await deleteAccount(jsonReq({ confirmation: "DELETE", email: USER.email }));
    expect(res.status).toBe(200);
    expect(stripeDel).not.toHaveBeenCalled();
    expect(state.deletes).toEqual([{ table: "users", params: ["u1"] }]);
  });

  it("502 and an auditable failed lifecycle row when a deletion step throws; user row kept", async () => {
    stripeDel.mockRejectedValue(new Error("stripe is down"));
    const res = await deleteAccount(jsonReq({ confirmation: "DELETE", email: USER.email }));
    expect(res.status).toBe(502);

    expect(state.deletes).toHaveLength(0); // users row NOT deleted
    const failure = state.updates.find((u) => u.table === "data_lifecycle_requests");
    expect(failure).toBeDefined();
    expect(failure!.values).toEqual({ status: "failed", failureReason: "stripe is down" });
    expect(failure!.params).toContain("u1");
  });
});

describe("GET /api/account/export", () => {
  beforeEach(() => {
    exportMode.current = true;
    state.voices = []; // export reads full rows from exportRowFor
  });

  it("401 when unauthenticated — no lifecycle row is opened", async () => {
    getUser.mockResolvedValue(null);
    const res = await exportAccount();
    expect(res.status).toBe(401);
    expect(state.inserts).toHaveLength(0);
    expect(listMedia).not.toHaveBeenCalled();
  });

  it("happy path exports the session user's data with the password hash stripped", async () => {
    const res = await exportAccount();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=\"voxtree-export-");

    const body = await res.json();
    expect(body.accountEmail).toBe(USER.email);
    expect(typeof body.exportedAt).toBe("string");
    expect(body.mediaLinksExpireInSeconds).toBe(3600);
    expect(body.media).toEqual([{ key: "voice-samples/u1/a.mp3", url: "https://signed.example/a" }]);

    // Users row: snake_case keys, Date serialized to ISO, NO credential.
    expect(body.data.users).toHaveLength(1);
    const exportedUser = body.data.users[0];
    expect(exportedUser.email).toBe("owner@example.com");
    expect(exportedUser.created_at).toBe("2026-01-02T03:04:05.000Z");
    expect(exportedUser).not.toHaveProperty("password_hash");
    expect(exportedUser).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(body)).not.toContain("BCRYPT_HASH_MUST_NOT_LEAK");

    // Other tables present, snake_cased.
    expect(body.data.family_voices[0].provider_voice_id).toBe("pv-1");
    for (const key of [
      "family_children", "family_invitations", "generated_clips",
      "voice_jobs", "consent_records", "data_lifecycle_requests",
    ]) {
      expect(Array.isArray(body.data[key]), key).toBe(true);
    }
    // Tables that never existed stay explicitly unavailable.
    expect(body.data.library_selections).toEqual({ unavailable: true });
    expect(body.data.library_progress).toEqual({ unavailable: true });

    // Lifecycle bookkeeping: opened as processing, closed as completed.
    expect(state.inserts).toEqual([
      { table: "data_lifecycle_requests", values: { userId: "u1", requestType: "export", status: "processing" } },
    ]);
    const completion = state.updates.find((u) => u.table === "data_lifecycle_requests");
    expect(completion!.values.status).toBe("completed");
    expect(completion!.values.completedAt).toBeInstanceOf(Date);
    expect(completion!.params).toContain("lifecycle-1");

    // Media listing asked for exactly this user's three prefixes.
    expect(listMedia).toHaveBeenCalledWith([
      "voice-samples/u1/",
      "clips/u1/",
      "consent-videos/u1/",
    ]);
  });

  it("scopes every export select to the session user — no other account's rows", async () => {
    await exportAccount();
    expect(state.selectWheres.length).toBeGreaterThanOrEqual(8);
    for (const w of state.selectWheres) {
      expect(w.params, w.table).toContain("u1");
    }
  });

  it("degrades a failing table to unavailable instead of failing the export", async () => {
    state.failTable = "family_children";
    const res = await exportAccount();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.family_children).toEqual({ unavailable: true });
    expect(Array.isArray(body.data.family_voices)).toBe(true);
    expect(Array.isArray(body.data.users)).toBe(true);
  });

  it("degrades the media listing to unavailable when storage fails", async () => {
    listMedia.mockRejectedValue(new Error("gcs down"));
    const res = await exportAccount();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.media).toEqual({ unavailable: true });
    expect(Array.isArray(body.data.users)).toBe(true);
  });
});
