import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client with the service-role key for privileged server-side
 * operations that bypass Row Level Security. Never expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
