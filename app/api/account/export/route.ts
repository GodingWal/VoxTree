import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  consentRecords,
  dataLifecycleRequests,
  familyChildren,
  familyInvitations,
  familyVoices,
  generatedClips,
  users,
  voiceJobs,
} from "@/lib/db/schema";
import { GCP_PATHS, listObjectsWithDownloadUrls } from "@/lib/gcp";
import { logger } from "@/lib/logger";

/**
 * Export shape note (Phase 4): rows are serialized back to the snake_case
 * keys PostgREST returned, so the downloaded JSON is unchanged.
 * `library_selections` / `library_progress` never existed as tables in
 * either schema — PostgREST errored on them and the export marked them
 * `unavailable`; that behavior is preserved explicitly.
 */
function toExportRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      out[snake] = value instanceof Date ? value.toISOString() : value;
    }
    return out;
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [lifecycleRequest] = await db
    .insert(dataLifecycleRequests)
    .values({ userId: user.id, requestType: "export", status: "processing" })
    .returning({ id: dataLifecycleRequests.id });

  const queries: Array<[string, () => Promise<Array<Record<string, unknown>>>]> = [
    // password_hash is stripped: the pre-migration public.users row never
    // contained a credential, and an export must not start leaking one.
    ["users", async () => {
      const rows = await db.select().from(users).where(eq(users.id, user.id));
      return rows.map(({ passwordHash: _passwordHash, ...rest }) => rest) as Array<Record<string, unknown>>;
    }],
    ["family_voices", async () => (await db.select().from(familyVoices).where(eq(familyVoices.userId, user.id))) as Array<Record<string, unknown>>],
    ["family_children", async () => (await db.select().from(familyChildren).where(eq(familyChildren.userId, user.id))) as Array<Record<string, unknown>>],
    ["family_invitations", async () => (await db.select().from(familyInvitations).where(eq(familyInvitations.userId, user.id))) as Array<Record<string, unknown>>],
    ["generated_clips", async () => (await db.select().from(generatedClips).where(eq(generatedClips.userId, user.id))) as Array<Record<string, unknown>>],
    ["voice_jobs", async () => (await db.select().from(voiceJobs).where(eq(voiceJobs.userId, user.id))) as Array<Record<string, unknown>>],
    ["consent_records", async () => (await db.select().from(consentRecords).where(eq(consentRecords.userId, user.id))) as Array<Record<string, unknown>>],
    ["data_lifecycle_requests", async () => (await db.select().from(dataLifecycleRequests).where(eq(dataLifecycleRequests.userId, user.id))) as Array<Record<string, unknown>>],
  ];

  const data: Record<string, unknown> = {};
  for (const [key, run] of queries) {
    try {
      data[key] = toExportRows(await run());
    } catch {
      data[key] = { unavailable: true };
    }
  }
  data["library_selections"] = { unavailable: true };
  data["library_progress"] = { unavailable: true };

  // Stored media (voice samples, rendered clips, consent proof) as expiring signed URLs.
  let media: unknown;
  try {
    media = await listObjectsWithDownloadUrls([
      `voice-samples/${user.id}/`,
      `clips/${user.id}/`,
      GCP_PATHS.consentVideoPrefix(user.id),
    ]);
  } catch (e) {
    logger.error("account_export_media_failed", { userId: user.id, message: e instanceof Error ? e.message : String(e) });
    media = { unavailable: true };
  }

  logger.info("account_export_completed", { userId: user.id });
  if (lifecycleRequest?.id) {
    await db
      .update(dataLifecycleRequests)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(dataLifecycleRequests.id, lifecycleRequest.id));
  }
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), accountEmail: user.email, data, media, mediaLinksExpireInSeconds: 3600 },
    {
      headers: {
        "Content-Disposition": `attachment; filename="voxtree-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
