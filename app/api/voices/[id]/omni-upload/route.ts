import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth/session";
import { selfUser, voiceOwnedBy } from "@/lib/authz";
import { hasActiveConsent, requireActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { familyVoices, users } from "@/lib/db/schema";
import { cloneVoice } from "@/lib/voice-provider";
import { replicate } from "@/lib/replicate";
import { UPLOADS_DIR } from "@/lib/uploads";
import { promises as fs } from "fs";
import path from "path";

// fluent-ffmpeg + binary paths are resolved lazily inside the handler so
// the @ffmpeg-installer / @ffprobe-installer packages are never evaluated
// at build time (they use dynamic require() that webpack can't bundle).
async function getFfmpeg() {
  const [{ default: ffmpeg }, ffmpegInstaller, ffprobeInstaller] = await Promise.all([
    import("fluent-ffmpeg"),
    import("@ffmpeg-installer/ffmpeg"),
    import("@ffprobe-installer/ffprobe"),
  ]);
  ffmpeg.setFfmpegPath((ffmpegInstaller as any).path);
  ffmpeg.setFfprobePath((ffprobeInstaller as any).path);
  return ffmpeg;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = { id: userId };

    const consentBlocked = await requireActiveConsent(user.id);
    if (consentBlocked) return consentBlocked;

    // Ownership: later writes are unscoped by id, so ownership is proven here.
    const [ownedVoice] = await db
      .select({ id: familyVoices.id })
      .from(familyVoices)
      .where(and(eq(familyVoices.id, id), voiceOwnedBy(user.id)))
      .limit(1);
    if (!ownedVoice) {
      return NextResponse.json({ error: "Voice not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Missing WebM recording file" }, { status: 400 });
    }

    // 1. Write the WebM file locally
    const tempDir = UPLOADS_DIR;
    await fs.mkdir(tempDir, { recursive: true });

    const webmPath = path.join(tempDir, `omni_raw_${id}.webm`);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(webmPath, fileBuffer);

    // Output paths
    const audioFilename = `voice_sample_${id}.wav`;
    const wavPath = path.join(tempDir, audioFilename);
    
    const imageFilename = `avatar_frame_${id}.jpg`;
    const jpgPath = path.join(tempDir, imageFilename);

    // 2. Extract Audio via FFmpeg (PCM 16-bit, 44.1kHz, mono)
    const ffmpeg = await getFfmpeg();
    await new Promise<void>((resolve, reject) => {
      (ffmpeg as any)(webmPath)
        .noVideo()
        .audioCodec("pcm_s16le")
        .audioFrequency(44100)
        .audioChannels(1)
        .save(wavPath)
        .on("end", () => resolve())
        .on("error", (err: any) => reject(new Error("FFmpeg audio extract failed: " + err.message)));
    });

    // 3. Extract the cover frame (used as the immediate avatar) and a small
    // set of reference frames sampled across the recording. The reference
    // frames seed the LoRA training set so the personal Pixar clone has
    // varied angles/expressions to learn from.
    await new Promise<void>((resolve, reject) => {
      (ffmpeg as any)(webmPath)
        .screenshots({
          timestamps: [2],
          filename: imageFilename,
          folder: tempDir,
          size: "640x640",
        })
        .on("end", () => resolve())
        .on("error", (err: any) => reject(new Error("FFmpeg video frame extract failed: " + err.message)));
    });

    const referenceFramesDir = path.join(tempDir, "lora", id);
    await fs.mkdir(referenceFramesDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      (ffmpeg as any)(webmPath)
        .screenshots({
          timestamps: ["10%", "30%", "50%", "70%", "90%"],
          filename: "ref_%i.jpg",
          folder: referenceFramesDir,
          size: "768x768",
        })
        .on("end", () => resolve())
        .on("error", (err: any) =>
          reject(new Error("FFmpeg reference frame extract failed: " + err.message))
        );
    });

    // Clean up raw webm file
    try {
      await fs.unlink(webmPath);
    } catch (e) {
      console.warn("Could not delete temporary WebM file", e);
    }

    const publicAudioUrl = `/uploads/${audioFilename}`;
    const publicImageUrl = `/uploads/${imageFilename}`;

    // 4. Update local storage simulation paths
    // Return paths immediately so client can cache locally
    // Trigger voice cloning + Pixar Avatar generation in background
    const voiceName = formData.get("voiceName") as string || "Family Member";

    // Run cloning process in background (voice + avatar). Validates the
    // extracted audio first so a near-silent or absurdly long recording
    // is rejected before we create a provider voice.
    (async () => {
      let providerVoiceIdCreated: string | null = null;
      try {
        const { probeAudio, assertAudioWithinLimits } = await import(
          "@/lib/audio-validation"
        );
        const { deleteVoice } = await import("@/lib/voice-provider");
        const audioData = await fs.readFile(wavPath);

        const probe = await probeAudio(audioData);
        assertAudioWithinLimits(probe);

        providerVoiceIdCreated = await cloneVoice(audioData, voiceName);

        // Consent may have been revoked while cloning ran; do not persist then.
        if (!(await hasActiveConsent(user.id))) {
          await deleteVoice(providerVoiceIdCreated).catch(() => undefined);
          throw new Error("Consent revoked during voice cloning");
        }

        try {
          await db
            .update(familyVoices)
            .set({
              providerVoiceId: providerVoiceIdCreated,
              sampleAudioKey: publicAudioUrl,
              sampleSha256: probe.sha256,
              sampleDurationSeconds: String(probe.durationSeconds),
              sampleBytes: probe.bytes,
              status: "ready",
            })
            .where(eq(familyVoices.id, id));
        } catch (updateError) {
          // Saga cleanup: drop the provider voice we can't link.
          if (providerVoiceIdCreated) {
            try {
              await deleteVoice(providerVoiceIdCreated);
            } catch (_cleanupErr) {
              /* logged via console below */
            }
          }
          throw new Error(
            `DB update failed: ${updateError instanceof Error ? updateError.message : "Unknown error"}`
          );
        }
      } catch (err) {
        console.error("Background voice cloning failed:", err);
        await db
          .update(familyVoices)
          .set({ status: "failed" })
          .where(eq(familyVoices.id, id));
      }

      // Pixar avatar generation (non-blocking, updates DB when complete)
      try {
        if (replicate) {
          // Read face frame and convert to base64 data URI for Replicate
          const frameData = await fs.readFile(jpgPath);
          const dataUri = `data:image/jpeg;base64,${frameData.toString("base64")}`;

          const output = await replicate.run(
            "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf",
            {
              input: {
                image: dataUri,
                style: "3D",
                prompt: "a pixar disney character, 3d animated movie character, big glossy round eyes, smooth plastic-like skin, exaggerated cute proportions, vibrant colorful lighting, pixar movie screenshot, toy story style, inside out style, coco style, rendered in unreal engine, studio portrait",
                negative_prompt: "realistic photo photograph human skin pores wrinkles ugly deformed noisy blurry text watermark nsfw",
                lora_scale: 1.0,
                prompt_strength: 6.0,
                denoising_strength: 0.8,
                instant_id_strength: 0.7,
                control_depth_strength: 0.5,
              },
            }
          ) as any;

          // Extract output URL
          let outputUrl: string;
          if (Array.isArray(output)) outputUrl = String(output[0]);
          else if (typeof output === "string") outputUrl = output;
          else outputUrl = String(output);

          if (outputUrl && outputUrl !== "undefined" && outputUrl !== "[object Object]") {
            // Download and save the Pixar avatar
            const pixarRes = await fetch(outputUrl);
            if (pixarRes.ok) {
              const pixarBuffer = Buffer.from(await pixarRes.arrayBuffer());
              const pixarFilename = `pixar_avatar_${id}.png`;
              const pixarPath = path.join(tempDir, pixarFilename);
              await fs.writeFile(pixarPath, pixarBuffer);

              const pixarUrl = `/uploads/${pixarFilename}`;
              await db
                .update(familyVoices)
                .set({
                  avatarUrl: pixarUrl,
                  idleVideoUrl: pixarUrl,
                  talkingVideoUrl: pixarUrl,
                })
                .where(eq(familyVoices.id, id));

              // Update user profile avatar too
              await db
                .update(users)
                .set({ avatarUrl: pixarUrl })
                .where(selfUser(user.id));
            }
          }
        }
      } catch (err) {
        console.error("Pixar avatar generation failed (non-fatal):", err);
        // Keep the raw captured frame as fallback
      }
    })();

    // Build the public URL list for the LoRA reference frames extracted above.
    let referenceFrameUrls: string[] = [];
    try {
      const refEntries = await fs.readdir(referenceFramesDir);
      referenceFrameUrls = refEntries
        .filter((n) => n.startsWith("ref_") && n.endsWith(".jpg"))
        .sort()
        .map((n) => `/uploads/lora/${id}/${n}`);
    } catch (e) {
      console.warn("Could not enumerate LoRA reference frames", e);
    }

    // 5. Update database record with captured frame immediately (Pixar version comes later).
    // Owner-scoped like the RLS policy that used to guard this client write.
    let dbError: unknown = null;
    try {
      await db
        .update(familyVoices)
        .set({
          avatarUrl: publicImageUrl,
          sampleAudioKey: publicAudioUrl,
          idleVideoUrl: publicImageUrl,
          talkingVideoUrl: publicImageUrl,
          status: "ready",
          characterReferenceImages: referenceFrameUrls,
        })
        .where(and(eq(familyVoices.id, id), voiceOwnedBy(user.id)));
    } catch (e) {
      dbError = e;
    }

    if (dbError) {
      console.warn("Database failed to save visual clone paths.", dbError);
      return NextResponse.json({ error: "Could not save captured media" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      voiceId: id,
      avatarUrl: publicImageUrl,
      audioUrl: publicAudioUrl,
    });
  } catch (error: any) {
    console.error("Omni capture backend error:", error);
    return NextResponse.json({ error: error.message || "Failed to process Omni capture upload" }, { status: 500 });
  }
}
