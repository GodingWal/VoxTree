import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloneVoice, deleteVoice } from "@/lib/elevenlabs";
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

const processSchema = z.object({
  voiceId: z.string().uuid(),
});

/**
 * Process a voice cloning request after audio has been uploaded to GCS.
 * Authenticates the caller and operates as the signed-in user — never trust
 * a userId supplied in the body.
 *
 * Idempotent: if the voice already has an elevenlabs_voice_id, we return the
 * existing record instead of re-cloning (avoids double-billing on retries).
 * If a sample with the same sha256 was previously cloned for this user, we
 * reuse that ElevenLabs voice id.
 *
 * Saga cleanup: if the post-ElevenLabs DB write fails, we delete the
 * just-created ElevenLabs voice so we don't leak paid resources.
 */
export async function POST(request: Request) {
  const rateLimited = enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const { data: voice } = await supabase
    .from("family_voices")
    .select("id, name, user_id, elevenlabs_voice_id, status")
    .eq("id", voiceId)
    .single();

  if (!voice || voice.user_id !== userId) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }

  // Idempotency: already cloned. Return success without re-billing.
  if (voice.elevenlabs_voice_id && voice.status === "ready") {
    return NextResponse.json({
      status: "ready",
      elevenlabsVoiceId: voice.elevenlabs_voice_id,
      idempotent: true,
    });
  }

  const admin = createAdminClient();
  const gcpKey = GCP_PATHS.voiceSample(userId, voiceId);

  // Defense in depth on the upload size cap. The presigned URL is bound
  // to AUDIO_LIMITS.maxBytes already; this catches mis-configurations.
  const metadata = await getObjectMetadata(gcpKey);
  if (metadata && metadata.size > AUDIO_LIMITS.maxBytes) {
    await admin.from("family_voices").update({ status: "failed" }).eq("id", voiceId);
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

  let elevenlabsVoiceId: string | null = null;
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
    // exact audio under another voice, reuse the existing ElevenLabs id.
    const { data: existing } = await admin
      .from("family_voices")
      .select("elevenlabs_voice_id")
      .eq("user_id", userId)
      .eq("sample_sha256", probe.sha256)
      .not("elevenlabs_voice_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (existing?.elevenlabs_voice_id) {
      elevenlabsVoiceId = existing.elevenlabs_voice_id;
      logger.info("voice_clone_reused_by_hash", {
        voiceId,
        userId,
        sha256: probe.sha256,
      });
    } else {
      // Transcode to a clean MP3 before submitting to ElevenLabs. This
      // avoids mid-clone rejections on unsupported codecs/containers and
      // shrinks the upload by ~50%.
      const normalized = await transcodeToMp3(rawBuffer);
      elevenlabsVoiceId = await cloneVoice(normalized, voice.name);
      createdNewVoice = true;
    }

    const { error: updateError } = await admin
      .from("family_voices")
      .update({
        elevenlabs_voice_id: elevenlabsVoiceId,
        sample_audio_url: gcpKey,
        sample_sha256: probe.sha256,
        sample_duration_seconds: probe.durationSeconds,
        sample_bytes: probe.bytes,
        status: "ready",
      })
      .eq("id", voiceId);

    if (updateError) {
      throw new Error(`DB update failed: ${updateError.message}`);
    }

    return NextResponse.json({
      status: "ready",
      elevenlabsVoiceId,
    });
  } catch (error) {
    // Saga cleanup: if we created a paid ElevenLabs voice but couldn't
    // persist the link, delete it from ElevenLabs so we don't pay rent
    // on an orphan.
    if (createdNewVoice && elevenlabsVoiceId) {
      try {
        await deleteVoice(elevenlabsVoiceId);
      } catch (cleanupErr) {
        logger.warn("voice_clone_cleanup_failed", {
          elevenlabsVoiceId,
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
    await admin
      .from("family_voices")
      .update({ status: "failed" })
      .eq("id", voiceId);

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
