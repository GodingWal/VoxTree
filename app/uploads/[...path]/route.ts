import { and, eq, or, sql } from "drizzle-orm";
import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

import { getCurrentUserId } from "@/lib/auth/session";
import { clipOwnedBy, voiceOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { familyVoices, generatedClips, users } from "@/lib/db/schema";
import { verifyUploadToken } from "@/lib/upload-token";
import { uploadsFilePath } from "@/lib/uploads";

/**
 * Authenticated serving for local uploads (Phase 5).
 *
 * Uploads live in `data/uploads` (see lib/uploads.ts), NOT in `public/`, so
 * this route is the only way to read them. Access mirrors the ownership
 * model the creating routes enforce:
 *
 * - a session is required;
 * - files whose name embeds a voice id (`voice_sample_<id>.wav`,
 *   `pixar_avatar_<id>.png`, `lora/<id>/…`, …) require owning that voice;
 * - `talking_<clipId>.mp4` requires owning that clip;
 * - anything else is served only when a row owned by the caller references
 *   the exact `/uploads/…` URL (profile avatars, clip/voice media fields).
 *
 * Unknown or foreign files return 404 so existence is never leaked.
 *
 * Single exception: `lora/<voiceId>/dataset.zip` is fetched server-side by
 * the external LoRA trainer (Replicate), which cannot present a session.
 * That fetch must carry a short-lived HMAC-signed token (`?t=`, minted by
 * the train route — see lib/upload-token.ts) bound to exactly that path;
 * the voice must also exist. An unsigned or expired request gets 401, and
 * the reference frames under the same directory are NOT covered.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const VOICE_FILE_RE = new RegExp(
  `^(?:visual_clone|pixar_avatar|pixar_lora|voice_sample|avatar_frame|omni_raw)_(${UUID})`,
  "i",
);
const CLIP_FILE_RE = new RegExp(`^talking_(${UUID})`, "i");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".zip": "application/zip",
};

async function ownsVoice(userId: string, voiceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: familyVoices.id })
    .from(familyVoices)
    .where(and(eq(familyVoices.id, voiceId), voiceOwnedBy(userId)))
    .limit(1);
  return Boolean(row);
}

async function ownsClip(userId: string, clipId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: generatedClips.id })
    .from(generatedClips)
    .where(and(eq(generatedClips.id, clipId), clipOwnedBy(userId)))
    .limit(1);
  return Boolean(row);
}

/** Fallback: a row owned by the caller references this exact upload URL. */
async function isReferencedByOwner(userId: string, url: string): Promise<boolean> {
  const [profile] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.avatarUrl, url)))
    .limit(1);
  if (profile) return true;

  const [voice] = await db
    .select({ id: familyVoices.id })
    .from(familyVoices)
    .where(
      and(
        voiceOwnedBy(userId),
        or(
          eq(familyVoices.avatarUrl, url),
          eq(familyVoices.idleVideoUrl, url),
          eq(familyVoices.talkingVideoUrl, url),
          eq(familyVoices.sampleAudioKey, url),
          sql`${familyVoices.characterReferenceImages} @> ${JSON.stringify([url])}::jsonb`,
        ),
      ),
    )
    .limit(1);
  if (voice) return true;

  const [clip] = await db
    .select({ id: generatedClips.id })
    .from(generatedClips)
    .where(and(clipOwnedBy(userId), eq(generatedClips.talkingVideoUrl, url)))
    .limit(1);
  return Boolean(clip);
}

async function voiceExists(voiceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: familyVoices.id })
    .from(familyVoices)
    .where(eq(familyVoices.id, voiceId))
    .limit(1);
  return Boolean(row);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments?.length || segments.some((s) => s === ".." || s === ".")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const relativePath = segments.join("/");
  const url = `/uploads/${relativePath}`;
  const filename = segments[segments.length - 1];

  const isTrainerZip =
    segments.length === 3 && segments[0] === "lora" && filename === "dataset.zip";

  const userId = await getCurrentUserId();

  if (!userId) {
    // The signed trainer fetch is the only unauthenticated read: the
    // token must be valid for exactly this dataset.zip path (see
    // lib/upload-token.ts), and the voice must exist.
    const trainerAllowed =
      isTrainerZip &&
      verifyUploadToken(relativePath, request.nextUrl.searchParams.get("t")) &&
      (await voiceExists(segments[1]));
    if (!trainerAllowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    let allowed = false;

    if (segments[0] === "lora" && segments[1]) {
      allowed = await ownsVoice(userId, segments[1]);
    }
    if (!allowed) {
      const voiceMatch = filename.match(VOICE_FILE_RE);
      if (voiceMatch) allowed = await ownsVoice(userId, voiceMatch[1]);
    }
    if (!allowed) {
      const clipMatch = filename.match(CLIP_FILE_RE);
      if (clipMatch) allowed = await ownsClip(userId, clipMatch[1]);
    }
    if (!allowed) {
      allowed = await isReferencedByOwner(userId, url);
    }
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  let filePath: string;
  try {
    filePath = uploadsFilePath(relativePath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType =
    CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };

  const range = request.headers.get("range");
  const rangeMatch = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (rangeMatch) {
    const start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
    const end = rangeMatch[2] ? Number(rangeMatch[2]) : stat.size - 1;
    if (start > end || end >= stat.size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
    const buffer = await fs.readFile(filePath);
    const slice = buffer.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(slice), {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(slice.length),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      },
    });
  }

  const buffer = await fs.readFile(filePath);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
