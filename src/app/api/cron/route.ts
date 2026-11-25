import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional daily penalty check for people who don't use pg_cron.
 * Call it once a day with:  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !service) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("evaluate_all_commitments");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settled: data });
}
