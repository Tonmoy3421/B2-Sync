import type { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "./config";
import { signSession, type SessionPayload } from "./jwt";

/** httpOnly JWT cookie. "Remember me" keeps it for 7 days; otherwise it is a session cookie. */
export function setSessionCookie(response: NextResponse, token: string, remember = true) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: SESSION_TTL_SECONDS } : {}),
  });
}

export async function issueSession(response: NextResponse, payload: SessionPayload, remember = true) {
  const token = await signSession(payload);
  setSessionCookie(response, token, remember);
  return token;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
