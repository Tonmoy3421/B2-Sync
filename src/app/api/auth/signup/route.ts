import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth/password";
import { allowAttempt, clientIp } from "@/lib/auth/rate-limit";
import { IS_LOCAL } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Registration. Supabase handles password hashing and sends the verification email. */
export async function POST(request: Request) {
  if (IS_LOCAL) return NextResponse.json({ error: "Use the local sign-up form on this device." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const confirm = typeof body?.confirm === "string" ? body.confirm : "";
  const terms = body?.terms === true;

  if (fullName.length < 2 || fullName.length > 80) return NextResponse.json({ error: "Enter your full name (2–80 characters)." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  if (!terms) return NextResponse.json({ error: "Accept the terms to continue." }, { status: 400 });

  if (!(await allowAttempt(`signup:${clientIp(request)}`, 10, 60 * 60))) {
    return NextResponse.json({ error: "Too many sign-ups from this network. Try again in an hour." }, { status: 429 });
  }
  if (!(await allowAttempt(`signup:${email}`, 5, 60 * 60))) {
    return NextResponse.json({ error: "Too many attempts for this email. Try again in an hour." }, { status: 429 });
  }

  const origin = new URL(request.url).origin;
  const { data, error } = await supabaseServer().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
    },
  });
  if (error) {
    const message = error.message.toLowerCase().includes("already registered")
      ? "An account with this email already exists. Sign in instead."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!data.user) return NextResponse.json({ error: "Could not create your account." }, { status: 502 });

  return NextResponse.json({ ok: true, needsVerification: true, email });
}
