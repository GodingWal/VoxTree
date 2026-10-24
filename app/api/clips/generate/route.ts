import { and, eq, inArray, lt } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth/session";
import { clipOwnedBy, voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { contentLibrary, familyVoices, generatedClips } from "@/lib/db/schema";
import { checkLimit } from "@/lib/limits";
import { getCachedAudio } from "@/lib/cache";
import { generateSpeech } from "@/lib/voice-provider";
import { getPresignedUploadUrl, GCP_PATHS } from "@/lib/gcp";
import { checkAbuse } from "@/lib/abuse-detection";
import { applyWatermark } from "@/lib/watermark";
import {
  enforcePaidRateLimit,
  enforceUserRateLimit,
  safeJson,
} from "@/lib/api-helpers";
import { checkCostCap, recordUsage } from "@/lib/cost-tracking";
import { logger } from "@/lib/logger";
import Replicate from "replicate";
import fs from "fs";
import path from "path";
import os from "os";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasActiveConsent } from "@/lib/consent";
import { sendOperationalAlert } from "@/lib/monitoring";

// Lazy loader for fluent-ffmpeg so @ffmpeg-installer is not evaluated at build time
async function getFfmpeg() {
  const [{ default: ffmpeg }, ffmpegInstaller] = await Promise.all([
    import("fluent-ffmpeg"),
    import("@ffmpeg-installer/ffmpeg"),
  ]);
  (ffmpeg as any).setFfmpegPath((ffmpegInstaller as any).path);
  return ffmpeg as any;
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "dummy_token",
});

const generateSchema = z.object({
  contentId: z.string().uuid(),
  voiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasActiveConsent(user.id))) {
    return NextResponse.json({ error: "Active parental consent is required.", consentRequired: true }, { status: 403 });
  }

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = generateSchema.safeParse(parsedJson.body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { contentId, voiceId } = parsed.data;

  // Per-user durable cap: 20 clip-generates per hour. Prevents a buggy
  // client from burning through the monthly cap in one runaway loop.
  const userLimited = await enforceUserRateLimit({
    userId: user.id,
    bucket: "clip_generate",
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (userLimited) return userLimited;

  // Check clip generation limit (clips count against the videos limit)
  const limitCheck = await checkLimit(user.id, "add_video");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitCheck.reason,
        upgradeRequired: true,
        upgradePrompt: limitCheck.upgradePrompt,
      },
      { status: 403 }
    );
  }

  // Abuse fence: check content text for celebrity impersonation before queueing
  // (voice-specific check happens after voice fetch in the background job, but
  // we also do a lightweight pre-check on the content script if available)
  {
    const [_abuseContent] = await db
      .select({ textScript: contentLibrary.textScript })
      .from(contentLibrary)
      .where(eq(contentLibrary.id, contentId))
      .limit(1);
    const script = _abuseContent?.textScript ?? null;
    if (script) {
      const abusePre = checkAbuse({
        voiceOwnerName: null,
        voiceName: null,
        textScript: script,
        authUser: {
          id: user.id,
          email: user.email ?? null,
          displayName: user.name ?? null,
          user_metadata: null,
        },
      });
      if (abusePre.blocked) {
        return NextResponse.json({ error: abusePre.reason, code: abusePre.code }, { status: 403 });
      }
    }
  }

  // Fetch the content details to determine mode
  const [content] = await db
    .select({
      contentMode: contentLibrary.contentMode,
      textScript: contentLibrary.textScript,
      isolatedVocalsUrl: contentLibrary.isolatedVocalsUrl,
      instrumentalUrl: contentLibrary.instrumentalUrl,
      originalVideoUrl: contentLibrary.originalVideoUrl,
    })
    .from(contentLibrary)
    .where(eq(contentLibrary.id, contentId))
    .limit(1);

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  if (content.contentMode === "tts" && !content.textScript) {
    return NextResponse.json({ error: "This story does not have a text script configured." }, { status: 400 });
  }

  if (!content.instrumentalUrl) {
    return NextResponse.json({ error: "This story is missing a background music track." }, { status: 400 });
  }

  // Abuse fence: verify selected voice is not a celebrity impersonation
  {
    // Owner-scoped: under RLS this read could not see another user's voice.
    const [voiceForAbuse] = await db
      .select({ name: familyVoices.name, voiceOwnerName: familyVoices.voiceOwnerName })
      .from(familyVoices)
      .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
      .limit(1);
    if (voiceForAbuse) {
      const voiceAbuse = checkAbuse({
        voiceOwnerName: voiceForAbuse.voiceOwnerName ?? null,
        voiceName: voiceForAbuse.name ?? null,
        authUser: {
          id: user.id,
          email: user.email ?? null,
          displayName: user.name ?? null,
          user_metadata: null,
        },
      });
      if (voiceAbuse.blocked) {
        return NextResponse.json({ error: voiceAbuse.reason, code: voiceAbuse.code }, { status: 403 });
      }
    }
  }

  // Check cache first
  const cachedUrl = await getCachedAudio(contentId, voiceId);
  if (cachedUrl) {
    return NextResponse.json({
      status: "ready",
      videoUrl: cachedUrl,
      cached: true,
    });
  }

  // Auto-cleanup any stuck clips for this user (created > 15 mins ago and still processing/queued)
  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await db
      .update(generatedClips)
      .set({ status: "failed" })
      .where(
        and(
          clipOwnedBy(user.id),
          inArray(generatedClips.status, ["queued", "processing"]),
          lt(generatedClips.createdAt, fifteenMinsAgo)
        )
      );
  } catch (cleanupErr) {
    console.error("Failed to clean up stuck clips:", cleanupErr);
  }

  // Create a clip record in queued status
  let clip: { id: string } | undefined;
  try {
    [clip] = await db
      .insert(generatedClips)
      .values({
        userId: user.id,
        contentId,
        voiceId,
        status: "queued",
      })
      .returning();
  } catch {
    clip = undefined;
  }

  if (!clip) {
    return NextResponse.json(
      { error: "Failed to create clip record" },
      { status: 500 }
    );
  }

  // Background processing function
  const processClip = async () => {
    const ffmpeg = await getFfmpeg();
    try {
      // Fetch voice details
      const [voice] = await db
        .select({
          providerVoiceId: familyVoices.providerVoiceId,
          rvcModelId: familyVoices.rvcModelId,
        })
        .from(familyVoices)
        .where(eq(familyVoices.id, voiceId))
        .limit(1);

      if (!voice) throw new Error("Voice not found");

      const tmpDir = os.tmpdir();
      const speechFile = path.join(tmpDir, `${clip.id}-speech.mp3`);
      const bgFile = path.join(tmpDir, `${clip.id}-bg.mp3`);
      const outputFile = path.join(tmpDir, `${clip.id}-output.mp4`); // or mp3

      let rawVocalsBuffer: Buffer;

      if (content.contentMode === "tts") {
        if (!voice.providerVoiceId) throw new Error("TTS voice not set up");
        const textScript = content.textScript ?? "";
        const charCount = textScript.length;
        const costCheck = await checkCostCap(user.id, {
          kind: "tts_chars",
          chars: charCount,
        });
        if (!costCheck.allowed) {
          throw new Error(costCheck.reason ?? "Cost cap reached");
        }
        logger.info(`Generating speech via Chatterbox for clip ${clip.id}`);
        rawVocalsBuffer = await generateSpeech(voice.providerVoiceId, textScript);
        await recordUsage(user.id, { kind: "tts_chars", chars: charCount });
      } else if (content.contentMode === "v2v") {
        if (!voice.rvcModelId) throw new Error("V2V singing voice not set up");
        const costCheck = await checkCostCap(user.id, { kind: "replicate_inference" });
        if (!costCheck.allowed) {
          throw new Error(costCheck.reason ?? "Cost cap reached");
        }
        logger.info(`Triggering Replicate V2V workflow for clip ${clip.id}`);

        // Replicate RVC inference
        const modelStr = `${voice.rvcModelId}` as `${string}/${string}`;
        const output = await replicate.run(
          modelStr, // In reality, this would be the model owner/name:version
          {
            input: {
              song_input: content.isolatedVocalsUrl,
              pitch_change: 0,
            }
          }
        ) as unknown as string;

        // Download the output from Replicate
        const repRes = await fetch(output);
        rawVocalsBuffer = Buffer.from(await repRes.arrayBuffer());
        await recordUsage(user.id, { kind: "replicate_inference" });
      } else {
        throw new Error("Unsupported content mode");
      }

      // Download instrumental
      logger.info(`Downloading instrumental for clip ${clip.id}`);
      const bgRes = await fetch(content.instrumentalUrl!);
      const bgBuffer = Buffer.from(await bgRes.arrayBuffer());
      fs.writeFileSync(bgFile, bgBuffer);

      if (rawVocalsBuffer.length === 0) {
        logger.info(`Empty vocals buffer (simulation mode). Copying instrumental directly.`);
        fs.copyFileSync(bgFile, outputFile);
      } else {
        // Save raw vocals to disk
        fs.writeFileSync(speechFile, rawVocalsBuffer);

        // Mix with FFmpeg
        logger.info(`Mixing audio via FFmpeg for clip ${clip.id}`);
        await new Promise<void>((resolve, reject) => {
          ffmpeg()
            .input(speechFile)
            .input(bgFile)
            .complexFilter([
              "[0:a]volume=1.0[a0]",
              "[1:a]volume=0.3[a1]",
              "[a0][a1]amix=inputs=2:duration=first[aout]"
            ])
            .outputOptions(["-map [aout]", "-c:a libmp3lame", "-b:a 192k"])
            .output(outputFile)
            .on("end", () => resolve())
            .on("error", (err: any) => reject(err))
            .run();
        });
      }

      // Upload to GCP
      logger.info(`Uploading output to GCP for clip ${clip.id}`);
      let outputBuffer: Buffer = fs.readFileSync(outputFile);
      // Watermark the final mixed output: FFmpeg re-encoding would strip a trailer
      // applied to the raw vocals.
      try {
        outputBuffer = applyWatermark(outputBuffer, {
          clipId: clip.id,
          userId: user.id,
          timestamp: Date.now(),
        });
      } catch (wmErr) {
        logger.warn("clip_watermark_failed", {
          clipId: clip.id,
          error: wmErr instanceof Error ? wmErr.message : String(wmErr),
        });
      }        
      const gcpKey = GCP_PATHS.clipAudio(user.id, contentId, voiceId);
      const uploadUrl = await getPresignedUploadUrl(gcpKey, "audio/mpeg");
      
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/mpeg" },
        body: new Uint8Array(outputBuffer),
      });

      // Update DB
      await db
        .update(generatedClips)
        .set({
          status: "ready",
          outputAudioUrl: gcpKey,
          outputVideoUrl: gcpKey,
          cached: true
        })
        .where(eq(generatedClips.id, clip.id));

      // Cleanup temp files
      if (fs.existsSync(speechFile)) fs.unlinkSync(speechFile);
      if (fs.existsSync(bgFile)) fs.unlinkSync(bgFile);
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      
      logger.info(`Completed successfully for clip ${clip.id}`);

    } catch (err: any) {
      logger.error("clip_generation_failed", {
        clipId: clip.id,
        userId: user.id,
        contentId,
        voiceId,
        message: err?.message ?? "Unknown error",
      });
      await sendOperationalAlert("clip_generation_failed_alert", { clipId: clip.id, userId: user.id, contentId, voiceId });
      await db
        .update(generatedClips)
        .set({ status: "failed" })
        .where(eq(generatedClips.id, clip.id));
    }
  };

  // Fire and forget background execution (supported on GCP Compute VM)
  processClip();

  // For now, return the clip ID for status polling

  return NextResponse.json({
    clipId: clip.id,
    status: "queued",
  });
}
