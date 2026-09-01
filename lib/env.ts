import { z } from "zod";

/**
 * Central environment validation for VoxTree.
 * Import this module early (e.g. in middleware.ts or instrumentation.ts)
 * to fail fast when required configuration is missing.
 *
 * Required variables must be set in every environment. In production,
 * missing values throw immediately; in development/test they can be
 * absent to allow mock/simulation modes.
 */

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_FAMILY_MONTHLY_PRICE_ID: z.string().min(1),
  STRIPE_FAMILY_ANNUAL_PRICE_ID: z.string().min(1),
  STRIPE_PREMIUM_MONTHLY_PRICE_ID: z.string().min(1),
  STRIPE_PREMIUM_ANNUAL_PRICE_ID: z.string().min(1),

  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().min(1),

  // Replicate
  REPLICATE_API_TOKEN: z.string().min(1),
  REPLICATE_WEBHOOK_SECRET: z.string().min(1),

  // GCS
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(1),
  GOOGLE_CLOUD_CLIENT_EMAIL: z.string().email(),
  GOOGLE_CLOUD_PRIVATE_KEY: z.string().min(1),
  GCS_BUCKET_NAME: z.string().min(1),

  // Optional
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  SIMULATION_MODE: z.enum(["true", "false"]).optional(),
  FEATURE_VISUAL_CLONING: z.enum(["true", "false"]).optional(),
  FEATURE_SINGING_VOICE: z.enum(["true", "false"]).optional(),
  FEATURE_TALKING_VIDEO: z.enum(["true", "false"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;
let cachedError: string | null = null;

export function validateEnv(): Env {
  if (cachedEnv) return cachedEnv;
  if (cachedError) throw new Error(cachedError);

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    const message =
      `Missing or invalid environment variables:\n${issues}\n\n` +
      `Copy .env.local.example to .env.local and fill in all required values.\n` +
      `See README.md for setup instructions.`;

    // In production, fail hard. In development/test, warn but allow simulation modes.
    if (process.env.NODE_ENV === "production") {
      cachedError = message;
      throw new Error(message);
    }

    // In non-production, throw only if we're explicitly asked to validate
    // (e.g. via VALIDATE_ENV_ON_START=true). Otherwise return partial env
    // and let simulation fallbacks handle missing values with warnings.
    if (process.env.VALIDATE_ENV_ON_START === "true") {
      cachedError = message;
      throw new Error(message);
    }

    // Return what we have; callers should use isProduction() guards for simulation
    // We still cache the error for later inspection
    cachedError = message;
    // For type safety, return parsed data with defaults for optional fields
    // This allows dev/test to run without all vars
    return process.env as unknown as Env;
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Returns true if running in production. Use this to gate simulation fallbacks.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Assert that simulation mode is allowed. Throws in production if simulation
 * fallback is attempted without explicit SIMULATION_MODE=true.
 */
export function assertSimulationAllowed(context: string): void {
  if (isProduction()) {
    throw new Error(
      `${context} cannot use simulation behavior in production. Configure the real integration or disable the feature.`
    );
  }
}

/**
 * Reset cache (for tests).
 */
export function __resetEnvCache(): void {
  cachedEnv = null;
  cachedError = null;
}
