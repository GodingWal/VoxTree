import { z } from "zod";

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_FAMILY_MONTHLY_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_FAMILY_ANNUAL_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_PREMIUM_MONTHLY_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_PREMIUM_ANNUAL_PRICE_ID: z.string().startsWith("price_"),

  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().min(1),

  // AWS
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_CLOUDFRONT_DOMAIN: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

/**
 * Validated environment variables. Throws at startup with a clear message
 * if any required variable is missing or malformed, rather than crashing
 * with a cryptic undefined/null error at call time.
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Missing or invalid environment variables:\n${missing}\n\nSee .env.local.example for the full list.`
    );
  }

  return result.data;
}

export const env = validateEnv();
