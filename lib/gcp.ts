import { Storage } from "@google-cloud/storage";
import { withRetry } from "./retry";

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    // Replace literal '\n' characters in the env var string with actual newlines
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME!;

/**
 * Default upload size cap. Matches AUDIO_LIMITS.maxBytes (25 MB). Routes
 * can override per-call when a different limit is appropriate (e.g. video).
 */
export const DEFAULT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Generate a presigned PUT URL for uploading files to GCS.
 * Expires after 15 minutes. The signed URL is bound to a maximum size so
 * a buggy or malicious client can't upload a multi-GB file and exhaust
 * the bucket quota or downstream processing.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  options?: { maxBytes?: number }
): Promise<string> {
  if (!process.env.GCS_BUCKET_NAME) {
    console.warn("GCS_BUCKET_NAME is missing. Simulating presigned upload URL.");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cleanUrl = appUrl.replace(":3000", ":3001");
    return `${cleanUrl}/api/mock/upload?key=${encodeURIComponent(key)}`;
  }

  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file(key);

  const [url] = await withRetry(
    () =>
      file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
        // Bind the URL to a max upload size. Clients must send
        // x-goog-content-length-range: 0,<maxBytes> with the PUT for it
        // to be accepted by GCS.
        extensionHeaders: {
          "x-goog-content-length-range": `0,${
            options?.maxBytes ?? DEFAULT_UPLOAD_MAX_BYTES
          }`,
        },
      }),
    { attempts: 3, baseDelayMs: 500 }
  );

  return url;
}

/**
 * Generate a presigned GET URL for private GCS objects.
 * Expires after 1 hour.
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  if (!process.env.GCS_BUCKET_NAME) {
    console.warn("GCS_BUCKET_NAME is missing. Simulating presigned download URL.");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cleanUrl = appUrl.replace(":3000", ":3001");
    return `${cleanUrl}/api/mock/download?key=${encodeURIComponent(key)}`;
  }

  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file(key);

  const [url] = await withRetry(
    () =>
      file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      }),
    { attempts: 3, baseDelayMs: 500 }
  );

  return url;
}

/**
 * Fetch object metadata (size, contentType, md5Hash). Used to enforce
 * size limits on the server after a presigned upload completes — defense
 * in depth even with the upload-time size cap.
 */
export async function getObjectMetadata(
  key: string
): Promise<{ size: number; contentType: string | null; md5Hash: string | null } | null> {
  if (!process.env.GCS_BUCKET_NAME) return null;
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file(key);
  try {
    const [metadata] = await withRetry(() => file.getMetadata(), {
      attempts: 3,
      baseDelayMs: 500,
    });
    return {
      size: Number(metadata.size ?? 0),
      contentType: metadata.contentType ?? null,
      md5Hash: metadata.md5Hash ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Get the public URL for a GCS object (assuming the bucket has public read access).
 */
export function getPublicUrl(key: string): string {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;
}

/**
 * Build GCS key paths following the bucket structure convention.
 */
export const GCP_PATHS = {
  voiceSample: (userId: string, voiceId: string) =>
    `voice-samples/${userId}/${voiceId}/original.mp3`,
  voiceSampleNormalized: (userId: string, voiceId: string) =>
    `voice-samples/${userId}/${voiceId}/normalized.mp3`,
  clipVideo: (userId: string, contentId: string, voiceId: string) =>
    `clips/${userId}/${contentId}/${voiceId}/output.mp4`,
  clipAudio: (userId: string, contentId: string, voiceId: string) =>
    `clips/${userId}/${contentId}/${voiceId}/audio.mp3`,
} as const;
