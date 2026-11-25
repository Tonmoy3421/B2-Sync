import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/current-user";
import { verifySession } from "@/lib/auth/jwt";
import { cache } from "@/lib/auth/redis";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { IS_LOCAL } from "@/lib/supabase/env";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    },
  });
}

/** Secure logout: revoke admin session, clear Supabase cookies and the JWT. No data is deleted. */
export async function DELETE() {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (session) {
    await cache.del(`session:${session.sub}`);
    if (session.isAdmin && session.jti) {
      const sb = supabaseAdmin();
      await sb
        ?.from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("jti", session.jti);
    }
  }
  if (!IS_LOCAL) {
    try {
      await supabaseServer().auth.signOut();
    } catch {
      /* cookie store may be read-only; browser sign-out also runs client-side */
    }
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
