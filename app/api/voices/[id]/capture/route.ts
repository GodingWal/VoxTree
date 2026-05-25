import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { replicate } from "@/lib/replicate";
import { promises as fs } from "fs";
import path from "path";

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

    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // 1. Decode base64 image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // 2. Save the file locally
    const filename = `visual_clone_${params.id}_${Date.now()}.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    // 3. Update family_voices with captured frame immediately
    const { error: dbError } = await supabase
      .from("family_voices")
      .update({
        avatar_url: publicUrl,
        idle_video_url: publicUrl,
        talking_video_url: publicUrl,
      })
      .eq("id", params.id);

    // 4. Update current user's profile avatar_url
    const { error: userDbError } = await supabase
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    // 5. Trigger Pixar avatar generation in background (non-blocking, inline)
    (async () => {
      try {
        if (!replicate) return;

        // Pass the raw image directly as base64 data URI to Replicate
        const dataUri = `data:image/png;base64,${base64Data}`;
        const admin = createAdminClient();

        const output = await replicate.run(
          "fofr/face-to-many:a07f252abbbd832009640b27f7a90d0a6b9e4f68f129b3571f3fa75a6b04f5c1",
          {
            input: {
              image: dataUri,
              style: "3d",
              prompt: "A Pixar 3D animated character, Disney Pixar movie style, smooth rounded features, big expressive eyes, warm soft studio lighting, high quality 3D render, friendly welcoming expression, subtle smile, clean solid dark background, cinematic character portrait, same person same face same features",
              negative_prompt: "realistic, photograph, ugly, deformed, noisy, blurry, low quality, text, watermark, nsfw, scary, horror, different person, wrong face",
              lora_scale: 0.9,
              prompt_strength: 4.5,
              denoising_strength: 0.65,
              instant_id_strength: 0.8,
              control_depth_strength: 0.8,
            },
          }
        ) as any;

        let outputUrl: string;
        if (Array.isArray(output)) outputUrl = String(output[0]);
        else if (typeof output === "string") outputUrl = output;
        else outputUrl = String(output);

        if (outputUrl && outputUrl !== "undefined" && outputUrl !== "[object Object]") {
          const pixarRes = await fetch(outputUrl);
          if (pixarRes.ok) {
            const pixarBuffer = Buffer.from(await pixarRes.arrayBuffer());
            const pixarFilename = `pixar_avatar_${params.id}.png`;
            await fs.writeFile(path.join(uploadDir, pixarFilename), pixarBuffer);

            const pixarUrl = `/uploads/${pixarFilename}`;
            await admin
              .from("family_voices")
              .update({ avatar_url: pixarUrl, idle_video_url: pixarUrl, talking_video_url: pixarUrl })
              .eq("id", params.id);
            await admin
              .from("users")
              .update({ avatar_url: pixarUrl })
              .eq("id", user.id);
          }
        }
      } catch (err) {
        console.error("Pixar avatar generation failed (non-fatal):", err);
      }
    })();

    if (dbError || userDbError) {
      console.warn("Database failed to update visual clone columns.", { dbError, userDbError });
      return NextResponse.json({
        success: true,
        simulated: true,
        avatarUrl: publicUrl,
        idleVideoUrl: publicUrl,
        talkingVideoUrl: publicUrl,
        message: "Visual clone captured (Simulation mode: Database columns not created)."
      });
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      idleVideoUrl: publicUrl,
      talkingVideoUrl: publicUrl,
    });
  } catch (error: any) {
    console.error("Visual capture error:", error);
    return NextResponse.json({ error: error.message || "Failed to process visual capture" }, { status: 500 });
  }
}
