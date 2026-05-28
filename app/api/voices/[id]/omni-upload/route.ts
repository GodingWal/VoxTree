import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloneVoice } from "@/lib/elevenlabs";
import { replicate } from "@/lib/replicate";
import { promises as fs } from "fs";
import path from "path";

// Initialize fluent-ffmpeg pointing to @ffmpeg-installer/ffmpeg
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Missing WebM recording file" }, { status: 400 });
    }

    // 1. Write the WebM file locally
    const tempDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(tempDir, { recursive: true });

    const webmPath = path.join(tempDir, `omni_raw_${params.id}.webm`);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(webmPath, fileBuffer);

    // Output paths
    const audioFilename = `voice_sample_${params.id}.wav`;
    const wavPath = path.join(tempDir, audioFilename);
    
    const imageFilename = `avatar_frame_${params.id}.jpg`;
    const jpgPath = path.join(tempDir, imageFilename);

    // 2. Extract Audio via FFmpeg (PCM 16-bit, 44.1kHz, mono)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(webmPath)
        .noVideo()
        .audioCodec("pcm_s16le")
        .audioFrequency(44100)
        .audioChannels(1)
        .save(wavPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error("FFmpeg audio extract failed: " + err.message)));
    });

    // 3. Extract the cover frame (used as the immediate avatar) and a small
    // set of reference frames sampled across the recording. The reference
    // frames seed the LoRA training set so the personal Pixar clone has
    // varied angles/expressions to learn from.
    await new Promise<void>((resolve, reject) => {
      ffmpeg(webmPath)
        .screenshots({
          timestamps: [2],
          filename: imageFilename,
          folder: tempDir,
          size: "640x640",
        })
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error("FFmpeg video frame extract failed: " + err.message)));
    });

    const referenceFramesDir = path.join(tempDir, "lora", params.id);
    await fs.mkdir(referenceFramesDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      ffmpeg(webmPath)
        .screenshots({
          timestamps: ["10%", "30%", "50%", "70%", "90%"],
          filename: "ref_%i.jpg",
          folder: referenceFramesDir,
          size: "768x768",
        })
        .on("end", () => resolve())
        .on("error", (err) =>
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
    // Trigger ElevenLabs Voice Cloning + Pixar Avatar generation in background
    const admin = createAdminClient();
    const voiceName = formData.get("voiceName") as string || "Family Member";

    // Run cloning process in background (voice + avatar). Validates the
    // extracted audio first so a near-silent or absurdly long recording
    // is rejected before we burn an ElevenLabs voice slot.
    (async () => {
      let elevenlabsVoiceIdCreated: string | null = null;
      try {
        const { probeAudio, assertAudioWithinLimits } = await import(
          "@/lib/audio-validation"
        );
        const { deleteVoice } = await import("@/lib/elevenlabs");
        const audioData = await fs.readFile(wavPath);

        const probe = await probeAudio(audioData);
        assertAudioWithinLimits(probe);

        elevenlabsVoiceIdCreated = await cloneVoice(audioData, voiceName);

        const { error: updateError } = await admin
          .from("family_voices")
          .update({
            elevenlabs_voice_id: elevenlabsVoiceIdCreated,
            sample_audio_url: publicAudioUrl,
            sample_sha256: probe.sha256,
            sample_duration_seconds: probe.durationSeconds,
            sample_bytes: probe.bytes,
            status: "ready",
          })
          .eq("id", params.id);

        if (updateError) {
          // Saga cleanup: drop the paid ElevenLabs voice we can't link.
          if (elevenlabsVoiceIdCreated) {
            try {
              await deleteVoice(elevenlabsVoiceIdCreated);
            } catch (_cleanupErr) {
              /* logged via console below */
            }
          }
          throw new Error(`DB update failed: ${updateError.message}`);
        }
      } catch (err) {
        console.error("Background voice cloning failed:", err);
        await admin
          .from("family_voices")
          .update({ status: "failed" })
          .eq("id", params.id);
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
              const pixarFilename = `pixar_avatar_${params.id}.png`;
              const pixarPath = path.join(tempDir, pixarFilename);
              await fs.writeFile(pixarPath, pixarBuffer);

              const pixarUrl = `/uploads/${pixarFilename}`;
              await admin
                .from("family_voices")
                .update({
                  avatar_url: pixarUrl,
                  idle_video_url: pixarUrl,
                  talking_video_url: pixarUrl,
                })
                .eq("id", params.id);

              // Update user profile avatar too
              await admin
                .from("users")
                .update({ avatar_url: pixarUrl })
                .eq("id", user.id);
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
        .map((n) => `/uploads/lora/${params.id}/${n}`);
    } catch (e) {
      console.warn("Could not enumerate LoRA reference frames", e);
    }

    // 5. Update database record with captured frame immediately (Pixar version comes later)
    const { error: dbError } = await supabase
      .from("family_voices")
      .update({
        avatar_url: publicImageUrl,
        sample_audio_url: publicAudioUrl,
        idle_video_url: publicImageUrl,
        talking_video_url: publicImageUrl,
        status: "ready",
        character_reference_images: referenceFrameUrls,
      })
      .eq("id", params.id);

    if (dbError) {
      console.warn("Database failed to save visual clone paths. Continuing in simulation mode.", dbError);
      return NextResponse.json({
        success: true,
        simulated: true,
        voiceId: params.id,
        avatarUrl: publicImageUrl,
        audioUrl: publicAudioUrl,
        message: "Onboarding captured and split successfully (Simulation mode: Database columns not created)."
      });
    }

    return NextResponse.json({
      success: true,
      voiceId: params.id,
      avatarUrl: publicImageUrl,
      audioUrl: publicAudioUrl,
    });
  } catch (error: any) {
    console.error("Omni capture backend error:", error);
    return NextResponse.json({ error: error.message || "Failed to process Omni capture upload" }, { status: 500 });
  }
}
