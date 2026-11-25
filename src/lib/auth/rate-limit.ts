import { cache } from "./redis";

/** Shared rate limiter backed by Upstash Redis (memory fallback in local mode). */
export async function allowAttempt(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const attempts = await cache.incr(`ratelimit:${key}`, windowSeconds);
  return attempts <= max;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || "local";
}
