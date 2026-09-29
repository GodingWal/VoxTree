import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetEnvCache, validateEnv } from "@/lib/env";
import { generateSpeech } from "@/lib/elevenlabs";
import { createTalkingVideo, getTalkingVideoStatus, uploadAsset } from "@/lib/hedra";

beforeEach(() => {
  __resetEnvCache();
  vi.stubEnv("NODE_ENV", "production");
  for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_FAMILY_MONTHLY_PRICE_ID", "STRIPE_FAMILY_ANNUAL_PRICE_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "ELEVENLABS_API_KEY", "REPLICATE_API_TOKEN", "REPLICATE_WEBHOOK_SECRET", "GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_CLOUD_PRIVATE_KEY", "GCS_BUCKET_NAME"]) vi.stubEnv(key, "test-value");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("GOOGLE_CLOUD_CLIENT_EMAIL", "test@example.com");
  vi.stubEnv("SIMULATION_MODE", "false");
  vi.stubEnv("FEATURE_TALKING_VIDEO", "false");
});
afterEach(() => { vi.unstubAllEnvs(); __resetEnvCache(); });

describe("production configuration and simulation safety", () => {
  it("accepts complete configuration", () => { expect(validateEnv().NEXT_PUBLIC_APP_URL).toBe("https://example.com"); });
  it.each(["NEXT_PUBLIC_APP_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "GCS_BUCKET_NAME", "ELEVENLABS_API_KEY", "REPLICATE_API_TOKEN", "REPLICATE_WEBHOOK_SECRET"])("fails closed without %s", (key) => {
    vi.stubEnv(key, "");
    expect(() => validateEnv()).toThrow(key);
  });
  it("rejects production simulation even with complete vendor configuration", () => {
    vi.stubEnv("SIMULATION_MODE", "true");
    expect(() => validateEnv()).toThrow("SIMULATION_MODE");
  });
  it("requires Hedra when talking video is enabled", () => {
    vi.stubEnv("FEATURE_TALKING_VIDEO", "true"); vi.stubEnv("HEDRA_API_KEY", "");
    expect(() => validateEnv()).toThrow("HEDRA_API_KEY");
  });
  it("rejects stored fake voice IDs before contacting a vendor", async () => {
    await expect(generateSpeech("simulated_voice_id_old", "Hello")).rejects.toThrow("production");
  });
  it("rejects fake Hedra jobs and missing vendor configuration in production", async () => {
    vi.stubEnv("SIMULATION_MODE", "true"); vi.stubEnv("HEDRA_API_KEY", "");
    await expect(uploadAsset(Buffer.from("test"), "audio", "test.mp3", "audio/mpeg")).rejects.toThrow("simulation");
    await expect(createTalkingVideo({ imageAssetId: "image", audioAssetId: "audio" })).rejects.toThrow("simulation");
    await expect(getTalkingVideoStatus("simulated_hedra_1")).rejects.toThrow("simulation");
  });
});
