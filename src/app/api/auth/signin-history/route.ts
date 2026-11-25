import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/current-user";
import { hasSignedInBefore } from "@/lib/auth/signin-history";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ returning: false });
  return NextResponse.json({ returning: await hasSignedInBefore(user.id, user.email) });
}
