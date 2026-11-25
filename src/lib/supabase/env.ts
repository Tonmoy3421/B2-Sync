// Shared Supabase configuration. Supports both the old "anon key" name and the
// new "publishable key" name Supabase now shows in the dashboard.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// No credentials (or only the build-time placeholders) -> run in self-contained
// local mode backed by the browser's localStorage. The whole app stays usable.
export const IS_LOCAL =
  !SUPABASE_URL ||
  !SUPABASE_KEY ||
  SUPABASE_URL.includes("placeholder") ||
  SUPABASE_KEY.includes("placeholder");
