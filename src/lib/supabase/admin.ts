import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IS_LOCAL, SUPABASE_URL } from "./env";

/**
 * Service-role client for server-only admin operations. Returns null in local
 * mode or when the service role key is missing — never expose this to browsers.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (IS_LOCAL || !SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
