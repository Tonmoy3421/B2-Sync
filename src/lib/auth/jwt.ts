import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_SECONDS } from "./config";
import type { Role } from "./role";

export interface SessionPayload {
  sub: string;
  email: string;
  role: Role;
  /** True only for sessions issued by /api/admin/login. */
  adminSession: boolean;
  isAdmin: boolean;
  provider?: string;
  jti?: string;
}

function key() {
  const secret = process.env.JWT_SECRET || "b2sync-local-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    adminSession: payload.adminSession,
    isAdmin: payload.adminSession,
    provider: payload.provider ?? "",
    jti: payload.jti ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub || typeof payload.email !== "string") return null;
    const role: Role = payload.role === "admin" ? "admin" : "user";
    const adminSession = payload.adminSession === true;
    return {
      sub: payload.sub,
      email: payload.email,
      role,
      adminSession,
      isAdmin: adminSession,
      provider: typeof payload.provider === "string" ? payload.provider : undefined,
      jti: typeof payload.jti === "string" ? payload.jti : undefined,
    };
  } catch {
    return null;
  }
}
