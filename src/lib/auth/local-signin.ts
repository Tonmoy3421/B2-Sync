const KEY = "studysync:signin:";

/** Device-only marker used by the local fallback (no Supabase account store). */
export function markLocalSignIn(email: string) {
  if (typeof window === "undefined" || !email) return;
  try {
    window.localStorage.setItem(KEY + email.trim().toLowerCase(), "1");
  } catch {
    /* storage disabled */
  }
}

export function hasLocalSignIn(email: string) {
  if (typeof window === "undefined" || !email) return false;
  try {
    return window.localStorage.getItem(KEY + email.trim().toLowerCase()) === "1";
  } catch {
    return false;
  }
}
