import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { issueSession } from "./session-cookie";
import { resolveRole, type Role } from "./role";

interface Base {
  id: string;
  email: string;
  remember?: boolean;
  provider?: string;
  role?: Role;
}

/** Issues the signed 7-day cookie with a server-resolved role. Expiry never deletes data. */
export async function issueServerSession(
  response: NextResponse,
  { id, email, remember = true, provider = "email", role: knownRole }: Base
) {
  const role = knownRole ?? (await resolveRole(id, email));
  const jti = randomUUID();
  await issueSession(
    response,
    { sub: id, email, role, adminSession: false, isAdmin: false, provider, jti },
    remember
  );
  return { role, jti };
}

/** Admin login only: role is granted after password, owner ID and 2FA checks. */
export async function issueAdminSession(
  response: NextResponse,
  { id, email, remember = true, provider = "admin-password" }: Base
) {
  const jti = randomUUID();
  await issueSession(
    response,
    { sub: id, email, role: "admin", adminSession: true, isAdmin: true, provider, jti },
    remember
  );
  return jti;
}
