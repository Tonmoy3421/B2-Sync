import { supabaseAdmin } from "@/lib/supabase/admin";
import { IS_LOCAL } from "@/lib/supabase/env";

/** Called after every successful sign-in. Never deletes user data. */
export async function markSignIn(userId: string, email: string) {
  if (IS_LOCAL || !userId || !email) return;
  const sb = supabaseAdmin();
  if (!sb) return;
  const now = new Date().toISOString();
  const { data: existing } = await sb
    .from("signin_history")
    .select("sign_in_count")
    .eq("user_id", userId)
    .maybeSingle<{ sign_in_count: number }>();
  if (existing) {
    await sb
      .from("signin_history")
      .update({ last_sign_in_at: now, sign_in_count: (existing.sign_in_count ?? 0) + 1 })
      .eq("user_id", userId);
  } else {
    await sb.from("signin_history").upsert(
      { user_id: userId, email: email.toLowerCase(), first_sign_in_at: now, last_sign_in_at: now, sign_in_count: 1 },
      { onConflict: "user_id" }
    );
  }
}

/** True when this email/user has ever signed in on this web app, or has a profile. */
export async function hasSignedInBefore(userId: string, email: string): Promise<boolean> {
  if (IS_LOCAL) return false;
  const sb = supabaseAdmin();
  if (!sb) return false;
  const [history, profile] = await Promise.all([
    sb.from("signin_history").select("sign_in_count").eq("email", email.toLowerCase()).maybeSingle<{ sign_in_count: number }>(),
    sb.from("profiles").select("id").eq("id", userId).maybeSingle(),
  ]);
  // count === 1 is the first verification/OAuth signup, not a returning visit.
  return Boolean((history.data?.sign_in_count ?? 0) > 1 || profile.data);
}
