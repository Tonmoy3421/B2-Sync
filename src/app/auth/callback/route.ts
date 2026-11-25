import { NextResponse } from "next/server";
import { issueAdminSession, issueServerSession } from "@/lib/auth/issue-session";
import { cache } from "@/lib/auth/redis";
import { markSignIn } from "@/lib/auth/signin-history";
import { SESSION_TTL_SECONDS } from "@/lib/auth/config";
import { clientIp } from "@/lib/auth/rate-limit";
import { isProvisionedOwner } from "@/lib/auth/role";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { IS_LOCAL } from "@/lib/supabase/env";

/** OAuth / email-confirmation / password-recovery callback. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type") ?? "";
  const error = searchParams.get("error");

  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  const rawNext = searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/dashboard");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  // Local mode has no server-readable Supabase session. The browser adapter
  // passes the verified user in the URL so we can still issue the JWT cookie.
  if (IS_LOCAL) {
    const email = searchParams.get("email") ?? "";
    const userId = searchParams.get("uid") ?? "";
    if (!email || !userId) return NextResponse.redirect(`${origin}${next}`);
    const response = NextResponse.redirect(`${origin}${next}`);
    await issueServerSession(response, { id: userId, email, provider: "local", role: "user" });
    await cache.set(`session:${userId}`, { email }, SESSION_TTL_SECONDS);
    return response;
  }

  if (code) {
    const supabase = supabaseServer();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user?.email) return NextResponse.redirect(`${origin}/login?error=auth`);

      // The provisioned owner may enter the admin portal with verified Google
      // Auth alone. Password / recovery links and unprovisioned accounts stay
      // ordinary members.
      if (
        user.app_metadata?.provider === "google" &&
        user.email_confirmed_at &&
        (await isProvisionedOwner(user.id, user.email))
      ) {
        const response = NextResponse.redirect(`${origin}/admin/dashboard`);
        const jti = await issueAdminSession(response, { id: user.id, email: user.email, provider: "google" });
        const sb = supabaseAdmin();
        const ip = clientIp(request);
        const userAgent = (request.headers.get("user-agent") || "").slice(0, 300);
        const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
        const { error: sessionError } = await sb!.from("admin_sessions").insert({
          jti,
          user_id: user.id,
          email: user.email,
          ip,
          user_agent: userAgent,
          expires_at: expiresAt,
        });
        if (sessionError) return NextResponse.redirect(`${origin}/admin/login?error=session`);
        await sb!.from("admin_login_history").insert({ user_id: user.id, email: user.email, ip, user_agent: userAgent });
        await cache.set(`session:${user.id}`, { email: user.email, role: "admin" }, SESSION_TTL_SECONDS);
        await markSignIn(user.id, user.email);
        return response;
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      const provider = type === "recovery" ? "recovery" : type === "signup" || type === "invite" ? "email" : "google";
      await issueServerSession(response, { id: user.id, email: user.email, provider });
      await cache.set(`session:${user.id}`, { email: user.email }, SESSION_TTL_SECONDS);
      await markSignIn(user.id, user.email);
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
