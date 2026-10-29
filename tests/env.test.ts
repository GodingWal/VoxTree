import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetEnvCache, validateEnv } from "@/lib/env";
import { generateSpeech } from "@/lib/voice-provider";
import { createTalkingVideo, getTalkingVideoStatus, uploadAsset } from "@/lib/hedra";

beforeEach(() => {
  __resetEnvCache();
  vi.stubEnv("NODE_ENV", "production");
  for (const key of ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_FAMILY_MONTHLY_PRICE_ID", "STRIPE_FAMILY_ANNUAL_PRICE_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "REPLICATE_API_TOKEN", "REPLICATE_WEBHOOK_SECRET", "GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_CLOUD_PRIVATE_KEY", "GCS_BUCKET_NAME"]) vi.stubEnv(key, "test-value");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
  vi.stubEnv("DATABASE_URL", "postgres://voxtree:voxtree_dev@localhost:5432/voxtree");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-with-at-least-32-chars");
  vi.stubEnv("GOOGLE_CLOUD_CLIENT_EMAIL", "test@example.com");
  vi.stubEnv("SIMULATION_MODE", "false");
  vi.stubEnv("FEATURE_TALKING_VIDEO", "false");
});
afterEach(() => { vi.unstubAllEnvs(); __resetEnvCache(); });

describe("production configuration and simulation safety", () => {
  it("accepts complete configuration", () => { expect(validateEnv().NEXT_PUBLIC_APP_URL).toBe("https://example.com"); });
  it.each(["NEXT_PUBLIC_APP_URL", "DATABASE_URL", "AUTH_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "GCS_BUCKET_NAME", "REPLICATE_API_TOKEN", "REPLICATE_WEBHOOK_SECRET"])("fails closed without %s", (key) => {
    vi.stubEnv(key, "");
    expect(() => validateEnv()).toThrow(key);
  });
  it("fails closed when AUTH_SECRET is missing entirely in production", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => validateEnv()).toThrow("AUTH_SECRET");
  });
  it("fails closed when AUTH_SECRET is too short in production", () => {
    vi.stubEnv("AUTH_SECRET", "short-secret");
    expect(() => validateEnv()).toThrow("AUTH_SECRET");
  });
  it("accepts the optional AUTH_URL / NEXTAUTH_URL when set", () => {
    vi.stubEnv("AUTH_URL", "https://example.com");
    vi.stubEnv("NEXTAUTH_URL", "https://example.com");
    expect(validateEnv().AUTH_URL).toBe("https://example.com");
  });
  it("stays permissive outside production (short AUTH_SECRET does not throw)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", "short-secret");
    expect(() => validateEnv()).not.toThrow();
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
