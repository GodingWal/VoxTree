import { and, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { consentOwnedBy, selfUser, voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  consentRecords,
  dataLifecycleRequests,
  familyVoices,
  users,
} from "@/lib/db/schema";
import { deleteVoice } from "@/lib/voice-provider";
import { deleteVoiceMedia, deleteObjectPrefix, GCP_PATHS } from "@/lib/gcp";
import { logger } from "@/lib/logger";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };
  const now = new Date();

  try {
    await db.update(users).set({ consentVerified: false }).where(selfUser(user.id));
  } catch {
    return NextResponse.json({ error: "Consent could not be revoked" }, { status: 500 });
  }

  await db
    .update(consentRecords)
    .set({ revokedAt: now })
    .where(and(consentOwnedBy(user.id), isNull(consentRecords.revokedAt)));
  await db.insert(dataLifecycleRequests).values({ userId: user.id, requestType: "revoke_consent", status: "completed", completedAt: now });

  // Auto-purge: delete all private voice media and consent video proof for this user.
  // Best-effort: each step runs independently so one failure (e.g. a provider outage)
  // cannot skip the rest; failures are logged but do not fail the revocation itself,
  // since the auditable revoked_at is the source of truth.
  const failures: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  let voiceRows: { id: string; providerVoiceId: string | null }[] = [];
  await step("list_voices", async () => {
    voiceRows = await db
      .select({ id: familyVoices.id, providerVoiceId: familyVoices.providerVoiceId })
      .from(familyVoices)
      .where(voiceOwnedBy(user.id));
  });

  // Delete the provider-side biometric voice clones. Rows whose clone was deleted lose
  // the provider id; every row is marked failed so a later re-consent cannot resurrect
  // a revoked clone (a row whose deletion failed keeps its id for retry).
  const deletedIds: string[] = [];
  await Promise.all(
    voiceRows
      .filter((v) => v.providerVoiceId)
      .map((v) =>
        step(`delete_voice:${v.id}`, async () => {
          await deleteVoice(v.providerVoiceId!);
          deletedIds.push(v.id);
        })
      )
  );
  if (voiceRows.length > 0) {
    await step("neutralise_voices", async () => {
      await db
        .update(familyVoices)
        .set({ status: "failed" })
        .where(voiceOwnedBy(user.id));
      if (deletedIds.length > 0) {
        await db
          .update(familyVoices)
          .set({ providerVoiceId: null })
          .where(inArray(familyVoices.id, deletedIds));
      }
    });
  }

  // Delete each voice's sampled media and any clips that reference it
  await Promise.all(voiceRows.map((v) => step(`delete_media:${v.id}`, () => deleteVoiceMedia(user.id, v.id))));

  // Catch any stray voice-samples/clips not tied to a known voice row
  await step("purge_voice_samples", () => deleteObjectPrefix(`voice-samples/${user.id}/`));
  await step("purge_clips", () => deleteObjectPrefix(`clips/${user.id}/`));

  // Purge consent video selfie proofs
  await step("purge_consent_video", () => deleteObjectPrefix(GCP_PATHS.consentVideoPrefix(user.id)));

  if (failures.length > 0) {
    logger.error("revoke_consent_purge_failed", { userId: user.id, failures });
  }

  logger.warn("account_consent_revoked", { userId: user.id });
  return NextResponse.json({ success: true });
}
