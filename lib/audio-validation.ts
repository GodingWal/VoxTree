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
  /** Minimum required sample rate for cloning (Hz). */
  minSampleRate: 16000,
  /** Maximum expected sample rate (Hz) — above this is likely corrupt. */
  maxSampleRate: 48000,
  /** Peak volume floor — below this the mic is too quiet (dBFS). */
  peakFloorDb: -40,
  /** Peak volume ceiling — above this is clipping (dBFS). */
  peakCeilingDb: -0.5,
  /** Guided script target length for quality gate (seconds). */
  guidedMinDurationSeconds: 10,
} as const;

export class AudioValidationError extends Error {
  code:
    | "too_small"
    | "too_large"
    | "too_short"
    | "too_long"
    | "silent"
    | "clipped"
    | "unreadable"
    | "sample_rate"
    | "peak_too_low"
    | "peak_too_high";
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
  peakVolumeDb: number | null;
  sampleRate: number | null;
}

export type QualityGateResult = { pass: boolean; reason: string | null };

export function checkDuration(durationSeconds: number): QualityGateResult {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { pass: false, reason: "Audio has no readable duration" };
  }
  if (durationSeconds < AUDIO_LIMITS.guidedMinDurationSeconds) {
    return {
      pass: false,
      reason: `Audio is ${durationSeconds.toFixed(1)}s; need at least ${AUDIO_LIMITS.guidedMinDurationSeconds}s for quality gate. Read the full guided script.`,
    };
  }
  if (durationSeconds < AUDIO_LIMITS.minDurationSeconds) {
    return {
      pass: false,
      reason: `Audio is ${durationSeconds.toFixed(1)}s; need at least ${AUDIO_LIMITS.minDurationSeconds}s for a usable clone.`,
    };
  }
  if (durationSeconds > AUDIO_LIMITS.maxDurationSeconds) {
    return {
      pass: false,
      reason: `Audio is ${durationSeconds.toFixed(1)}s; max is ${AUDIO_LIMITS.maxDurationSeconds}s.`,
    };
  }
  return { pass: true, reason: null };
}

export function checkSilence(meanVolumeDb: number | null): QualityGateResult {
  if (meanVolumeDb === null || meanVolumeDb === undefined) {
    return { pass: true, reason: null };
  }
  if (meanVolumeDb < AUDIO_LIMITS.silenceThresholdDb) {
    return {
      pass: false,
      reason: `Audio is near-silent (mean volume ${meanVolumeDb.toFixed(1)} dB). Move closer to the mic and re-record in a quiet room.`,
    };
  }
  return { pass: true, reason: null };
}

export function checkPeakDB(peakDb: number | null): QualityGateResult {
  if (peakDb === null || peakDb === undefined) {
    return { pass: true, reason: null };
  }
  if (peakDb < AUDIO_LIMITS.peakFloorDb) {
    return {
      pass: false,
      reason: `Peak volume too low (${peakDb.toFixed(1)} dB). Speak louder or move closer to the microphone.`,
    };
  }
  if (peakDb > AUDIO_LIMITS.peakCeilingDb) {
    return {
      pass: false,
      reason: `Peak volume too high (${peakDb.toFixed(1)} dB) — clipping detected. Lower input gain and re-record.`,
    };
  }
  return { pass: true, reason: null };
}

export function checkClipping(clippedFraction: number | null): QualityGateResult {
  if (clippedFraction === null || clippedFraction === undefined) {
    return { pass: true, reason: null };
  }
  if (clippedFraction > AUDIO_LIMITS.clippingFractionThreshold) {
    return {
      pass: false,
      reason: "Audio is clipped — please re-record with lower input gain.",
    };
  }
  return { pass: true, reason: null };
}

export function checkSampleRate(sampleRate: number | null): QualityGateResult {
  if (sampleRate === null || sampleRate === undefined) {
    return { pass: true, reason: null };
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { pass: false, reason: "Audio has invalid sample rate" };
  }
  if (sampleRate < AUDIO_LIMITS.minSampleRate) {
    return {
      pass: false,
      reason: `Sample rate ${sampleRate} Hz is too low; need at least ${AUDIO_LIMITS.minSampleRate} Hz for voice cloning.`,
    };
  }
  if (sampleRate > AUDIO_LIMITS.maxSampleRate) {
    return {
      pass: false,
      reason: `Sample rate ${sampleRate} Hz is unusually high; max is ${AUDIO_LIMITS.maxSampleRate} Hz.`,
    };
  }
  return { pass: true, reason: null };
}

export function validateAudioQuality(probe: AudioProbe): QualityGateResult {
  const checks: QualityGateResult[] = [
    checkDuration(probe.durationSeconds),
    checkSilence(probe.meanVolumeDb),
    checkPeakDB(probe.peakVolumeDb),
    checkClipping(probe.clippedFraction),
    checkSampleRate(probe.sampleRate),
  ];
  if (probe.bytes > AUDIO_LIMITS.maxBytes) {
    return {
      pass: false,
      reason: `Audio file is ${(probe.bytes / 1024 / 1024).toFixed(1)} MB; max is ${AUDIO_LIMITS.maxBytes / 1024 / 1024} MB.`,
    };
  }
  for (const c of checks) {
    if (!c.pass) return c;
  }
  return { pass: true, reason: null };
}

export async function probeAudio(buffer: Buffer): Promise<AudioProbe> {
  if (buffer.length === 0) {
    throw new AudioValidationError("too_small", "Audio file is empty");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const [ffmpegInstaller, ffprobeInstaller] = await Promise.all([
    import("@ffmpeg-installer/ffmpeg"),
    import("@ffprobe-installer/ffprobe"),
  ]);
  const ffprobePath =
    (ffprobeInstaller as any).path ??
    (ffmpegInstaller as any).path.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
  const { execFile } = await import("node:child_process");
  const tmp = mkdtempSync(join(os.tmpdir(), "voxtree-audio-"));
  const tmpFile = join(tmp, "sample.bin");
  writeFileSync(tmpFile, buffer);
  try {
    const runProbe = (args: string[]): Promise<string> =>
      new Promise((resolve, reject) => {
        execFile(ffprobePath, args, (err, stdout) => (err ? reject(err) : resolve(stdout)));
      });
    let durationStr: string;
    try {
      durationStr = (
        await runProbe([
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          tmpFile,
        ])
      ).trim();
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
    let sampleRate: number | null = null;
    try {
      const srRaw = (
        await runProbe([
          "-v",
          "error",
          "-select_streams",
          "a:0",
          "-show_entries",
          "stream=sample_rate",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          tmpFile,
        ])
      ).trim();
      const parsed = Number.parseInt(srRaw, 10);
      if (Number.isFinite(parsed) && parsed > 0) sampleRate = parsed;
    } catch {
      // non-fatal
    }
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
    const clippedFraction = maxVolumeDb !== null && maxVolumeDb >= -0.1 ? 0.05 : 0;
    return {
      durationSeconds,
      bytes: buffer.length,
      sha256,
      meanVolumeDb,
      clippedFraction,
      peakVolumeDb: maxVolumeDb,
      sampleRate,
    };
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function assertAudioWithinLimits(probe: AudioProbe): void {
  const normalized: AudioProbe = {
    peakVolumeDb: null,
    sampleRate: null,
    ...probe,
  } as AudioProbe;
  const result = validateAudioQuality(normalized);
  if (result.pass) return;
  const reason = result.reason ?? "Audio validation failed";
  if (reason.includes("too large") || reason.includes("MB")) {
    throw new AudioValidationError("too_large", reason);
  }
  if (reason.includes("need at least") && reason.includes("for a usable clone")) {
    throw new AudioValidationError("too_short", reason);
  }
  if (reason.includes("need at least") && reason.includes("quality gate")) {
    throw new AudioValidationError("too_short", reason);
  }
  if (reason.includes("max is") && reason.includes("s")) {
    throw new AudioValidationError("too_long", reason);
  }
  if (reason.includes("near-silent")) {
    throw new AudioValidationError("silent", reason);
  }
  if (reason.includes("clipping") || reason.includes("clipped")) {
    throw new AudioValidationError("clipped", reason);
  }
  if (reason.includes("Peak volume too low")) {
    throw new AudioValidationError("peak_too_low", reason);
  }
  if (reason.includes("Peak volume too high")) {
    throw new AudioValidationError("peak_too_high", reason);
  }
  if (reason.includes("Sample rate")) {
    throw new AudioValidationError("sample_rate", reason);
  }
  if (reason.includes("no readable duration") || reason.includes("unreadable")) {
    throw new AudioValidationError("unreadable", reason);
  }
  throw new AudioValidationError("unreadable", reason);
}
