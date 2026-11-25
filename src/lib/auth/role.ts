import { supabaseAdmin } from "@/lib/supabase/admin";
import { isOwnerEmail } from "./config";

export type Role = "user" | "admin";

type ProfileRoleRow = { role: string | null; email: string | null; is_admin?: boolean | null };

/** Role is read from the database on the server; the browser never supplies it. */
export async function resolveRole(userId: string, email?: string | null): Promise<Role> {
  const sb = supabaseAdmin();
  if (!sb || !userId) return "user";

  const { data } = await sb
    .from("profiles")
    .select("role,email,is_admin")
    .eq("id", userId)
    .maybeSingle<ProfileRoleRow>();

  const profileEmail = (data?.email ?? email ?? "").trim().toLowerCase();
  if (data?.role === "admin" && isOwnerEmail(profileEmail)) return "admin";
  return "user";
}

/** Verifies the provisioned Auth ID, DB role and real email — no session needed. */
export async function isProvisionedOwner(userId: string, email?: string | null): Promise<boolean> {
  if ((await resolveRole(userId, email)) !== "admin") return false;
  const sb = supabaseAdmin();
  if (!sb) return false;
  const { data: meta } = await sb
    .from("schema_meta")
    .select("value")
    .eq("key", "owner_admin_id")
    .maybeSingle<{ value: string }>();
  return !meta?.value || meta.value === userId;
}

/** Strict owner check for every admin operation, including active session state. */
export async function isOwnerAdmin(
  userId: string,
  email?: string | null,
  jti?: string
): Promise<boolean> {
  if (!(await isProvisionedOwner(userId, email))) return false;
  // Admin operations require the jti from an /api/admin/login session.
  if (!jti) return false;

  const sb = supabaseAdmin();
  if (!sb) return false;
  const { data: session } = await sb
    .from("admin_sessions")
    .select("id")
    .eq("jti", jti)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string }>();
  return Boolean(session);
}

/** Used during provisioning only. Called by a trusted server-side script. */
export async function findProvisionedOwnerId(): Promise<string | null> {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const { data } = await sb
    .from("schema_meta")
    .select("value")
    .eq("key", "owner_admin_id")
    .maybeSingle<{ value: string }>();
  return data?.value || null;
}
