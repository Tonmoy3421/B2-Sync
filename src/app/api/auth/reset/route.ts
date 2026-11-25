import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/password";
import { allowAttempt, clientIp } from "@/lib/auth/rate-limit";
import { IS_LOCAL } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Always returns the same message so account existence is not revealed. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!(await allowAttempt(`reset:${clientIp(request)}`, 10, 15 * 60))) {
    return NextResponse.json({ error: "Too many requests. Try again in 15 minutes." }, { status: 429 });
  }
  if (!(await allowAttempt(`reset:${email}`, 3, 15 * 60))) {
    return NextResponse.json({ ok: true }); // stay non-enumerable
  }

  if (!IS_LOCAL) {
    const origin = new URL(request.url).origin;
    await supabaseServer().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
  }
  return NextResponse.json({ ok: true });
}
