import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { IS_LOCAL, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { SESSION_COOKIE } from "./config";
import { verifySession } from "./jwt";
import { resolveRole, type Role } from "./role";

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  provider?: string;
  jti?: string;
  source: "jwt" | "supabase";
}

/** Accepts the 7-day JWT cookie or an existing Supabase (Google) session. */
export async function currentUser(): Promise<CurrentUser | null> {
  const jwt = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (jwt) {
    return {
      id: jwt.sub,
      email: jwt.email,
      role: jwt.role,
      isAdmin: jwt.isAdmin,
      provider: jwt.provider,
      jti: jwt.jti,
      source: "jwt",
    };
  }

  if (!IS_LOCAL && SUPABASE_URL && SUPABASE_KEY) {
    const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => cookies().getAll(),
        setAll: () => undefined,
      },
    });
    const { data } = await sb.auth.getUser();
    if (data.user?.email) {
      const role = await resolveRole(data.user.id, data.user.email);
      return {
        id: data.user.id,
        email: data.user.email,
        role,
        isAdmin: false,
        provider: "email",
        source: "supabase",
      };
    }
  }
  return null;
}
