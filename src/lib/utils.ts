import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "Asia/Dhaka";

/** YYYY-MM-DD for a moment in Dhaka time (matches the database's "today"). */
export function dhakaDate(d: Date | string | number = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week that contains dateStr. */
export function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(dateStr, -day);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function hoursFromSeconds(sec: number, digits = 1): number {
  return Number((sec / 3600).toFixed(digits));
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso.length <= 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "due now";
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m left`;
  if (h < 48) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Escape % and _ so user text can't act as a wildcard inside ilike. */
export function likeEscape(q: string): string {
  return q.replace(/[\\%_]/g, (m) => "\\" + m).replace(/[,()]/g, " ");
}

export function randomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  arr.forEach((n) => (out += chars[n % chars.length]));
  return out;
}

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong";
}
