import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Resolve a config value from env first, then fall back to app.json's `extra`.
 * `EXPO_PUBLIC_*` env vars are inlined at build time by Expo.
 */
function resolve(envValue: string | undefined, extraValue: string | undefined) {
  return (envValue?.trim() || extraValue?.trim() || "").replace(/\/$/, "");
}

export const config = {
  supabaseUrl: resolve(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    extra.supabaseUrl
  ),
  supabaseAnonKey: resolve(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    extra.supabaseAnonKey
  ),
  apiBaseUrl: resolve(
    process.env.EXPO_PUBLIC_API_BASE_URL,
    extra.apiBaseUrl
  ),
};

export function assertConfigured() {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push("EXPO_PUBLIC_SUPABASE_URL");
  if (!config.supabaseAnonKey) missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    // Surface a helpful error in dev rather than a cryptic Supabase failure.
    // eslint-disable-next-line no-console
    console.warn(
      `[VoxTree] Missing env vars: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill in your Supabase credentials."
    );
  }
}
