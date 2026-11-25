export const SESSION_COOKIE = "b2_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — expiry only ends the session
export const OTP_TTL_SECONDS = 5 * 60;
export const TICKET_TTL_SECONDS = 60;

/**
 * Server-only owner identity. This is never used to grant admin rights by
 * itself: provisioning must verify the real Supabase Auth user and ID.
 */
export const OWNER_ADMIN_EMAIL = (
  process.env.OWNER_ADMIN_EMAIL || "shahriarniaztonmoy@gmail.com"
)
  .trim()
  .toLowerCase();

export function isOwnerEmail(email?: string | null) {
  return Boolean(email && email.trim().toLowerCase() === OWNER_ADMIN_EMAIL);
}
