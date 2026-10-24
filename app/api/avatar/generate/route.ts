import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { enforcePaidRateLimit, safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { selfUser, voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices, users } from "@/lib/db/schema";
import { requireActiveConsent } from "@/lib/consent";
import { logger } from "@/lib/logger";
import { replicate } from "@/lib/replicate";
import { localMediaPath, UPLOADS_DIR } from "@/lib/uploads";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const generateSchema = z.object({
  voiceId: z.string().uuid(),
  imageUrl: z.string().min(1),
});

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
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: userId };

  const consentBlocked = await requireActiveConsent(user.id);
  if (consentBlocked) return consentBlocked;

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = generateSchema.safeParse(parsedJson.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { voiceId, imageUrl } = parsed.data;

  // Ownership: the writes below are unscoped by id, so verify it here.
  const [ownedVoice] = await db
    .select({ id: familyVoices.id })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);
  if (!ownedVoice) return NextResponse.json({ error: "Voice not found" }, { status: 404 });

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
        const localPath = localMediaPath(imageUrl);
        const fileData = await fs.readFile(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        imageInput = `data:${mimeType};base64,${fileData.toString("base64")}`;
      }

      // Step 2: Run "fofr/face-to-many" with style="3d" for Pixar/Disney look.
      // This model preserves the person's actual face (eyes, nose, jaw, skin tone,
      // hair style/color) while transforming them into a 3D animated character.
      const output = await replicate.run(
        "fofr/face-to-many:a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf",
        {
          input: {
            image: imageInput,
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

      const uploadsDir = UPLOADS_DIR;
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `pixar_avatar_${voiceId}.png`;
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      pixarUrl = `/uploads/${filename}`;
    }

    // Step 5: Update the database with the Pixar avatar
    await db
      .update(familyVoices)
      .set({
        avatarUrl: pixarUrl,
        idleVideoUrl: pixarUrl,
        talkingVideoUrl: pixarUrl,
      })
      .where(eq(familyVoices.id, voiceId));

    // Update user's profile avatar
    await db
      .update(users)
      .set({ avatarUrl: pixarUrl })
      .where(selfUser(user.id));

    return NextResponse.json({ success: true, avatarUrl: pixarUrl });
  } catch (error: any) {
    logger.error("avatar_generation_failed", {
      voiceId,
      userId: user.id,
      message: error?.message ?? "Unknown error",
    });

    // Fallback: keep the raw captured frame as avatar
    await db
      .update(familyVoices)
      .set({
        avatarUrl: imageUrl,
        idleVideoUrl: imageUrl,
        talkingVideoUrl: imageUrl,
      })
      .where(eq(familyVoices.id, voiceId));

    return NextResponse.json({
      success: true,
      avatarUrl: imageUrl,
      fallback: true,
      error: error.message,
      message: "Used raw capture as avatar (Pixar generation failed)",
    });
  }
}
