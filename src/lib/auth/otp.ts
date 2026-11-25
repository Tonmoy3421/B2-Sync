import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { OTP_TTL_SECONDS } from "./config";
import { cache } from "./redis";

const otpKey = (email: string) => `otp:${email.toLowerCase()}`;
const limitKey = (email: string) => `otp:limit:${email.toLowerCase()}`;

export function normalizeEmail(email: unknown) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim().toLowerCase() : null;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function requestOtp(email: string, maxPerWindow = 3) {
  const attempts = await cache.incr(limitKey(email), 10 * 60);
  if (attempts > maxPerWindow) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await cache.set(otpKey(email), hash(code), OTP_TTL_SECONDS);
  return code;
}

export async function verifyOtp(email: string, code: string) {
  const stored = await cache.get<string>(otpKey(email));
  if (!stored) return false;
  const candidate = hash(code.trim());
  const a = Buffer.from(stored);
  const b = Buffer.from(candidate);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) await cache.del(otpKey(email));
  return ok;
}

export function newTicket() {
  return randomBytes(24).toString("hex");
}
