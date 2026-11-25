import { NextResponse } from "next/server";
import { isOwnerEmail, SESSION_TTL_SECONDS } from "@/lib/auth/config";
import { issueAdminSession } from "@/lib/auth/issue-session";
import { isValidEmail, normalizeEmail } from "@/lib/auth/password";
import { allowAttempt, clientIp } from "@/lib/auth/rate-limit";
import { cache } from "@/lib/auth/redis";
import { isProvisionedOwner } from "@/lib/auth/role";
import { totpRequired, verifyTotp } from "@/lib/auth/totp";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { IS_LOCAL } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function logAttempt(
  sb: NonNullable<ReturnType<typeof supabaseAdmin>>,
  email: string,
  request: Request,
  reason: string
) {
  await sb.from("admin_login_attempts").insert({
    email: email.slice(0, 200),
    ip: clientIp(request),
    user_agent: (request.headers.get("user-agent") || "").slice(0, 300),
    reason,
  });
}

/**
 * Owner-only login. Password verification is done by Supabase Auth; the role,
 * immutable user ID and optional TOTP are verified here before issuing a JWT.
 */
export async function POST(request: Request) {
  if (IS_LOCAL) {
    return NextResponse.json(
      { error: "Owner admin requires Supabase keys. Configure Supabase to enable /admin/login." },
      { status: 503 }
    );
  }
  const sbAdmin = supabaseAdmin();
  if (!sbAdmin) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY to enable owner admin login." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const remember = body?.remember !== false;

  if (!isValidEmail(email) || !password) {
    return NextResponse.json({ error: "Enter your admin email and password." }, { status: 400 });
  }

  if (!(await allowAttempt(`admin:${email}`, 5, 15 * 60))) {
    await logAttempt(sbAdmin, email, request, "rate_limit");
    return NextResponse.json(
      { error: "Too many admin login attempts. Try again in 15 minutes.", code: "RATE_LIMIT" },
      { status: 429 }
    );
  }
  if (!(await allowAttempt(`admin-ip:${clientIp(request)}`, 20, 15 * 60))) {
    await logAttempt(sbAdmin, email, request, "rate_limit_ip");
    return NextResponse.json(
      { error: "Too many attempts from this network. Try again later.", code: "RATE_LIMIT" },
      { status: 429 }
    );
  }

  // Reject non-owner emails before any password work or account enumeration.
  if (!isOwnerEmail(email)) {
    await logAttempt(sbAdmin, email, request, "not_owner");
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const { data, error } = await supabaseServer().auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await logAttempt(sbAdmin, email, request, "invalid_credentials");
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  if (!data.user.email_confirmed_at) {
    await logAttempt(sbAdmin, email, request, "email_unconfirmed");
    return NextResponse.json({ error: "Verify your email before signing in." }, { status: 403 });
  }

  const actualEmail = normalizeEmail(data.user.email);
  if (!isOwnerEmail(actualEmail)) {
    await logAttempt(sbAdmin, actualEmail, request, "email_mismatch");
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  if (!(await isProvisionedOwner(data.user.id, actualEmail))) {
    await logAttempt(sbAdmin, actualEmail, request, "not_provisioned");
    return NextResponse.json(
      { error: "This account is not provisioned as the owner admin. Run the provisioning script." },
      { status: 403 }
    );
  }

  if (totpRequired()) {
    if (!code || !verifyTotp(code)) {
      await logAttempt(sbAdmin, actualEmail, request, code ? "invalid_totp" : "totp_required");
      return NextResponse.json(
        {
          error: code ? "Invalid two-factor code." : "Enter your two-factor code.",
          code: "TOTP_REQUIRED",
        },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: data.user.id, email: actualEmail, role: "admin", isAdmin: true },
  });
  const jti = await issueAdminSession(response, { id: data.user.id, email: actualEmail, remember });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  const ip = clientIp(request);
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 300);

  await sbAdmin.from("admin_login_history").insert({
    user_id: data.user.id,
    email: actualEmail,
    ip,
    user_agent: userAgent,
  });
  await sbAdmin.from("admin_sessions").insert({
    jti,
    user_id: data.user.id,
    email: actualEmail,
    ip,
    user_agent: userAgent,
    expires_at: expiresAt,
  });
  await cache.set(`session:${data.user.id}`, { email: actualEmail, role: "admin" }, SESSION_TTL_SECONDS);
  return response;
}
