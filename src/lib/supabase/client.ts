import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IS_LOCAL, SUPABASE_KEY, SUPABASE_URL } from "./env";
import { createLocalClient } from "./local";

export const isLocalMode = IS_LOCAL;
// Local mode is a fully working fallback, so the login button stays enabled.
export const isSupabaseConfigured = true;

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    const next: SupabaseClient = IS_LOCAL
      ? (createLocalClient() as SupabaseClient)
      : createBrowserClient(SUPABASE_URL!, SUPABASE_KEY!);
    client = next;
  }
  return client!;
}
