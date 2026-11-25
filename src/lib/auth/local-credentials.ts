/**
 * Local-only credential store used when Supabase keys are absent.
 *
 * This is a real PBKDF2 hash — no plaintext password is stored — but it lives in
 * this browser, so it is a development fallback, not a multi-device database.
 * Production accounts are always created and verified by Supabase Auth.
 */

type LocalCredential = {
  email: string;
  userId: string;
  salt: string;
  hash: string;
  fullName: string;
  createdAt: string;
  verified: boolean;
};

type ResetEntry = { email: string; tokenHash: string; expires: number };

const CREDENTIALS_KEY = "studysync:local:credentials";
const RESETS_KEY = "studysync:local:password-resets";
const ITERATIONS = 150_000;

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: base64ToBytes(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

function localUser(credential: LocalCredential) {
  return {
    id: credential.userId,
    email: credential.email,
    aud: "authenticated",
    role: "authenticated",
    created_at: credential.createdAt,
    user_metadata: { full_name: credential.fullName, provider: "email", email_verified: credential.verified },
  };
}

export async function localSignUp(email: string, password: string, fullName: string) {
  const normalized = email.trim().toLowerCase();
  const credentials = readJson<LocalCredential>(CREDENTIALS_KEY);
  if (credentials.some((c) => c.email === normalized)) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const credential: LocalCredential = {
    email: normalized,
    userId: `local:${normalized}`,
    salt,
    hash: await derive(password, salt),
    fullName: fullName.trim(),
    createdAt: new Date().toISOString(),
    verified: true, // No email provider in local mode; the account is immediately usable.
  };
  writeJson(CREDENTIALS_KEY, [...credentials, credential]);
  return localUser(credential);
}

export async function localSignIn(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const credential = readJson<LocalCredential>(CREDENTIALS_KEY).find((c) => c.email === normalized);
  if (!credential) throw new Error("Email or password is incorrect.");
  const candidate = await derive(password, credential.salt);
  if (candidate !== credential.hash) throw new Error("Email or password is incorrect.");
  return localUser(credential);
}

export async function localRequestReset(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const credential = readJson<LocalCredential>(CREDENTIALS_KEY).find((c) => c.email === normalized);
  if (!credential) return null;
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(24))).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const resets = readJson<ResetEntry>(RESETS_KEY).filter((r) => r.email !== normalized);
  resets.push({ email: normalized, tokenHash: await sha256(token), expires: Date.now() + 30 * 60 * 1000 });
  writeJson(RESETS_KEY, resets);
  return token;
}

export async function localResetPassword(token: string, password: string) {
  const tokenHash = await sha256(token);
  const resets = readJson<ResetEntry>(RESETS_KEY);
  const entry = resets.find((r) => r.tokenHash === tokenHash && r.expires > Date.now());
  if (!entry) throw new Error("This reset link is invalid or has expired.");
  await localUpdatePassword(entry.email, password);
  writeJson(RESETS_KEY, resets.filter((r) => r !== entry));
}

export async function localUpdatePassword(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const credentials = readJson<LocalCredential>(CREDENTIALS_KEY);
  const index = credentials.findIndex((c) => c.email === normalized);
  if (index < 0) throw new Error("Account not found on this device.");
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  credentials[index] = { ...credentials[index], salt, hash: await derive(password, salt) };
  writeJson(CREDENTIALS_KEY, credentials);
}
