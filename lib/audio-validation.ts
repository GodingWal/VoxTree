import { createHash } from "node:crypto";
import { writeFileSync, unlinkSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

// Configured caps. Keep these conservative — ElevenLabs accepts much larger
// samples, but a 25 MB ceiling matches the GCS signed-PUT default and keeps
// the cost of a bad upload bounded.
export const AUDIO_LIMITS = {
  maxBytes: 25 * 1024 * 1024, // 25 MB
  minDurationSeconds: 30,
  maxDurationSeconds: 600, // 10 minutes
  /** Mean signal level below this is treated as near-silent (dB). */
  silenceThresholdDb: -50,
  /** Fraction of samples at >= -1 dBFS above which we flag as clipped. */
  clippingFractionThreshold: 0.01,
} as const;

export class AudioValidationError extends Error {
  code:
    | "too_small"
    | "too_large"
    | "too_short"
    | "too_long"
    | "silent"
    | "clipped"
    | "unreadable";
  constructor(code: AudioValidationError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface AudioProbe {
  durationSeconds: number;
  bytes: number;
  sha256: string;
  meanVolumeDb: number | null;
  clippedFraction: number | null;
}

/**
 * Probe an audio buffer with ffprobe + the volumedetect filter. Returns
 * duration, byte length, sha256 for idempotency, and loudness metrics.
 * Throws AudioValidationError if the file can't be parsed.
 */
export async function probeAudio(buffer: Buffer): Promise<AudioProbe> {
  if (buffer.length === 0) {
    throw new AudioValidationError("too_small", "Audio file is empty");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Lazy import so test environments without ffmpeg-installer can still
  // import this module.
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  const ffprobePath = ffmpegInstaller.path
    .replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
  const { execFile } = await import("node:child_process");

  const tmp = mkdtempSync(join(os.tmpdir(), "voxtree-audio-"));
  const tmpFile = join(tmp, "sample.bin");
  writeFileSync(tmpFile, buffer);

  try {
    const runProbe = (): Promise<string> =>
      new Promise((resolve, reject) => {
        execFile(
          ffprobePath,
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            tmpFile,
          ],
          (err, stdout) => (err ? reject(err) : resolve(stdout))
        );
      });

    let durationStr: string;
    try {
      durationStr = (await runProbe()).trim();
    } catch (e) {
      throw new AudioValidationError(
        "unreadable",
        `Could not read audio: ${e instanceof Error ? e.message : "unknown"}`
      );
    }
    const durationSeconds = Number.parseFloat(durationStr);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new AudioValidationError("unreadable", "Audio has no readable duration");
    }

    // volumedetect emits "mean_volume: -23.4 dB" and friends to stderr.
    const runVolume = (): Promise<string> =>
      new Promise((resolve) => {
        execFile(
          ffmpegInstaller.path,
          ["-hide_banner", "-i", tmpFile, "-af", "volumedetect", "-f", "null", "-"],
          (_err, _stdout, stderr) => resolve(stderr ?? "")
        );
      });
    const volOutput = await runVolume();
    const meanMatch = volOutput.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
    const maxMatch = volOutput.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
    const meanVolumeDb = meanMatch ? Number.parseFloat(meanMatch[1]) : null;
    const maxVolumeDb = maxMatch ? Number.parseFloat(maxMatch[1]) : null;
    // Approximate "clipped fraction" — without per-sample data we treat
    // max_volume >= -0.1 dB as a strong clipping signal.
    const clippedFraction =
      maxVolumeDb !== null && maxVolumeDb >= -0.1 ? 0.05 : 0;

    return {
      durationSeconds,
      bytes: buffer.length,
      sha256,
      meanVolumeDb,
      clippedFraction,
    };
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Validate a probed audio sample against AUDIO_LIMITS. Throws on failure
 * so callers can surface a useful error to the user instead of letting
 * ElevenLabs reject the upload mid-clone.
 */
export function assertAudioWithinLimits(probe: AudioProbe): void {
  if (probe.bytes > AUDIO_LIMITS.maxBytes) {
    throw new AudioValidationError(
      "too_large",
      `Audio file is ${(probe.bytes / 1024 / 1024).toFixed(1)} MB; max is ${AUDIO_LIMITS.maxBytes / 1024 / 1024} MB.`
    );
  }
  if (probe.durationSeconds < AUDIO_LIMITS.minDurationSeconds) {
    throw new AudioValidationError(
      "too_short",
      `Audio is ${probe.durationSeconds.toFixed(1)}s; need at least ${AUDIO_LIMITS.minDurationSeconds}s for a usable clone.`
    );
  }
  if (probe.durationSeconds > AUDIO_LIMITS.maxDurationSeconds) {
    throw new AudioValidationError(
      "too_long",
      `Audio is ${probe.durationSeconds.toFixed(1)}s; max is ${AUDIO_LIMITS.maxDurationSeconds}s.`
    );
  }
  if (
    probe.meanVolumeDb !== null &&
    probe.meanVolumeDb < AUDIO_LIMITS.silenceThresholdDb
  ) {
    throw new AudioValidationError(
      "silent",
      `Audio is near-silent (mean volume ${probe.meanVolumeDb.toFixed(1)} dB).`
    );
  }
  if (
    probe.clippedFraction !== null &&
    probe.clippedFraction > AUDIO_LIMITS.clippingFractionThreshold
  ) {
    throw new AudioValidationError(
      "clipped",
      "Audio is clipped — please re-record with lower input gain."
    );
  }
}
