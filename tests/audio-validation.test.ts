import { describe, it, expect } from "vitest";
import {
  assertAudioWithinLimits,
  AudioValidationError,
  AUDIO_LIMITS,
  checkPeakDB,
  checkClipping,
  checkSampleRate,
  checkSilence,
  checkDuration,
  validateAudioQuality,
} from "../lib/audio-validation";

function probe(overrides: Partial<{
  durationSeconds: number;
  bytes: number;
  sha256: string;
  meanVolumeDb: number | null;
  clippedFraction: number | null;
  peakVolumeDb: number | null;
  sampleRate: number | null;
}> = {}) {
  return {
    durationSeconds: 60,
    bytes: 1_000_000,
    sha256: "deadbeef",
    meanVolumeDb: -20,
    clippedFraction: 0,
    peakVolumeDb: -6,
    sampleRate: 44100,
    ...overrides,
  };
}

describe("assertAudioWithinLimits", () => {
  it("accepts a well-formed sample", () => {
    expect(() => assertAudioWithinLimits(probe())).not.toThrow();
  });

  it("rejects files over the byte cap", () => {
    try {
      assertAudioWithinLimits(probe({ bytes: AUDIO_LIMITS.maxBytes + 1 }));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AudioValidationError);
      expect((e as AudioValidationError).code).toBe("too_large");
    }
  });

  it("rejects samples below min duration", () => {
    try {
      assertAudioWithinLimits(
        probe({ durationSeconds: AUDIO_LIMITS.minDurationSeconds - 1 })
      );
      throw new Error("expected throw");
    } catch (e) {
      expect((e as AudioValidationError).code).toBe("too_short");
    }
  });

  it("rejects samples above max duration", () => {
    try {
      assertAudioWithinLimits(
        probe({ durationSeconds: AUDIO_LIMITS.maxDurationSeconds + 1 })
      );
      throw new Error("expected throw");
    } catch (e) {
      expect((e as AudioValidationError).code).toBe("too_long");
    }
  });

  it("rejects near-silent audio", () => {
    try {
      assertAudioWithinLimits(
        probe({ meanVolumeDb: AUDIO_LIMITS.silenceThresholdDb - 1 })
      );
      throw new Error("expected throw");
    } catch (e) {
      expect((e as AudioValidationError).code).toBe("silent");
    }
  });

  it("rejects clipped audio", () => {
    try {
      assertAudioWithinLimits(probe({ clippedFraction: 0.1 }));
      throw new Error("expected throw");
    } catch (e) {
      expect((e as AudioValidationError).code).toBe("clipped");
    }
  });

  it("skips silence / clip checks when metrics are null", () => {
    expect(() =>
      assertAudioWithinLimits(
        probe({ meanVolumeDb: null, clippedFraction: null, peakVolumeDb: null, sampleRate: null })
      )
    ).not.toThrow();
  });
});

// ── New quality-gate pure checks ──────────────────────────────────────────

describe("checkPeakDB", () => {
  it("passes for healthy peak (-12 dB)", () => {
    const r = checkPeakDB(-12);
    expect(r.pass).toBe(true);
    expect(r.reason).toBeNull();
  });
  it("passes for borderline healthy peak (-6 dB)", () => {
    expect(checkPeakDB(-6).pass).toBe(true);
  });
  it("fails when peak too low (< -40 dB)", () => {
    const r = checkPeakDB(-45);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/too low/i);
  });
  it("fails when peak too high / clipping (> -0.5 dB)", () => {
    const r = checkPeakDB(0);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/too high|clipping/i);
  });
  it("passes when peak is null (unknown)", () => {
    expect(checkPeakDB(null).pass).toBe(true);
  });
});

describe("checkClipping", () => {
  it("passes when clipped fraction below threshold", () => {
    expect(checkClipping(0).pass).toBe(true);
    expect(checkClipping(0.005).pass).toBe(true);
  });
  it("fails when clipped fraction exceeds threshold", () => {
    const r = checkClipping(0.05);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/clipped/i);
  });
  it("passes when null", () => {
    expect(checkClipping(null).pass).toBe(true);
  });
});

describe("checkSampleRate", () => {
  it("passes for 44100 Hz", () => {
    expect(checkSampleRate(44100).pass).toBe(true);
  });
  it("passes for 16000 Hz (minimum)", () => {
    expect(checkSampleRate(16000).pass).toBe(true);
  });
  it("passes for 48000 Hz (maximum)", () => {
    expect(checkSampleRate(48000).pass).toBe(true);
  });
  it("fails below minimum", () => {
    const r = checkSampleRate(8000);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/too low/i);
  });
  it("fails above maximum", () => {
    const r = checkSampleRate(96000);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/unusually high|max/i);
  });
  it("fails for invalid sample rate 0", () => {
    expect(checkSampleRate(0).pass).toBe(false);
  });
  it("passes when null", () => {
    expect(checkSampleRate(null).pass).toBe(true);
  });
});

describe("checkSilence", () => {
  it("passes for healthy mean volume", () => {
    expect(checkSilence(-20).pass).toBe(true);
  });
  it("fails when near-silent below threshold", () => {
    const r = checkSilence(-60);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/near-silent/i);
  });
  it("passes exactly at threshold", () => {
    expect(checkSilence(AUDIO_LIMITS.silenceThresholdDb).pass).toBe(true);
  });
  it("passes when null", () => {
    expect(checkSilence(null).pass).toBe(true);
  });
});

describe("checkDuration", () => {
  it("passes for 60s (healthy)", () => {
    expect(checkDuration(60).pass).toBe(true);
  });
  it("fails when too short for quality gate (<10s)", () => {
    const r = checkDuration(5);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/need at least/i);
  });
  it("fails when below clone minimum (15s)", () => {
    // 15s passes guided 10s but fails clone 30s minimum — checkDuration enforces clone minimum
    const r = checkDuration(15);
    expect(r.pass).toBe(false);
  });
  it("fails when too long (>600s)", () => {
    const r = checkDuration(700);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/max is/i);
  });
  it("fails for non-finite duration", () => {
    expect(checkDuration(NaN).pass).toBe(false);
    expect(checkDuration(0).pass).toBe(false);
  });
});

describe("validateAudioQuality", () => {
  it("passes for a fully valid probe", () => {
    const r = validateAudioQuality(probe());
    expect(r.pass).toBe(true);
    expect(r.reason).toBeNull();
  });
  it("fails on short duration", () => {
    const r = validateAudioQuality(probe({ durationSeconds: 5 }));
    expect(r.pass).toBe(false);
  });
  it("fails on silent audio", () => {
    const r = validateAudioQuality(probe({ meanVolumeDb: -60 }));
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/near-silent/i);
  });
  it("fails on clipped peak", () => {
    const r = validateAudioQuality(probe({ peakVolumeDb: 0 }));
    expect(r.pass).toBe(false);
  });
  it("fails on low sample rate", () => {
    const r = validateAudioQuality(probe({ sampleRate: 8000 }));
    expect(r.pass).toBe(false);
  });
  it("fails on clipped fraction", () => {
    const r = validateAudioQuality(probe({ clippedFraction: 0.05 }));
    expect(r.pass).toBe(false);
  });
  it("fails on oversized bytes", () => {
    const r = validateAudioQuality(probe({ bytes: AUDIO_LIMITS.maxBytes + 1 }));
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/MB/i);
  });
  it("returns first failure when multiple checks fail", () => {
    // duration fails first
    const r = validateAudioQuality(probe({ durationSeconds: 2, meanVolumeDb: -60 }));
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/need at least/i);
  });
});

describe("AUDIO_LIMITS extended constants", () => {
  it("exposes quality-gate thresholds", () => {
    expect(AUDIO_LIMITS.minSampleRate).toBe(16000);
    expect(AUDIO_LIMITS.maxSampleRate).toBe(48000);
    expect(AUDIO_LIMITS.peakFloorDb).toBe(-40);
    expect(AUDIO_LIMITS.peakCeilingDb).toBe(-0.5);
    expect(AUDIO_LIMITS.guidedMinDurationSeconds).toBe(10);
  });
});
