import { createHmac, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value: string): Buffer {
  const clean = value.toUpperCase().replace(/[\s=-]/g, "");
  if (!clean || [...clean].some((c) => !BASE32.includes(c))) throw new Error("Invalid TOTP secret");
  let bits = "";
  for (const char of clean) bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpAt(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(value % 1_000_000).padStart(6, "0");
}

/** Optional admin 2FA. ADMIN_TOTP_SECRET is base32; unset means 2FA is off. */
export function verifyTotp(code: string, secret = process.env.ADMIN_TOTP_SECRET): boolean {
  if (!secret) return true;
  if (!/^\d{6}$/.test(code)) return false;
  let key: Buffer;
  try {
    key = decodeBase32(secret);
  } catch {
    return false;
  }
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let delta = -1; delta <= 1; delta += 1) {
    const expected = totpAt(key, step + delta);
    const a = Buffer.from(code);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function totpRequired() {
  return Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
}
