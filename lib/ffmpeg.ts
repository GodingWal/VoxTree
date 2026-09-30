import { spawn } from "node:child_process";

/**
 * Central ffmpeg/ffprobe wrapper.
 * Uses @ffmpeg-installer/ffmpeg and @ffprobe-installer/ffprobe binary paths
 * directly with child_process spawn — no fluent-ffmpeg dependency.
 * Binary paths are resolved lazily (dynamic import) so the installer packages
 * are never evaluated at build time (they use dynamic require() that cannot be bundled).
 */

export async function getFfmpegPath(): Promise<string> {
  const mod: any = await import("@ffmpeg-installer/ffmpeg");
  return mod.path ?? mod.default?.path ?? String(mod);
}

export async function getFfprobePath(): Promise<string> {
  try {
    const mod: any = await import("@ffprobe-installer/ffprobe");
    if (mod.path) return mod.path;
    if (mod.default?.path) return mod.default.path;
  } catch {
    // fallback below
  }
  const ffmpegPath = await getFfmpegPath();
  return ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
}

function spawnProcess(
  bin: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${bin} exited with code ${code}: ${stderr.slice(-800) || stdout.slice(-800)}`
          )
        );
    });
  });
}

export async function runFfmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const bin = await getFfmpegPath();
  return spawnProcess(bin, args);
}

export async function runFfprobe(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const bin = await getFfprobePath();
  return spawnProcess(bin, args);
}

/** Probe file duration (seconds) via ffprobe. */
export async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const v = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(v) || v <= 0) throw new Error("Could not determine duration");
  return v;
}

/** Extract audio as PCM 16-bit mono 44.1kHz WAV. */
export async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg([
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "pcm_s16le",
    "-ar",
    "44100",
    "-ac",
    "1",
    outputPath,
  ]);
}

/**
 * Extract a single frame at `timestamp` seconds (number or string) to `outputPath`.
 * `size` is e.g. "640x640" — passed as `-s` (same behaviour as fluent-ffmpeg screenshots `size`).
 */
export async function extractFrame(
  inputPath: string,
  timestamp: number | string,
  outputPath: string,
  size?: string
): Promise<void> {
  const ts = String(timestamp);
  const args: string[] = ["-hide_banner", "-y", "-ss", ts, "-i", inputPath, "-vframes", "1"];
  if (size) args.push("-s", size);
  // Use -q:v 2 for decent JPEG quality (fluent-ffmpeg default is similar)
  args.push("-q:v", "2", outputPath);
  await runFfmpeg(args);
}

/**
 * Extract multiple frames. Supports numeric seconds and percentage strings like "10%".
 * `outputPattern` may contain `%i` placeholder (fluent-ffmpeg convention) — replaced with 1-based index.
 * Frames are written to `folder` directory.
 */
export async function extractFrames(
  inputPath: string,
  timestamps: (number | string)[],
  folder: string,
  size: string,
  outputPattern = "frame_%i.jpg"
): Promise<void> {
  // Resolve percentage timestamps to seconds using duration
  const hasPercent = timestamps.some((t) => typeof t === "string" && String(t).includes("%"));
  let duration: number | null = null;
  if (hasPercent) {
    duration = await probeDuration(inputPath);
  }
  for (let i = 0; i < timestamps.length; i++) {
    let ts = timestamps[i];
    if (typeof ts === "string" && ts.includes("%")) {
      const pct = Number.parseFloat(ts.replace("%", "")) / 100;
      if (duration !== null) ts = String(duration * pct);
    }
    const filename = outputPattern.replace("%i", String(i + 1));
    const outPath = `${folder.replace(/\/$/, "")}/${filename}`;
    await extractFrame(inputPath, ts as number | string, outPath, size);
  }
}

/**
 * Mix two audio files (vocals + background) with amix.
 * Equivalent to the fluent-ffmpeg complexFilter used in clips/generate.
 */
export async function mixAudio(
  speechFile: string,
  bgFile: string,
  outputFile: string
): Promise<void> {
  await runFfmpeg([
    "-hide_banner",
    "-y",
    "-i",
    speechFile,
    "-i",
    bgFile,
    "-filter_complex",
    "[0:a]volume=1.0[a0];[1:a]volume=0.3[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
    "-map",
    "[aout]",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    outputFile,
  ]);
}

/** Run volumedetect filter and return stderr output (contains mean_volume/max_volume). */
export async function getVolumeDetection(inputPath: string): Promise<string> {
  const { stderr } = await runFfmpeg([
    "-hide_banner",
    "-i",
    inputPath,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-",
  ]);
  return stderr;
}
