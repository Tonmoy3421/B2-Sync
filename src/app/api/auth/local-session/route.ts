import { NextResponse } from "next/server";
import { SESSION_TTL_SECONDS } from "@/lib/auth/config";
import { issueServerSession } from "@/lib/auth/issue-session";
import { isValidEmail, normalizeEmail } from "@/lib/auth/password";
import { cache } from "@/lib/auth/redis";
import { IS_LOCAL } from "@/lib/supabase/env";

export const runtime = "nodejs";

/**
 * Dev-only helper: after the browser adapter has verified a local Google/OTP
 * login, exchange that session for the JWT cookie the middleware requires.
 * Admin rights cannot be granted here — local mode has no trusted role store.
 */
export async function POST(request: Request) {
  if (!IS_LOCAL) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const userId = typeof body?.userId === "string" ? body.userId.trim().slice(0, 100) : "";
  if (!isValidEmail(email) || !userId) return NextResponse.json({ error: "Invalid local session." }, { status: 400 });

  const ticketId = typeof body?.ticket === "string" ? body.ticket : "";
  if (ticketId) await cache.del(`ticket:${ticketId}`);

  const response = NextResponse.json({ ok: true, user: { id: userId, email, role: "user", isAdmin: false } });
  await issueServerSession(response, { id: userId, email, provider: "local", role: "user" });
  await cache.set(`session:${userId}`, { email, role: "user" }, SESSION_TTL_SECONDS);
  return response;
}
