import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN;

/**
 * Generate a presigned PUT URL for uploading files to S3.
 * Expires after 15 minutes.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 900 });
}

/**
 * Generate a presigned GET URL for private S3 objects.
 * Expires after 1 hour.
 */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Get the public CloudFront URL for a cached clip.
 */
export function getCloudFrontUrl(key: string): string {
  if (!CLOUDFRONT_DOMAIN) {
    throw new Error("AWS_CLOUDFRONT_DOMAIN is not configured");
  }
  return `https://${CLOUDFRONT_DOMAIN}/${key}`;
}

/**
 * Build S3 key paths following the bucket structure convention.
 */
export const S3_PATHS = {
  voiceSample: (userId: string, voiceId: string) =>
    `voice-samples/${userId}/${voiceId}/original.mp3`,
  clipVideo: (userId: string, contentId: string, voiceId: string) =>
    `clips/${userId}/${contentId}/${voiceId}/output.mp4`,
  clipAudio: (userId: string, contentId: string, voiceId: string) =>
    `clips/${userId}/${contentId}/${voiceId}/audio.mp3`,
} as const;
