import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLimit } from "@/lib/limits";
import { getCachedAudio } from "@/lib/cache";
import { generateSpeech } from "@/lib/elevenlabs";
import { getPresignedUploadUrl, getPresignedDownloadUrl, GCP_PATHS } from "@/lib/gcp";
import Replicate from "replicate";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { NextResponse } from "next/server";
import { z } from "zod";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "dummy_token",
});

const generateSchema = z.object({
  contentId: z.string().uuid(),
  voiceId: z.string().uuid(),
});

import { RateLimit } from "@/lib/rate-limit";

const rateLimiter = new RateLimit({ limit: 5, windowMs: 60000 });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    } else {
      body = {};
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { contentId, voiceId } = parsed.data;

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

  // Fetch the content details to determine mode
  const { data: content, error: contentError } = await supabase
    .from("content_library")
    .select("content_mode, text_script, isolated_vocals_url, instrumental_url, original_video_url")
    .eq("id", contentId)
    .single();

  if (contentError || !content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  if (content.content_mode === "tts" && !content.text_script) {
    return NextResponse.json({ error: "This story does not have a text script configured." }, { status: 400 });
  }

  if (!content.instrumental_url) {
    return NextResponse.json({ error: "This story is missing a background music track." }, { status: 400 });
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

  // Create a clip record in queued status
  const { data: clip, error: insertError } = await supabase
    .from("generated_clips")
    .insert({
      user_id: user.id,
      content_id: contentId,
      voice_id: voiceId,
      status: "queued",
    })
    .select()
    .single();

  if (insertError || !clip) {
    return NextResponse.json(
      { error: "Failed to create clip record" },
      { status: 500 }
    );
  }

  // Background processing function
  const processClip = async () => {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    const admin = createAdminClient();
    try {
      // Fetch voice details
      const { data: voice } = await admin
        .from("family_voices")
        .select("elevenlabs_voice_id, rvc_model_id")
        .eq("id", voiceId)
        .single();

      if (!voice) throw new Error("Voice not found");

      const tmpDir = os.tmpdir();
      const speechFile = path.join(tmpDir, `${clip.id}-speech.mp3`);
      const bgFile = path.join(tmpDir, `${clip.id}-bg.mp3`);
      const outputFile = path.join(tmpDir, `${clip.id}-output.mp4`); // or mp3

      let rawVocalsBuffer: Buffer;

      if (content.content_mode === "tts") {
        if (!voice.elevenlabs_voice_id) throw new Error("TTS voice not set up");
        console.log(`[Clip Generation] Generating speech via ElevenLabs for clip ${clip.id}`);
        rawVocalsBuffer = await generateSpeech(voice.elevenlabs_voice_id, content.text_script);
      } else if (content.content_mode === "v2v") {
        if (!voice.rvc_model_id) throw new Error("V2V singing voice not set up");
        console.log(`[Clip Generation] Triggering Replicate V2V workflow for clip ${clip.id}`);
        
        // Replicate RVC inference
        const modelStr = `${voice.rvc_model_id}` as `${string}/${string}`;
        const output = await replicate.run(
          modelStr, // In reality, this would be the model owner/name:version
          {
            input: {
              song_input: content.isolated_vocals_url,
              pitch_change: 0,
            }
          }
        ) as unknown as string;

        // Download the output from Replicate
        const repRes = await fetch(output);
        rawVocalsBuffer = Buffer.from(await repRes.arrayBuffer());
      } else {
        throw new Error("Unsupported content mode");
      }

      // Download instrumental
      console.log(`[Clip Generation] Downloading instrumental for clip ${clip.id}`);
      const bgRes = await fetch(content.instrumental_url);
      const bgBuffer = Buffer.from(await bgRes.arrayBuffer());
      fs.writeFileSync(bgFile, bgBuffer);

      if (rawVocalsBuffer.length === 0) {
        console.log(`[Clip Generation] Empty vocals buffer (simulation mode). Copying instrumental directly.`);
        fs.copyFileSync(bgFile, outputFile);
      } else {
        // Save raw vocals to disk
        fs.writeFileSync(speechFile, rawVocalsBuffer);

        // Mix with FFmpeg
        console.log(`[Clip Generation] Mixing audio via FFmpeg for clip ${clip.id}`);
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
            .on("error", (err) => reject(err))
            .run();
        });
      }

      // Upload to GCP
      console.log(`[Clip Generation] Uploading output to GCP for clip ${clip.id}`);
      const outputBuffer = fs.readFileSync(outputFile);
      const gcpKey = GCP_PATHS.clipAudio(user.id, contentId, voiceId);
      const uploadUrl = await getPresignedUploadUrl(gcpKey, "audio/mpeg");
      
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/mpeg" },
        body: outputBuffer,
      });

      // Update DB
      await admin
        .from("generated_clips")
        .update({
          status: "ready",
          output_audio_url: gcpKey,
          output_video_url: gcpKey,
          cached: true
        })
        .eq("id", clip.id);

      // Cleanup temp files
      if (fs.existsSync(speechFile)) fs.unlinkSync(speechFile);
      if (fs.existsSync(bgFile)) fs.unlinkSync(bgFile);
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      
      console.log(`[Clip Generation] Completed successfully for clip ${clip.id}`);

    } catch (err: any) {
      console.error(`[Clip Generation] Failed for clip ${clip.id}:`, err);
      await admin
        .from("generated_clips")
        .update({ status: "failed" })
        .eq("id", clip.id);
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
