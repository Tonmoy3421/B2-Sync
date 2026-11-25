/**
 * One-time, server-side owner admin provisioning.
 *
 *   node scripts/provision-owner-admin.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (or the shell). It verifies the real Supabase Auth account by email plus its
 * immutable user ID before assigning the single admin role.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.OWNER_ADMIN_EMAIL || "shahriarniaztonmoy@gmail.com").trim().toLowerCase();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUser() {
  let page = 1;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function availableUsername(userId) {
  const base = (email.split("@")[0] || "owner").replace(/[^a-z0-9_]/g, "").slice(0, 15) || "owner";
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const { data } = await supabase.from("profiles").select("id").eq("username", candidate).maybeSingle();
    if (!data || data.id === userId) return candidate;
    candidate = `${base.slice(0, 11)}${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error("Could not find an available username for the owner profile.");
}

async function main() {
  const user = await findAuthUser();
  if (!user) {
    console.error(`No Supabase Auth account for ${email}. Sign up / sign in with that email first, then run this script.`);
    process.exit(1);
  }
  if (!user.email_confirmed_at) {
    console.error("The owner email is not confirmed. Confirm it in Supabase Auth, then re-run.");
    process.exit(1);
  }

  const { data: storedId } = await supabase
    .from("schema_meta")
    .select("value")
    .eq("key", "owner_admin_id")
    .maybeSingle();
  if (storedId?.value && storedId.value !== user.id) {
    console.error("A different immutable Auth user ID is already provisioned as owner. Refusing to replace it.");
    process.exit(1);
  }

  const { data: admins, error: adminError } = await supabase
    .from("profiles")
    .select("id,email")
    .eq("role", "admin");
  if (adminError) throw adminError;
  const other = (admins ?? []).find((row) => row.id !== user.id);
  if (other) {
    console.error(`Another admin already exists (${other.email}). Remove that row manually before provisioning.`);
    process.exit(1);
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id,username,full_name")
    .eq("id", user.id)
    .maybeSingle();
  const username = existingProfile?.username ? undefined : await availableUsername(user.id);
  const profile = {
    id: user.id,
    email,
    role: "admin",
    is_admin: true,
    approved: true,
    suspended: false,
    email_verified: true,
    auth_provider: user.app_metadata?.provider || "email",
    full_name: existingProfile?.full_name || user.user_metadata?.full_name || email.split("@")[0],
    ...(username ? { username } : {}),
  };
  const { error: profileError } = existingProfile
    ? await supabase.from("profiles").update(profile).eq("id", user.id)
    : await supabase.from("profiles").insert(profile);
  if (profileError) throw profileError;

  const appMetadata = {
    ...(user.app_metadata ?? {}),
    role: "admin",
    owner_admin_id: user.id,
  };
  const { error: authError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: appMetadata,
  });
  if (authError) throw authError;

  const { error: metaError } = await supabase.from("schema_meta").upsert({
    key: "owner_admin_id",
    value: user.id,
  });
  if (metaError) throw metaError;

  console.log("Owner admin provisioned.");
  console.log(`  email: ${email}`);
  console.log(`  immutable Auth ID: ${user.id}`);
  console.log("  role: admin (exclusive)");
  console.log("\nNext: set JWT_SECRET and restart the app. Sign in at /admin/login.");
  if (!process.env.ADMIN_TOTP_SECRET) {
    console.log("Optional 2FA: ADMIN_TOTP_SECRET=<base32 secret> (generate: openssl rand -base32 20)");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
