import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { runPixarLoraInference } from "@/lib/replicate";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const schema = z.object({
  voiceId: z.string().uuid(),
  prompt: z.string().max(500).optional(),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]).optional(),
});

/**
 * Generate a Pixar-style portrait of a family member using their trained
 * personal Flux LoRA stacked with a Pixar style LoRA. Identity preservation
 * is far stronger than the single-shot face-to-many path.
 *
 * Requires that POST /api/avatar/train has been run for this voiceId and
 * the training completed (lora_status = 'ready').
 */
export async function POST(request: NextRequest) {
  const rateLimited = enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const supabase = getRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = schema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { voiceId, prompt, aspectRatio } = parsed.data;

  const { data: row } = await supabase
    .from("family_voices")
    .select(
      "id, user_id, lora_status, lora_destination, lora_version, lora_trigger_word"
    )
    .eq("id", voiceId)
    .eq("user_id", user.id)
    .single();
  if (!row) return NextResponse.json({ error: "Voice not found" }, { status: 404 });

  if (
    row.lora_status !== "ready" ||
    !row.lora_destination ||
    !row.lora_version ||
    !row.lora_trigger_word
  ) {
    return NextResponse.json(
      {
        error: "Character LoRA is not ready yet. Train it via /api/avatar/train.",
        status: row.lora_status ?? "not_started",
      },
      { status: 409 }
    );
  }

  try {
    const outputUrl = await runPixarLoraInference({
      destination: row.lora_destination,
      version: row.lora_version,
      triggerWord: row.lora_trigger_word,
      prompt,
      aspectRatio,
    });

    // Persist locally so subsequent loads don't re-fetch from Replicate's CDN.
    let pixarUrl = outputUrl;
    if (outputUrl.startsWith("http")) {
      const response = await fetch(outputUrl);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });
        const filename = `pixar_lora_${voiceId}_${Date.now()}.png`;
        await fs.writeFile(path.join(uploadsDir, filename), buffer);
        pixarUrl = `/uploads/${filename}`;
      }
    }

    const admin = createAdminClient();
    await admin
      .from("family_voices")
      .update({
        avatar_url: pixarUrl,
        idle_video_url: pixarUrl,
        talking_video_url: pixarUrl,
      })
      .eq("id", voiceId);

    await admin.from("users").update({ avatar_url: pixarUrl }).eq("id", user.id);

    return NextResponse.json({ success: true, avatarUrl: pixarUrl });
  } catch (error: any) {
    logger.error("pixar_lora_inference_failed", {
      voiceId,
      userId: user.id,
      message: error?.message ?? "Unknown error",
    });
    return NextResponse.json(
      { error: "Pixar generation failed", details: error?.message },
      { status: 502 }
    );
  }
}
