import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await currentUser();
  if (!session) return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clean = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 120) : "");
  const username = clean(body.username).toLowerCase();
  const fullName = clean(body.full_name);
  const university = clean(body.university);
  const department = clean(body.department);
  const semester = clean(body.semester);

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: "Username must be 3-20 lowercase letters, numbers or underscores." }, { status: 400 });
  }
  if (!fullName) return NextResponse.json({ error: "Your name is required." }, { status: 400 });

  const sb = supabaseAdmin();
  if (!sb) {
    // Local mode: the browser adapter owns profiles; client inserts directly.
    return NextResponse.json({ ok: true, approved: true, local: true });
  }

  const approved = session.isAdmin;
  const { error: profileError } = await sb.from("profiles").upsert(
    {
      id: session.id,
      email: session.email,
      username,
      full_name: fullName,
      university,
      department,
      semester,
      approved,
      auth_provider: session.provider || "email",
      email_verified: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  const { error: requestError } = await sb.from("join_requests").upsert(
    {
      user_id: session.id,
      email: session.email,
      username,
      full_name: fullName,
      university,
      department,
      semester,
      status: approved ? "approved" : "pending",
      reviewed_at: approved ? new Date().toISOString() : null,
      reviewed_by: approved ? session.id : null,
    },
    { onConflict: "user_id" },
  );
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 400 });

  return NextResponse.json({ ok: true, approved });
}
