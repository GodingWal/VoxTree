import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { replicate } from "@/lib/replicate";
import { promises as fs } from "fs";
import path from "path";

/**
 * Generate a Pixar-style avatar from a captured face frame.
 * Uses Replicate's image-to-image model with a Pixar/3D cartoon style prompt.
 */
export async function POST(request: NextRequest) {
  const supabase = getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { voiceId, imageUrl } = await request.json();
  if (!voiceId || !imageUrl) {
    return NextResponse.json({ error: "voiceId and imageUrl required" }, { status: 400 });
  }

  try {
    let pixarUrl: string;

    if (!replicate) {
      // Simulation mode: use the captured frame directly as the "avatar"
      // In production, this would be the Pixar-transformed version
      console.warn("No REPLICATE_API_TOKEN. Using captured frame as avatar (no Pixar transform).");
      pixarUrl = imageUrl;
    } else {
      // Use Replicate's img2img with a Pixar/3D cartoon style
      // Model: stability-ai/sdxl for img2img with strong style prompt
      const absoluteImageUrl = imageUrl.startsWith("http")
        ? imageUrl
        : `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${imageUrl}`;

      const output = await replicate.run(
        "tencentarc/photomaker:ddfc2b08d209f9fa8c1uj0jvleecbbec",
        {
          input: {
            input_image: absoluteImageUrl,
            prompt: "A Pixar 3D animated character portrait, Disney Pixar style, smooth skin, big expressive eyes, warm lighting, soft shadows, high quality 3D render, friendly expression, studio portrait, solid dark background",
            negative_prompt: "realistic, photo, ugly, deformed, noisy, blurry, low quality, text, watermark",
            style_strength_ratio: 35,
            num_steps: 30,
            guidance_scale: 7.5,
            num_outputs: 1,
          },
        }
      ) as string[];

      if (!output || output.length === 0) {
        throw new Error("Replicate returned no output");
      }

      // Download the generated image and save locally
      const response = await fetch(output[0]);
      const buffer = Buffer.from(await response.arrayBuffer());

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `pixar_avatar_${voiceId}.png`;
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      pixarUrl = `/uploads/${filename}`;
    }

    // Update the voice record with the generated Pixar avatar
    const admin = createAdminClient();
    await admin
      .from("family_voices")
      .update({
        avatar_url: pixarUrl,
        idle_video_url: pixarUrl,
        talking_video_url: pixarUrl,
      })
      .eq("id", voiceId);

    // Also update user's profile avatar if this is their first clone
    const { data: voiceCount } = await admin
      .from("family_voices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready");

    if (!voiceCount || (voiceCount as any).length <= 1) {
      await admin
        .from("users")
        .update({ avatar_url: pixarUrl })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true, avatarUrl: pixarUrl });
  } catch (error: any) {
    console.error("Avatar generation error:", error);
    // Fallback: use the raw captured frame
    const admin = createAdminClient();
    await admin
      .from("family_voices")
      .update({
        avatar_url: imageUrl,
        idle_video_url: imageUrl,
        talking_video_url: imageUrl,
      })
      .eq("id", voiceId);

    return NextResponse.json({
      success: true,
      avatarUrl: imageUrl,
      fallback: true,
      message: "Used raw capture as avatar (Pixar generation unavailable)",
    });
  }
}
