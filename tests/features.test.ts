import { afterEach, describe, expect, it, vi } from "vitest";
import { featureForPath, isFeatureEnabled, isSimulationEnabled } from "@/lib/features";

afterEach(() => vi.unstubAllEnvs());

describe("production feature safety", () => {
  it("keeps advanced features disabled unless explicitly enabled", () => {
    vi.stubEnv("FEATURE_VISUAL_CLONING", "false");
    expect(isFeatureEnabled("visualCloning")).toBe(false);
    expect(featureForPath("/api/voices/abc/omni-upload")).toBe("visualCloning");
    expect(featureForPath("/api/clips/talking-video")).toBe("talkingVideo");
  });

  it("never allows simulation in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SIMULATION_MODE", "true");
    expect(isSimulationEnabled()).toBe(false);
  });
});
