import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

/**
 * Transcode an arbitrary audio buffer (webm/wav/m4a/etc.) to a clean,
 * normalized MP3 that's safe to ship to ElevenLabs and RVC.
 *
 * - 22.05 kHz mono is sufficient for speech cloning and roughly halves the
 *   payload vs 44.1 kHz stereo.
 * - libmp3lame V2 (~96 kbps VBR) keeps quality high without inflating bytes.
 * - `-ac 1` collapses to mono so callers don't accidentally ship a stereo
 *   sample with one silent channel.
 */
export async function transcodeToMp3(buffer: Buffer): Promise<Buffer> {
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  const { execFile } = await import("node:child_process");

  const tmp = mkdtempSync(join(os.tmpdir(), "voxtree-transcode-"));
  const inFile = join(tmp, "in.bin");
  const outFile = join(tmp, "out.mp3");
  writeFileSync(inFile, buffer);

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegInstaller.path,
        [
          "-hide_banner",
          "-y",
          "-i",
          inFile,
          "-ar",
          "22050",
          "-ac",
          "1",
          "-codec:a",
          "libmp3lame",
          "-q:a",
          "2",
          outFile,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return readFileSync(outFile);
  } finally {
    if (existsSync(inFile)) unlinkSync(inFile);
    if (existsSync(outFile)) unlinkSync(outFile);
    rmSync(tmp, { recursive: true, force: true });
  }
}
