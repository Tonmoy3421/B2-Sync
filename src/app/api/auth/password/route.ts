import { NextResponse } from "next/server";
import { SESSION_TTL_SECONDS } from "@/lib/auth/config";
import { issueServerSession } from "@/lib/auth/issue-session";
import { resolveRole } from "@/lib/auth/role";
import { markSignIn } from "@/lib/auth/signin-history";
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth/password";
import { allowAttempt, clientIp } from "@/lib/auth/rate-limit";
import { cache } from "@/lib/auth/redis";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { IS_LOCAL } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Email + password login. Passwords are verified by Supabase Auth, never by this app. */
export async function POST(request: Request) {
  if (IS_LOCAL) {
    return NextResponse.json({ error: "Password accounts need Supabase keys. Use the local sign-in form." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const remember = body?.remember !== false;

  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  // Existing passwords are validated by Supabase. Strength rules apply to new
  // registrations and password changes, so legacy accounts are not locked out.

  if (!(await allowAttempt(`login:${email}`, 8, 15 * 60))) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes.", code: "RATE_LIMIT" }, { status: 429 });
  }
  if (!(await allowAttempt(`login-ip:${clientIp(request)}`, 40, 15 * 60))) {
    return NextResponse.json({ error: "Too many attempts from this network. Try again later.", code: "RATE_LIMIT" }, { status: 429 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const message = error?.message?.toLowerCase().includes("invalid login") ? "Email or password is incorrect." : error?.message || "Could not sign in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
  if (!data.user.email_confirmed_at) {
    return NextResponse.json({ error: "Verify your email before signing in.", code: "EMAIL_NOT_CONFIRMED" }, { status: 403 });
  }

  const signedInEmail = data.user.email ?? email;
  const role = await resolveRole(data.user.id, signedInEmail);
  const response = NextResponse.json({
    ok: true,
    user: { id: data.user.id, email: signedInEmail, role, isAdmin: false },
  });
  await issueServerSession(response, {
    id: data.user.id,
    email: signedInEmail,
    remember,
    provider: "email",
    role,
  });
  await cache.set(`session:${data.user.id}`, { email, role }, SESSION_TTL_SECONDS);
  await markSignIn(data.user.id, signedInEmail);

  const admin = supabaseAdmin();
  if (admin) {
    await admin.from("profiles").update({ email_verified: true, auth_provider: "email", updated_at: new Date().toISOString() }).eq("id", data.user.id);
  }
  return response;
}
