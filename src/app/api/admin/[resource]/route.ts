import { NextResponse } from "next/server";
import { isOwnerEmail } from "@/lib/auth/config";
import type { CurrentUser } from "@/lib/auth/current-user";
import { currentUser } from "@/lib/auth/current-user";
import { cache, cached, usingUpstash } from "@/lib/auth/redis";
import { isOwnerAdmin } from "@/lib/auth/role";
import { totpRequired } from "@/lib/auth/totp";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

type Resource =
  | "stats"
  | "requests"
  | "users"
  | "events"
  | "audit"
  | "courses"
  | "materials"
  | "announcements"
  | "settings"
  | "security"
  | "sessions";

const RESOURCES: Resource[] = [
  "stats",
  "requests",
  "users",
  "events",
  "audit",
  "courses",
  "materials",
  "announcements",
  "settings",
  "security",
  "sessions",
];
const MATERIAL_KINDS = ["pdf", "note", "doc", "image", "audio", "video", "link", "assignment", "past_paper"];

type AdminClient = NonNullable<ReturnType<typeof supabaseAdmin>>;

async function requireAdmin(): Promise<CurrentUser | null> {
  const user = await currentUser();
  if (!user || !user.isAdmin) return null;
  if (!(await isOwnerAdmin(user.id, user.email, user.jti))) return null;
  return user;
}

function invalid(resource: string) {
  return NextResponse.json({ error: `Unknown admin resource: ${resource}` }, { status: 404 });
}

async function count(sb: AdminClient, table: string, column?: string, value?: unknown) {
  let query = sb.from(table).select("*", { count: "exact", head: true });
  if (column && value !== undefined) query = query.eq(column, value);
  const { count: n } = await query;
  return n ?? 0;
}

async function loadTarget(sb: AdminClient, id: string) {
  const { data } = await sb
    .from("profiles")
    .select("id,email,role,suspended")
    .eq("id", id)
    .maybeSingle<{ id: string; email: string | null; role: string | null; suspended: boolean }>();
  return data;
}

function targetIsOwner(target?: { email: string | null; role: string | null } | null) {
  return Boolean(target?.role === "admin" || isOwnerEmail(target?.email));
}

async function audit(
  session: CurrentUser,
  action: string,
  target: string,
  details: Record<string, unknown>,
  request?: Request
) {
  const sb = supabaseAdmin();
  await sb?.from("admin_actions").insert({
    actor_email: session.email,
    action,
    target,
    details: { ...details, ip: request ? clientIp(request) : undefined },
  });
  await cache.del("admin:stats");
}

function needServiceKey() {
  return NextResponse.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to use the admin panel." }, { status: 503 });
}

export async function GET(_request: Request, { params }: { params: { resource: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access only" }, { status: 403 });
  if (!RESOURCES.includes(params.resource as Resource)) return invalid(params.resource);
  const sb = supabaseAdmin();
  if (!sb) return needServiceKey();

  try {
    switch (params.resource as Resource) {
      case "stats": {
        const stats = await cached("admin:stats", 30, async () => {
          const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
          const [
            users,
            activeUsers,
            newUsers,
            pending,
            requests,
            events,
            courses,
            materials,
            groups,
            actions,
          ] = await Promise.all([
            count(sb, "profiles"),
            count(sb, "profiles", "suspended", false),
            (async () => {
              const { count: n } = await sb
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .gte("created_at", since);
              return n ?? 0;
            })(),
            (async () => {
              const { count: n } = await sb
                .from("join_requests")
                .select("*", { count: "exact", head: true })
                .eq("status", "pending");
              return n ?? 0;
            })(),
            count(sb, "join_requests"),
            count(sb, "events"),
            count(sb, "courses"),
            count(sb, "resources"),
            count(sb, "groups"),
            count(sb, "admin_actions"),
          ]);
          return {
            users,
            activeUsers,
            newUsers,
            pending,
            requests,
            events,
            courses,
            materials,
            groups,
            actions,
            system: {
              database: "Operational",
              auth: "Supabase Auth",
              sessions: "7-day signed cookies",
              cache: usingUpstash ? "Upstash Redis" : "In-memory (dev)",
              twoFactor: totpRequired() ? "Required" : "Optional",
            },
          };
        });
        return NextResponse.json(stats);
      }
      case "users": {
        const { data, error } = await sb
          .from("profiles")
          .select("id,email,username,full_name,role,approved,suspended,created_at,updated_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "requests": {
        const { data, error } = await sb.from("join_requests").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "events": {
        const { data, error } = await sb
          .from("events")
          .select("*, profiles!events_user_id_fkey(full_name,email)")
          .order("starts_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "courses": {
        const { data, error } = await sb
          .from("courses")
          .select("*, profiles!courses_owner_id_fkey(full_name,email)")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "materials": {
        const { data, error } = await sb
          .from("resources")
          .select("id,title,kind,description,url,storage_path,created_at,course_id,topic_id,courses(name),topics(title)")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "announcements": {
        const { data, error } = await sb
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "settings": {
        const { data, error } = await sb.from("site_settings").select("*").order("key");
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "security": {
        const [logins, failed, suspicious] = await Promise.all([
          sb.from("admin_login_history").select("*").order("created_at", { ascending: false }).limit(100),
          sb.from("admin_login_attempts").select("*").order("created_at", { ascending: false }).limit(100),
          sb.from("admin_login_attempts")
            .select("*")
            .in("reason", ["rate_limit", "rate_limit_ip", "email_mismatch", "invalid_totp"])
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        if (logins.error) throw logins.error;
        if (failed.error) throw failed.error;
        if (suspicious.error) throw suspicious.error;
        return NextResponse.json({
          items: {
            logins: logins.data ?? [],
            failed: failed.data ?? [],
            suspicious: suspicious.data ?? [],
          },
        });
      }
      case "sessions": {
        const { data, error } = await sb
          .from("admin_sessions")
          .select("id,jti,email,ip,user_agent,created_at,expires_at,revoked_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
      case "audit": {
        const { data, error } = await sb
          .from("admin_actions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(150);
        if (error) throw error;
        return NextResponse.json({ items: data ?? [] });
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin query failed" }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: { resource: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access only" }, { status: 403 });
  if (!RESOURCES.includes(params.resource as Resource)) return invalid(params.resource);
  const sb = supabaseAdmin();
  if (!sb) return needServiceKey();
  const body = await request.json().catch(() => ({}));
  const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  try {
    if (params.resource === "users") {
      const email = text(body.email, 200).toLowerCase();
      const username = text(body.username, 20).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return NextResponse.json({ error: "Username: 3-20 lowercase letters, numbers or _" }, { status: 400 });
      if (isOwnerEmail(email)) return NextResponse.json({ error: "The owner account cannot be recreated here." }, { status: 403 });

      const created = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: text(body.full_name, 80) || username },
      });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Could not create auth user");
      const { error } = await sb.from("profiles").insert({
        id: created.data.user.id,
        email,
        username,
        full_name: text(body.full_name, 80),
        university: text(body.university, 120),
        department: text(body.department, 80),
        semester: text(body.semester, 40),
        approved: true,
        role: "user",
        suspended: false,
      });
      if (error) throw error;
      await audit(session, "user.add", email, { username }, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "events") {
      const title = text(body.title, 160);
      const startsAt = body.starts_at;
      if (!title || typeof startsAt !== "string" || Number.isNaN(Date.parse(startsAt))) {
        return NextResponse.json({ error: "Title and valid start date required" }, { status: 400 });
      }
      const { error } = await sb.from("events").insert({
        user_id: session.id,
        title,
        kind: text(body.kind, 40) || "group",
        description: text(body.description, 2000),
        starts_at: startsAt,
        ends_at: typeof body.ends_at === "string" ? body.ends_at : null,
        remind_minutes: Number(body.remind_minutes ?? 30),
      });
      if (error) throw error;
      await audit(session, "event.add", title, { starts_at: startsAt }, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "announcements") {
      const title = text(body.title, 160);
      if (title.length < 2) return NextResponse.json({ error: "Announcement title required" }, { status: 400 });
      const { error } = await sb.from("announcements").insert({
        title,
        body: text(body.body, 4000),
        active: body.active !== false,
      });
      if (error) throw error;
      await audit(session, "announcement.add", title, {}, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "materials") {
      const title = text(body.title, 160);
      const kind = text(body.kind, 30) || "link";
      const url = text(body.url, 1000);
      const storagePath = text(body.storage_path, 1000);
      if (!title || !MATERIAL_KINDS.includes(kind)) return NextResponse.json({ error: "Title and valid material kind required" }, { status: 400 });
      if (!url && !storagePath) return NextResponse.json({ error: "Provide a URL or storage path" }, { status: 400 });
      const { error } = await sb.from("resources").insert({
        owner_id: session.id,
        course_id: typeof body.course_id === "string" ? body.course_id : null,
        topic_id: typeof body.topic_id === "string" ? body.topic_id : null,
        title,
        kind,
        description: text(body.description, 2000),
        url: url || null,
        storage_path: storagePath || null,
      });
      if (error) throw error;
      await audit(session, "material.add", title, { kind }, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "settings") {
      const key = text(body.key, 60).toLowerCase();
      if (!/^[a-z0-9_]{2,60}$/.test(key)) return NextResponse.json({ error: "Invalid settings key" }, { status: 400 });
      const value = body.value && typeof body.value === "object" ? body.value : {};
      const { error } = await sb.from("site_settings").upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
      await audit(session, "settings.add", key, {}, request);
      return NextResponse.json({ ok: true });
    }

    return invalid(params.resource);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin action failed" }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: { resource: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access only" }, { status: 403 });
  if (!RESOURCES.includes(params.resource as Resource)) return invalid(params.resource);
  const sb = supabaseAdmin();
  if (!sb) return needServiceKey();
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : params.resource === "settings" && typeof body.key === "string" ? body.key : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const patchBody = (body.patch && typeof body.patch === "object" ? body.patch : {}) as Record<string, unknown>;
  const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  try {
    if (params.resource === "requests") {
      const { data: req, error: loadError } = await sb.from("join_requests").select("*").eq("id", id).maybeSingle();
      if (loadError) throw loadError;
      if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      const patch: Record<string, unknown> = {};
      for (const key of ["username", "full_name", "university", "department", "semester", "note"] as const) {
        if (typeof patchBody[key] === "string") patch[key] = patchBody[key];
      }
      const status = body.action === "approve" || body.action === "reject" ? body.action : patchBody.status;
      if (status === "approved" || status === "rejected" || body.action) {
        patch.status = status === "rejected" ? "rejected" : "approved";
      }
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = session.id;
      const { error } = await sb.from("join_requests").update(patch).eq("id", id);
      if (error) throw error;
      if (patch.status === "approved") {
        const { error: profileError } = await sb
          .from("profiles")
          .update({
            email: req.email,
            username: patch.username || req.username,
            full_name: patch.full_name || req.full_name,
            university: patch.university || req.university,
            department: patch.department || req.department,
            semester: patch.semester || req.semester,
            approved: true,
          })
          .eq("id", req.user_id);
        if (profileError) throw profileError;
      }
      await audit(session, `request.${patch.status ?? "edit"}`, req.email, patch, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "users") {
      const target = await loadTarget(sb, id);
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (targetIsOwner(target)) {
        return NextResponse.json({ error: "The owner admin cannot be modified by user management." }, { status: 403 });
      }
      const patch: Record<string, unknown> = {};
      for (const key of ["full_name", "university", "department", "semester", "email"] as const) {
        if (typeof patchBody[key] === "string") patch[key] = text(patchBody[key], 200);
      }
      if (typeof patchBody.username === "string" && /^[a-z0-9_]{3,20}$/.test(patchBody.username)) {
        patch.username = patchBody.username;
      }
      if (typeof patchBody.approved === "boolean") patch.approved = patchBody.approved;
      if (typeof patchBody.suspended === "boolean") {
        patch.suspended = patchBody.suspended;
        const { error: banError } = await sb.auth.admin.updateUserById(id, {
          ban_duration: patchBody.suspended ? "87600h" : "none",
        });
        if (banError) throw banError;
        await cache.del(`session:${id}`);
      }
      delete patch.role;
      delete patch.is_admin;
      if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      const { error } = await sb.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      await audit(session, "user.edit", id, patch, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "events") {
      const patch: Record<string, unknown> = {};
      for (const key of ["title", "kind", "description"] as const) {
        if (typeof patchBody[key] === "string") patch[key] = patchBody[key];
      }
      for (const key of ["starts_at", "ends_at"] as const) {
        if (typeof patchBody[key] === "string") patch[key] = patchBody[key];
      }
      if (typeof patchBody.remind_minutes === "number") patch.remind_minutes = patchBody.remind_minutes;
      const { error } = await sb.from("events").update(patch).eq("id", id);
      if (error) throw error;
      await audit(session, "event.edit", id, patch, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "announcements") {
      const patch: Record<string, unknown> = {};
      for (const key of ["title", "body"] as const) {
        if (typeof patchBody[key] === "string") patch[key] = patchBody[key];
      }
      if (typeof patchBody.active === "boolean") patch.active = patchBody.active;
      const { error } = await sb.from("announcements").update(patch).eq("id", id);
      if (error) throw error;
      await audit(session, "announcement.edit", id, patch, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "materials") {
      const patch: Record<string, unknown> = {};
      for (const key of ["title", "description", "url", "storage_path"] as const) {
        if (typeof patchBody[key] === "string") patch[key] = patchBody[key];
      }
      if (typeof patchBody.kind === "string" && MATERIAL_KINDS.includes(patchBody.kind)) patch.kind = patchBody.kind;
      const { error } = await sb.from("resources").update(patch).eq("id", id);
      if (error) throw error;
      await audit(session, "material.edit", id, patch, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "settings") {
      const value = patchBody.value ?? body.value;
      if (!value || typeof value !== "object") return NextResponse.json({ error: "Settings value must be an object" }, { status: 400 });
      const { error } = await sb
        .from("site_settings")
        .upsert({ key: id, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      await audit(session, "settings.edit", id, {}, request);
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "sessions") {
      const { error } = await sb
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await audit(session, "session.revoke", id, {}, request);
      await cache.del("admin:stats");
      return NextResponse.json({ ok: true });
    }

    return invalid(params.resource);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin update failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: { resource: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin access only" }, { status: 403 });
  if (!RESOURCES.includes(params.resource as Resource)) return invalid(params.resource);
  const sb = supabaseAdmin();
  if (!sb) return needServiceKey();
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : typeof body.key === "string" ? body.key : "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    if (params.resource === "users") {
      const target = await loadTarget(sb, id);
      if (targetIsOwner(target) || id === session.id) {
        return NextResponse.json({ error: "The owner admin cannot be deleted." }, { status: 403 });
      }
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) throw error;
      await audit(session, "user.delete", id, {}, request);
      await cache.del("admin:stats");
      return NextResponse.json({ ok: true });
    }

    if (params.resource === "sessions") {
      const { error } = await sb.from("admin_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await audit(session, "session.revoke", id, {}, request);
      return NextResponse.json({ ok: true });
    }

    const table: Record<string, string> = {
      requests: "join_requests",
      events: "events",
      courses: "courses",
      materials: "resources",
      announcements: "announcements",
      settings: "site_settings",
    };
    const name = table[params.resource];
    if (!name) return invalid(params.resource);
    const column = params.resource === "settings" ? "key" : "id";
    const { error } = await sb.from(name).delete().eq(column, id);
    if (error) throw error;
    await audit(session, `${params.resource}.delete`, id, {}, request);
    await cache.del("admin:stats");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin delete failed" }, { status: 502 });
  }
}
