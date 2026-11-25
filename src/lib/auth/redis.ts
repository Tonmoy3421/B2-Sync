import { Redis } from "@upstash/redis";

/**
 * Upstash Redis when configured; an in-process store for local development so
 * login still works without any account. Used for OTPs, one-time tickets,
 * sessions and short-lived query caches.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
}

const memory = new Map<string, { value: unknown; expires: number }>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of memory) if (v.expires <= now) memory.delete(k);
}

const memoryStore: CacheStore = {
  async get<T>(key: string) {
    sweep();
    const hit = memory.get(key);
    return hit ? (hit.value as T) : null;
  },
  async set(key, value, ttlSeconds = 3600) {
    memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  },
  async del(key) {
    memory.delete(key);
  },
  async incr(key, ttlSeconds = 3600) {
    sweep();
    const current = Number(memory.get(key)?.value ?? 0) + 1;
    memory.set(key, { value: current, expires: memory.get(key)?.expires ?? Date.now() + ttlSeconds * 1000 });
    return current;
  },
};

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

let client: CacheStore = memoryStore;
if (url && token) {
  const upstash = new Redis({ url, token });
  client = {
    async get<T>(key: string) {
      const value = await upstash.get(key);
      return (value ?? null) as T | null;
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await upstash.set(key, value, { ex: ttlSeconds });
      else await upstash.set(key, value);
    },
    async del(key) {
      await upstash.del(key);
    },
    async incr(key, ttlSeconds) {
      const n = await upstash.incr(key);
      if (n === 1 && ttlSeconds) await upstash.expire(key, ttlSeconds);
      return n;
    },
  };
}

export const cache: CacheStore = client;
export const usingUpstash = Boolean(url && token);

/** Cache-aside helper for hot admin reads. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  await cache.set(key, value, ttlSeconds);
  return value;
}
