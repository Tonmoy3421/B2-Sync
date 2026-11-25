/** Shared validation for password-based accounts. */

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Returns a user-facing error, or null when the password is strong enough. */
export function validatePassword(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Keep your password under 128 characters.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/\d/.test(password)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one symbol (for example ! or @).";
  return null;
}

export function passwordChecklist(password: string) {
  return {
    length: password.length >= 10 && password.length <= 128,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}
