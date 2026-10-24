import { and, eq, isNotNull } from "drizzle-orm";

import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { cloneVoice, deleteVoice } from "@/lib/voice-provider";
import {
  getPresignedDownloadUrl,
  GCP_PATHS,
  getObjectMetadata,
} from "@/lib/gcp";
import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
import {
  probeAudio,
  assertAudioWithinLimits,
  AudioValidationError,
  AUDIO_LIMITS,
} from "@/lib/audio-validation";
import { transcodeToMp3 } from "@/lib/audio-transcode";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasActiveConsent } from "@/lib/consent";
import { sendOperationalAlert } from "@/lib/monitoring";

const processSchema = z.object({
  voiceId: z.string().uuid(),
});

/**
 * Process a voice cloning request after audio has been uploaded to GCS.
 * Authenticates the caller and operates as the signed-in user — never trust
 * a userId supplied in the body.
 *
 * Idempotent: if the voice already has a provider_voice_id, we return the
 * existing record instead of re-cloning (avoids duplicate clones on retries).
 * If a sample with the same sha256 was previously cloned for this user, we
 * reuse that provider voice id.
 *
 * Saga cleanup: if the post-clone DB write fails, we delete the
 * just-created provider voice so we don't leak orphaned clones.
 */
export async function POST(request: Request) {
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const userIdFromSession = await getCurrentUserId();

  if (!userIdFromSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userIdFromSession };

  if (!(await hasActiveConsent(user.id))) {
    return NextResponse.json({ error: "Active parental consent is required.", consentRequired: true }, { status: 403 });
  }

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = processSchema.safeParse(parsedJson.body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { voiceId } = parsed.data;
  const userId = user.id;

  // Verify the voice record exists and belongs to the caller.
  const [voice] = await db
    .select({
      id: familyVoices.id,
      name: familyVoices.name,
      userId: familyVoices.userId,
      providerVoiceId: familyVoices.providerVoiceId,
      status: familyVoices.status,
    })
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);

  if (!voice || voice.userId !== userId) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // Idempotency: already cloned. Return success without re-billing.
  if (voice.providerVoiceId && voice.status === "ready") {
    return NextResponse.json({
      status: "ready",
      providerVoiceId: voice.providerVoiceId,
      idempotent: true,
    });
  }

  const gcpKey = GCP_PATHS.voiceSample(userId, voiceId);

  // Defense in depth on the upload size cap. The presigned URL is bound
  // to AUDIO_LIMITS.maxBytes already; this catches mis-configurations.
  const metadata = await getObjectMetadata(gcpKey);
  if (metadata && metadata.size > AUDIO_LIMITS.maxBytes) {
    await db.update(familyVoices).set({ status: "failed" }).where(eq(familyVoices.id, voiceId));
    return NextResponse.json(
      {
        error: "Audio too large",
        code: "too_large",
        maxBytes: AUDIO_LIMITS.maxBytes,
        actualBytes: metadata.size,
      },
      { status: 400 }
    );
  }

  let providerVoiceId: string | null = null;
  let createdNewVoice = false;

  try {
    const downloadUrl = await getPresignedDownloadUrl(gcpKey);
    const audioResponse = await fetch(downloadUrl);
    if (!audioResponse.ok) {
      throw new AudioValidationError(
        "unreadable",
        `Failed to download uploaded audio: ${audioResponse.status}`
      );
    }
    const rawBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Probe + validate against AUDIO_LIMITS. Surface a typed error code
    // so the UI can show a useful remediation message.
    const probe = await probeAudio(rawBuffer);
    assertAudioWithinLimits(probe);

    // Idempotency by content hash: if the same user already cloned this
    // exact audio under another voice, reuse the existing provider id.
    const [existing] = await db
      .select({ providerVoiceId: familyVoices.providerVoiceId })
      .from(familyVoices)
      .where(
        and(
          voiceOwnedBy(userId),
          eq(familyVoices.sampleSha256, probe.sha256),
          isNotNull(familyVoices.providerVoiceId)
        )
      )
      .limit(1);

    if (existing?.providerVoiceId) {
      providerVoiceId = existing.providerVoiceId;
      logger.info("voice_clone_reused_by_hash", {
        voiceId,
        userId,
        sha256: probe.sha256,
      });
    } else {
      // Transcode to a clean MP3 before submitting to the voice provider. This
      // avoids mid-clone rejections on unsupported codecs/containers and
      // shrinks the upload by ~50%.
      const normalized = await transcodeToMp3(rawBuffer);
      providerVoiceId = await cloneVoice(normalized, voice.name);
      createdNewVoice = true;
    }

    try {
      await db
        .update(familyVoices)
        .set({
          providerVoiceId: providerVoiceId,
          sampleAudioKey: gcpKey,
          sampleSha256: probe.sha256,
          sampleDurationSeconds: String(probe.durationSeconds),
          sampleBytes: probe.bytes,
          status: "ready",
        })
        .where(eq(familyVoices.id, voiceId));
    } catch (updateError) {
      throw new Error(
        `DB update failed: ${updateError instanceof Error ? updateError.message : "Unknown error"}`
      );
    }

    return NextResponse.json({
      status: "ready",
      providerVoiceId,
    });
  } catch (error) {
    // Saga cleanup: if we created a provider voice but couldn't
    // persist the link, delete it from the provider so it is not orphaned
    // on an orphan.
    if (createdNewVoice && providerVoiceId) {
      try {
        await deleteVoice(providerVoiceId);
      } catch (cleanupErr) {
        logger.warn("voice_clone_cleanup_failed", {
          providerVoiceId,
          voiceId,
          message:
            cleanupErr instanceof Error ? cleanupErr.message : "Unknown error",
        });
      }
    }

    logger.error("voice_clone_failed", {
      voiceId,
      userId,
      code: error instanceof AudioValidationError ? error.code : undefined,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await sendOperationalAlert("voice_clone_failed_alert", { voiceId, userId, code: error instanceof AudioValidationError ? error.code : "internal" });
    await db
      .update(familyVoices)
      .set({ status: "failed" })
      .where(eq(familyVoices.id, voiceId));

    if (error instanceof AudioValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Voice cloning failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
