/**
 * Best-effort, in-memory sliding-window rate limiter.
 * On serverless platforms each instance has its own memory, so limits are per instance
 * and reset on cold starts. A shared store (e.g. Redis) would be needed for strict limits.
 */
export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Creates a sliding-window limiter: `check(key)` allows up to `limit` hits per `windowMs` and otherwise
 * says how long to wait. Memory is bounded by evicting the oldest keys beyond `maxKeys`.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 5_000 }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  return function check(key: string, now = Date.now()): RateLimitResult {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }
    recent.push(now);
    hits.delete(key); // re-insert to keep Map order roughly LRU
    hits.set(key, recent);
    if (hits.size > maxKeys) {
      const oldestKey = hits.keys().next().value;
      if (oldestKey !== undefined) hits.delete(oldestKey);
    }
    return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
  };
}

/** Client identifier for rate limiting. Uses the platform-provided forwarding header. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = headers.get("x-real-ip")?.trim();
  // Empty header values count as missing, so the first non-empty one wins.
  const key = [forwarded, real].find((value) => value !== undefined && value !== "") ?? "unknown";
  return key.slice(0, 64);
}
