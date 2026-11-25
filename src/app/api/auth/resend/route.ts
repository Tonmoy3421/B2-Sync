import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/auth/password";
import { allowAttempt } from "@/lib/auth/rate-limit";
import { IS_LOCAL } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!(await allowAttempt(`resend:${email}`, 3, 10 * 60))) {
    return NextResponse.json({ error: "Too many requests. Try again in 10 minutes." }, { status: 429 });
  }
  if (!IS_LOCAL) {
    const { error } = await supabaseServer().auth.resend({ type: "signup", email });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
