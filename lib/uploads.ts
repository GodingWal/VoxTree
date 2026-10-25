import path from "path";

/**
 * Local media storage (Phase 5 of the local-stack migration).
 *
 * Biometric media (voice samples, face frames, LoRA references, generated
 * avatars, talking videos) used to be written under `public/uploads`, where
 * Next.js serves files to anyone who knows the URL. Files now live in
 * `./data/uploads` (gitignored, outside the web root) and are only reachable
 * through the authenticated route at `app/uploads/[...path]/route.ts`,
 * which enforces the same ownership rules as the API routes that create
 * them. Public URL shape is unchanged: `/uploads/<relative path>`.
 */

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

/** Resolve a relative upload path inside UPLOADS_DIR; rejects traversal. */
export function uploadsFilePath(relativePath: string): string {
  const resolved = path.resolve(UPLOADS_DIR, relativePath);
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error(`Invalid upload path: ${relativePath}`);
  }
  return resolved;
}

/** The public URL for a stored upload (unchanged from the public/ era). */
export function uploadUrl(relativePath: string): string {
  return `/uploads/${relativePath.split(path.sep).join("/")}`;
}

/**
 * Resolve a stored media URL path back to a filesystem path for
 * server-side readers. `/uploads/…` maps into the uploads store; any
 * other root-relative path keeps the legacy `public/` behavior.
 */
export function localMediaPath(urlPath: string): string {
  if (urlPath.startsWith("/uploads/")) {
    return uploadsFilePath(urlPath.slice("/uploads/".length));
  }
  return path.join(process.cwd(), "public", urlPath);
}

