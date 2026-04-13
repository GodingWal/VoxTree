import { createClient as createJsClient, SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { createClient as createSsrClient } from "./server";

/**
 * Returns a Supabase client authenticated as the current user.
 *
 * Web requests send credentials via cookies (handled by @supabase/ssr). Mobile
 * and any non-browser consumers send `Authorization: Bearer <access_token>`,
 * so we fall back to a plain JS client configured with that token. Either way,
 * Row-Level Security ensures the returned client can only act as that user.
 */
export function getRouteClient(): SupabaseClient {
  const auth = headers().get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const token = auth.replace(/^bearer\s+/i, "").trim();
    return createJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }
  return createSsrClient();
}
