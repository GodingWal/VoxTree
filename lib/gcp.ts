import { Storage } from "@google-cloud/storage";

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
 * Generate a presigned PUT URL for uploading files to GCS.
 * Expires after 15 minutes.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  if (!process.env.GCS_BUCKET_NAME) {
    console.warn("GCS_BUCKET_NAME is missing. Simulating presigned upload URL.");
    // Return an absolute URL so server-side fetch() calls can resolve it
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cleanUrl = appUrl.replace(":3000", ":3001");
    return `${cleanUrl}/api/mock/upload?key=${encodeURIComponent(key)}`;
  }

  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file(key);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  });

  return url;
}

/**
 * Generate a presigned GET URL for private GCS objects.
 * Expires after 1 hour.
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  if (!process.env.GCS_BUCKET_NAME) {
    console.warn("GCS_BUCKET_NAME is missing. Simulating presigned download URL.");
    // Return an absolute local mock download URL (fetching via Node needs absolute URL)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cleanUrl = appUrl.replace(":3000", ":3001");
    return `${cleanUrl}/api/mock/download?key=${encodeURIComponent(key)}`;
  }

  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file(key);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return url;
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
  clipVideo: (userId: string, contentId: string, voiceId: string) =>
    `clips/${userId}/${contentId}/${voiceId}/output.mp4`,
  clipAudio: (userId: string, contentId: string, voiceId: string) =>
    `clips/${userId}/${contentId}/${voiceId}/audio.mp3`,
} as const;
