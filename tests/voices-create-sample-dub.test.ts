import { describe, it, expect, vi, beforeEach } from "vitest";

// Item 8 wiring test: POST /api/voices/create enqueues the sample-dub
// clip_generate job BEFORE the voice is cloned (cloning runs later,
// inline, in /api/voices/process). The voice worker treats
// "not cloned yet" as retryable, so the enqueue must carry a raised
// maxAttempts (10, not the enqueueJob default of 3) or a slow clone
// can permanently fail the dub. This test captures the exact values
// the route passes to the voice_jobs insert.

const inserts = vi.hoisted(
  () => [] as Array<{ table: string; values: Record<string, unknown> }>
);

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => ({
    id: "user-a",
    email: "user-a@example.com",
    name: "User A",
  }),
  getCurrentUserId: async () => "user-a",
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
        from: () =>
          chain([{ consentVerified: true, consentNoticeVersion: "v1" }]),
      }),
      insert: (table: unknown) => ({
        values: (v: Record<string, unknown>) => {
          const name = getTableName(table as never);
          inserts.push({ table: name, values: v });
          return {
            returning: async () => {
              if (name === "family_voices") return [{ id: "voice-1" }];
              // voice_jobs row, in the Drizzle camelCase shape
              // lib/voice-jobs' enqueueJob maps back to a VoiceJob.
              return [
                {
                  id: "job-1",
                  userId: v.userId,
                  type: v.type,
                  payload: v.payload ?? {},
                  status: v.status ?? "queued",
                  attempts: 0,
                  maxAttempts: v.maxAttempts ?? 3,
                  lastError: null,
                  workerId: null,
                  result: null,
                  idempotencyKey: v.idempotencyKey ?? null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
                  lockedUntil: null,
                },
              ];
            },
          };
        },
      }),
    },
  };
});

vi.mock("@/lib/limits", () => ({
  checkLimit: async () => ({ allowed: true }),
}));

vi.mock("@/lib/gcp", () => ({
  getPresignedUploadUrl: async () =>
    "https://storage.googleapis.com/bucket/voices/user-a/voice-1.mp3?sig=xxx",
  GCP_PATHS: {
    voiceSample: (uid: string, vid: string) => `voices/${uid}/${vid}.mp3`,
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  enforcePaidRateLimit: async () => null,
  enforceUserRateLimit: async () => null,
  safeJson: async (request: Request) => {
    try {
      const text = await request.text();
      return { body: text ? JSON.parse(text) : {} };
    } catch {
      const { NextResponse } = await import("next/server");
      return {
        error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      };
    }
  },
}));

vi.mock("@/lib/abuse-detection", () => ({
  checkAbuse: () => ({ blocked: false }),
}));

import { POST as createVoice } from "@/app/api/voices/create/route";

function reqJson(body: unknown) {
  return new Request("http://localhost/api/voices/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  inserts.length = 0;
});

describe("POST /api/voices/create — sample-dub enqueue", () => {
  it("enqueues the sample dub with maxAttempts 10 so a slow clone cannot kill it in 3 tries", async () => {
    const res = await createVoice(
      reqJson({
        name: "Grandma",
        voiceOwnerName: "Grandma Example",
        voiceOwnerRelationship: "Grandmother",
        voiceOwnerAuthorized: true,
        contentType: "audio/wav",
      })
    );
    expect(res.status).toBe(200);

    const jobInsert = inserts.find((i) => i.table === "voice_jobs");
    expect(jobInsert).toBeDefined();
    expect(jobInsert!.values.type).toBe("clip_generate");
    expect(jobInsert!.values.maxAttempts).toBe(10);
    expect(jobInsert!.values.idempotencyKey).toBe("sample-dub-voice-1");
    const payload = jobInsert!.values.payload as Record<string, unknown>;
    expect(payload.source).toBe("voice_create_sample_dub");
    expect(payload.voiceId).toBe("voice-1");
  });
});
