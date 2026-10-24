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
import { UPLOADS_DIR } from "@/lib/uploads";
import { promises as fs } from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = { id: userId };

    const consentBlocked = await requireActiveConsent(user.id);
    if (consentBlocked) return consentBlocked;

    const parsedJson = await safeJson(request);
    if ("error" in parsedJson) return parsedJson.error;
    const body = parsedJson.body as { image?: unknown };
    if (typeof body.image !== "string" || !body.image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }
    const image = body.image;

    // 1. Decode base64 image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // 2. Save the file locally
    const filename = `visual_clone_${id}_${Date.now()}.png`;
    const uploadDir = UPLOADS_DIR;
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    // 3. Update family_voices with captured frame immediately.
    // Owner-scoped: this write previously ran under the family_voices RLS
    // policies, which only let a user update their own voices.
    let dbError: unknown = null;
    try {
      await db
        .update(familyVoices)
        .set({
          avatarUrl: publicUrl,
          idleVideoUrl: publicUrl,
          talkingVideoUrl: publicUrl,
        })
        .where(and(eq(familyVoices.id, id), voiceOwnedBy(user.id)));
    } catch (e) {
      dbError = e;
    }

    // 4. Update current user's profile avatar_url
    let userDbError: unknown = null;
    try {
      await db
        .update(users)
        .set({ avatarUrl: publicUrl })
        .where(selfUser(user.id));
    } catch (e) {
      userDbError = e;
    }

    // 5. Trigger Pixar avatar generation in background (non-blocking, inline)
    (async () => {
      try {
        if (!replicate) return;

        // Pass the raw image directly as base64 data URI to Replicate
        const dataUri = `data:image/png;base64,${base64Data}`;

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

        let outputUrl: string;
        if (Array.isArray(output)) outputUrl = String(output[0]);
        else if (typeof output === "string") outputUrl = output;
        else outputUrl = String(output);

        if (outputUrl && outputUrl !== "undefined" && outputUrl !== "[object Object]") {
          const pixarRes = await fetch(outputUrl);
          if (pixarRes.ok) {
            const pixarBuffer = Buffer.from(await pixarRes.arrayBuffer());
            const pixarFilename = `pixar_avatar_${id}.png`;
            await fs.writeFile(path.join(uploadDir, pixarFilename), pixarBuffer);

            const pixarUrl = `/uploads/${pixarFilename}`;
            await db
              .update(familyVoices)
              .set({ avatarUrl: pixarUrl, idleVideoUrl: pixarUrl, talkingVideoUrl: pixarUrl })
              .where(eq(familyVoices.id, id));
            await db
              .update(users)
              .set({ avatarUrl: pixarUrl })
              .where(selfUser(user.id));
          }
        }
      } catch (err) {
        logger.warn("pixar_avatar_generation_failed", {
          voiceId: id,
          userId: user.id,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    })();

    if (dbError || userDbError) {
      console.warn("Database failed to update visual clone columns.", { dbError, userDbError });
      return NextResponse.json({ error: "Could not save visual clone" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      idleVideoUrl: publicUrl,
      talkingVideoUrl: publicUrl,
    });
  } catch (error: any) {
    logger.error("visual_capture_failed", {
      voiceId: id,
      message: error?.message ?? "Unknown error",
    });
    return NextResponse.json({ error: error.message || "Failed to process visual capture" }, { status: 500 });
  }
}
