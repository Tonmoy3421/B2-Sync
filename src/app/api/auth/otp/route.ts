import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Email-code sign-in was removed. Password and Google are the only login methods. */
export async function POST() {
  return NextResponse.json({ error: "Email-code sign-in is disabled." }, { status: 410 });
}
