import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { IS_LOCAL, SUPABASE_KEY, SUPABASE_URL } from "./env";
import { createLocalClient } from "./local";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CookieToSet = { name: string; value: string; options?: any };

/** Supabase client for server code (route handlers). Reads/writes the login cookie. */
export function supabaseServer() {
  if (IS_LOCAL) return createLocalClient();
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: CookieToSet[]) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* called from a Server Component — safe to ignore */
        }
      },
    },
  });
}
