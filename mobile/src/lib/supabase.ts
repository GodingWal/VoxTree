import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { assertConfigured, config } from "./config";

assertConfigured();

/**
 * Supabase client configured for React Native:
 *  - Uses AsyncStorage for session persistence
 *  - Disables URL detection (there's no window.location in RN)
 */
export const supabase = createClient(
  config.supabaseUrl || "http://placeholder.supabase.co",
  config.supabaseAnonKey || "placeholder-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
