import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/jwt";
import { IS_LOCAL, SUPABASE_KEY, SUPABASE_URL } from "./env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CookieToSet = { name: string; value: string; options?: any };

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth",
  "/api/auth",
  "/api/cron",
  "/api/join-requests",
  "/admin/login",
  "/api/admin/login",
];

/** Refreshes Supabase cookies and enforces the 7-day JWT + server-issued admin role. */
export async function updateSession(request: NextRequest) {
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const isAdminLogin = path === "/admin/login" || path === "/api/admin/login";
  const isAdminArea =
    !isAdminLogin &&
    (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/"));
  const isPublic =
    isAdminLogin ||
    PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const signedIn = Boolean(session);
  const isAdmin = Boolean(session?.isAdmin);

  if (!IS_LOCAL && url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  }

  if (path === "/login" && signedIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = isAdmin ? "/admin/dashboard" : "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (isAdminLogin && signedIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = isAdmin ? "/admin/dashboard" : "/dashboard";
    redirect.search = "";
    if (!isAdmin) redirect.searchParams.set("denied", "1");
    return NextResponse.redirect(redirect);
  }

  if (!signedIn && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (isAdminArea && !isAdmin) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = signedIn ? "/dashboard" : "/login";
    redirect.search = "";
    if (signedIn) redirect.searchParams.set("denied", "1");
    else redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  // Owner admin is a separate management portal, not a regular member account.
  if (isAdmin && !isAdminArea && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}
