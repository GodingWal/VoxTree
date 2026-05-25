import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { replicate } from "@/lib/replicate";
import { promises as fs } from "fs";
import path from "path";

/**
 * Generate a Pixar/3D animated-style avatar from a captured face photo.
 *
 * Uses Replicate's "fofr/face-to-many" model which converts real face photos
 * into stylized 3D/Pixar portraits while preserving facial identity and likeness.
 *
 * The source image is read from the local filesystem and passed as a base64
 * data URI directly to Replicate — no GCS/cloud storage required.
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
      console.warn("No REPLICATE_API_TOKEN. Using captured frame as avatar (no Pixar transform).");
      pixarUrl = imageUrl;
    } else {
      // Step 1: Read the local image file and convert to base64 data URI
      // Replicate accepts data URIs as image input directly.
      let imageInput: string;

      if (imageUrl.startsWith("http")) {
        // Already a public URL, use directly
        imageInput = imageUrl;
      } else {
        // Local file — read it and encode as data URI
        const localPath = path.join(process.cwd(), "public", imageUrl);
        const fileData = await fs.readFile(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        imageInput = `data:${mimeType};base64,${fileData.toString("base64")}`;
      }

      // Step 2: Run "fofr/face-to-many" with style="3d" for Pixar/Disney look.
      // This model preserves the person's actual face (eyes, nose, jaw, skin tone,
      // hair style/color) while transforming them into a 3D animated character.
      const output = await replicate.run(
        "fofr/face-to-many:a07f252abbbd832009640b27f7a90d0a6b9e4f68f129b3571f3fa75a6b04f5c1",
        {
          input: {
            image: imageInput,
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

      // Step 3: Extract the output URL from Replicate response
      let outputUrl: string;
      if (Array.isArray(output)) {
        outputUrl = typeof output[0] === "string" ? output[0] : String(output[0]);
      } else if (typeof output === "string") {
        outputUrl = output;
      } else if (output && typeof output.url === "function") {
        outputUrl = output.url();
      } else if (output && output.toString && output.toString() !== "[object Object]") {
        outputUrl = output.toString();
      } else {
        throw new Error("Replicate returned no valid output");
      }

      if (!outputUrl || outputUrl === "undefined" || outputUrl === "[object Object]") {
        throw new Error("Replicate returned invalid output: " + JSON.stringify(output));
      }

      // Step 4: Download the generated Pixar avatar and save locally
      const response = await fetch(outputUrl);
      if (!response.ok) throw new Error(`Failed to download avatar: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `pixar_avatar_${voiceId}.png`;
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      pixarUrl = `/uploads/${filename}`;
    }

    // Step 5: Update the database with the Pixar avatar
    const admin = createAdminClient();
    await admin
      .from("family_voices")
      .update({
        avatar_url: pixarUrl,
        idle_video_url: pixarUrl,
        talking_video_url: pixarUrl,
      })
      .eq("id", voiceId);

    // Update user's profile avatar
    await admin
      .from("users")
      .update({ avatar_url: pixarUrl })
      .eq("id", user.id);

    return NextResponse.json({ success: true, avatarUrl: pixarUrl });
  } catch (error: any) {
    console.error("Pixar avatar generation error:", error);

    // Fallback: keep the raw captured frame as avatar
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
      error: error.message,
      message: "Used raw capture as avatar (Pixar generation failed)",
    });
  }
}
