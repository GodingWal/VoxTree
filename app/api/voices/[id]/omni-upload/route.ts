import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloneVoice } from "@/lib/elevenlabs";
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

    // 3. Extract single frame via FFmpeg at 2-second mark
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

    // Run cloning process in background (voice + avatar)
    (async () => {
      try {
        // Voice cloning via ElevenLabs
        const audioData = await fs.readFile(wavPath);
        const elevenlabsVoiceId = await cloneVoice(audioData, voiceName);

        await admin
          .from("family_voices")
          .update({
            elevenlabs_voice_id: elevenlabsVoiceId,
            sample_audio_url: publicAudioUrl,
            status: "ready",
          })
          .eq("id", params.id);
      } catch (err) {
        console.error("Background voice cloning failed:", err);
        await admin
          .from("family_voices")
          .update({ status: "failed" })
          .eq("id", params.id);
      }

      // Pixar avatar generation (non-blocking, updates DB when complete)
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        await fetch(`${siteUrl}/api/avatar/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId: params.id, imageUrl: publicImageUrl }),
        });
      } catch (err) {
        console.error("Pixar avatar generation failed (non-fatal):", err);
        // Keep the raw captured frame as fallback
      }
    })();

    // 5. Update database record with captured frame immediately (Pixar version comes later)
    const { error: dbError } = await supabase
      .from("family_voices")
      .update({
        avatar_url: publicImageUrl,
        sample_audio_url: publicAudioUrl,
        idle_video_url: publicImageUrl,
        talking_video_url: publicImageUrl,
        status: "ready",
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
