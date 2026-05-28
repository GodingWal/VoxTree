import { describe, it, expect } from "vitest";
import {
  assertAudioWithinLimits,
  AudioValidationError,
  AUDIO_LIMITS,
} from "../lib/audio-validation";

function probe(overrides: Partial<{
  durationSeconds: number;
  bytes: number;
  sha256: string;
  meanVolumeDb: number | null;
  clippedFraction: number | null;
}> = {}) {
  return {
    durationSeconds: 60,
    bytes: 1_000_000,
    sha256: "deadbeef",
    meanVolumeDb: -20,
    clippedFraction: 0,
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
        probe({ meanVolumeDb: null, clippedFraction: null })
      )
    ).not.toThrow();
  });
});
