import { NextRequest, NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { replicate } from "@/lib/replicate";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "@/lib/gcp";
import { promises as fs } from "fs";
import path from "path";

/**
 * Generate a Pixar/3D animated-style avatar from a captured face photo.
 *
 * Uses Replicate's "fofr/face-to-many" model which converts real face photos
 * into stylized 3D/Pixar portraits while preserving facial identity and likeness.
 *
 * Flow:
 * 1. Read the captured face frame from local /uploads/
 * 2. Upload it to GCS so Replicate can access it via public URL
 * 3. Run the face-to-many model with style="3d" (Pixar look)
 * 4. Download the generated avatar, save locally + update DB
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
      // Step 1: Get the source image as a publicly accessible URL
      let sourceImageUrl: string;

      if (imageUrl.startsWith("http")) {
        sourceImageUrl = imageUrl;
      } else {
        // Read the local file and upload to GCS for public access
        const localPath = path.join(process.cwd(), "public", imageUrl);
        const fileExists = await fs.stat(localPath).catch(() => null);

        if (fileExists) {
          const gcsKey = `avatars/${user.id}/${voiceId}/source.jpg`;

          try {
            // Upload to GCS
            const uploadUrl = await getPresignedUploadUrl(gcsKey, "image/jpeg");
            const fileData = await fs.readFile(localPath);
            await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/jpeg" },
              body: fileData,
            });
            // Get a readable URL
            sourceImageUrl = await getPresignedDownloadUrl(gcsKey);
          } catch (gcsErr) {
            // If GCS isn't configured, try using the site URL directly
            console.warn("GCS upload failed, trying direct site URL:", gcsErr);
            sourceImageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${imageUrl}`;
          }
        } else {
          sourceImageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${imageUrl}`;
        }
      }

      // Step 2: Run "fofr/face-to-many" with style="3d" for Pixar look
      // This model specifically preserves the person's face identity (eyes, nose, jaw,
      // skin tone, hair) while transforming them into a 3D animated character style.
      const output = await replicate.run(
        "fofr/face-to-many:a07f252abbbd832009640b27f7a90d0a6b9e4f68f129b3571f3fa75a6b04f5c1",
        {
          input: {
            image: sourceImageUrl,
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

      // Output can be a FileOutput, string URL, or array
      let outputUrl: string;
      if (Array.isArray(output)) {
        outputUrl = typeof output[0] === "string" ? output[0] : String(output[0]);
      } else if (typeof output === "string") {
        outputUrl = output;
      } else if (output && typeof output.url === "function") {
        outputUrl = output.url();
      } else {
        outputUrl = String(output);
      }

      if (!outputUrl || outputUrl === "undefined") {
        throw new Error("Replicate returned no valid output URL");
      }

      // Step 3: Download the generated Pixar avatar
      const response = await fetch(outputUrl);
      if (!response.ok) throw new Error(`Failed to download avatar: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Step 4: Save locally
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `pixar_avatar_${voiceId}.png`;
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      pixarUrl = `/uploads/${filename}`;
    }

    // Step 5: Update the voice record with the generated Pixar avatar
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
