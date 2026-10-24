import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { enforcePaidRateLimit } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { requireActiveConsent } from "@/lib/consent";
import { logger } from "@/lib/logger";
import { trainCharacterLora } from "@/lib/replicate";
import { signedUploadUrl } from "@/lib/upload-token";
import { UPLOADS_DIR } from "@/lib/uploads";
import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import path from "path";
import archiver from "archiver";

/**
 * Kick off a personalized Flux LoRA training for the truest-possible Pixar
 * character clone of a family member.
 *
 * Accepts multipart/form-data with:
 *   - voiceId: family_voices.id (UUID)
 *   - images: 5–20 reference photos of the same person (varied angles,
 *     expressions, lighting). More variety = better identity capture.
 *
 * The trainer needs a fetchable ZIP of the images. It is served from the
 * local uploads store (data/uploads) via NEXT_PUBLIC_APP_URL so Replicate
 * can pull it; because the trainer cannot present a session, the URL
 * carries a short-lived HMAC-signed token bound to exactly that file
 * (see lib/upload-token.ts and app/uploads/[...path]/route.ts).
 */
export const maxDuration = 60;

const MIN_IMAGES = 4;
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per image

export async function POST(request: NextRequest) {
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = { id: userId };

  const consentBlocked = await requireActiveConsent(user.id);
  if (consentBlocked) return consentBlocked;

  const formData = await request.formData();
  const voiceId = formData.get("voiceId");
  if (typeof voiceId !== "string" || !/^[0-9a-f-]{36}$/i.test(voiceId)) {
    return NextResponse.json({ error: "voiceId is required (uuid)" }, { status: 400 });
  }

  const files = formData.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Upload ${MIN_IMAGES}–${MAX_IMAGES} reference photos.` },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Image ${f.name} exceeds ${MAX_IMAGE_BYTES / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }
  }

  // Confirm the voice row belongs to the caller.
  const [voiceRow] = await db
    .select({
      id: familyVoices.id,
      userId: familyVoices.userId,
      loraStatus: familyVoices.loraStatus,
    })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(user.id)))
    .limit(1);
  if (!voiceRow) {
    return NextResponse.json({ error: "Voice not found" }, { status: 404 });
  }
  if (voiceRow.loraStatus === "training") {
    return NextResponse.json(
      { error: "A LoRA training is already in progress for this voice." },
      { status: 409 }
    );
  }

  const uploadsDir = path.join(UPLOADS_DIR, "lora", voiceId);
  await fs.mkdir(uploadsDir, { recursive: true });

  const referenceUrls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
    const filename = `ref_${i.toString().padStart(2, "0")}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    referenceUrls.push(`/uploads/lora/${voiceId}/${filename}`);
  }

  // Bundle the references into a single .zip the trainer can fetch.
  const zipPath = path.join(uploadsDir, "dataset.zip");
  await zipDirectory(uploadsDir, zipPath, (name) => name.startsWith("ref_"));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inputImagesUrl = signedUploadUrl(appUrl, `lora/${voiceId}/dataset.zip`);
  const webhookUrl = `${appUrl}/api/avatar/train/webhook?voiceId=${voiceId}`;

  // Unique trigger word per voice so prompts can address this specific clone.
  const triggerWord = `TOK${voiceId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  try {
    const training = await trainCharacterLora({
      inputImagesUrl,
      triggerWord,
      webhookUrl,
    });

    await db
      .update(familyVoices)
      .set({
        loraTrainingId: training.id,
        loraDestination: training.destination,
        loraTriggerWord: triggerWord,
        loraStatus: "training",
        characterReferenceImages: referenceUrls,
      })
      .where(eq(familyVoices.id, voiceId));

    return NextResponse.json({
      success: true,
      trainingId: training.id,
      triggerWord,
      status: "training",
      referenceCount: referenceUrls.length,
    });
  } catch (error: any) {
    logger.error("lora_training_failed_to_start", {
      voiceId,
      userId: user.id,
      message: error?.message ?? "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to start LoRA training", details: error?.message },
      { status: 502 }
    );
  }
}

function zipDirectory(
  sourceDir: string,
  outPath: string,
  fileFilter: (name: string) => boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    fs.readdir(sourceDir).then((entries) => {
      for (const name of entries) {
        if (!fileFilter(name)) continue;
        archive.file(path.join(sourceDir, name), { name });
      }
      archive.finalize();
    }, reject);
  });
}
