import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { checkLoraTrainingStatus } from "@/lib/replicate";

/**
 * Poll the LoRA training status for a voice. Falls back to syncing with
 * Replicate when the local row hasn't been updated by the webhook (useful in
 * local dev where webhooks aren't reachable, and as a safety net in prod).
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const voiceId = request.nextUrl.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "voiceId required" }, { status: 400 });

  const [row] = await db
    .select({
      loraStatus: familyVoices.loraStatus,
      loraTrainingId: familyVoices.loraTrainingId,
      loraVersion: familyVoices.loraVersion,
      loraTriggerWord: familyVoices.loraTriggerWord,
      loraWeightsUrl: familyVoices.loraWeightsUrl,
    })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If still training and we have a training id, ask Replicate directly so
  // dev flows don't depend on webhook reachability.
  if (row.loraStatus === "training" && row.loraTrainingId) {
    // Revoked consent must not be bypassed by the polling completion path.
    if (!(await hasActiveConsent(user.id))) {
      await db
        .update(familyVoices)
        .set({ loraStatus: "failed", loraVersion: null, loraWeightsUrl: null })
        .where(eq(familyVoices.id, voiceId));
      return NextResponse.json({ status: "failed", consentRequired: true }, { status: 403 });
    }
    try {
      const remote = await checkLoraTrainingStatus(row.loraTrainingId);
      if (remote.status === "succeeded") {
        const trainedVersion =
          (remote as any).version ||
          (remote as any).output?.version ||
          null;
        const weightsUrl =
          (remote as any).output?.weights ??
          (typeof (remote as any).output === "string"
            ? (remote as any).output
            : null);

        await db
          .update(familyVoices)
          .set({
            loraStatus: "ready",
            loraVersion: trainedVersion,
            loraWeightsUrl: weightsUrl,
          })
          .where(eq(familyVoices.id, voiceId));

        return NextResponse.json({
          status: "ready",
          version: trainedVersion,
          triggerWord: row.loraTriggerWord,
        });
      }
      if (remote.status === "failed") {
        await db
          .update(familyVoices)
          .set({ loraStatus: "failed" })
          .where(eq(familyVoices.id, voiceId));
        return NextResponse.json({ status: "failed" });
      }
    } catch {
      // Network hiccup — return the cached status below.
    }
  }

  return NextResponse.json({
    status: row.loraStatus ?? "not_started",
    version: row.loraVersion,
    triggerWord: row.loraTriggerWord,
  });
}
