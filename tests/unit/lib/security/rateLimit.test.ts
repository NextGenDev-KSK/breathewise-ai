import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

describe("rate limiter", () => {
  it("allows up to the limit per window, then blocks with Retry-After", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect([0, 1, 2].map((i) => check("a", 1000 + i).allowed)).toEqual([true, true, true]);
    const blocked = check("a", 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect(check("b", 2000).allowed).toBe(true);
    expect(check("a", 61_001).allowed).toBe(true);
  });
  it("bounds memory", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    check("a");
    check("b");
    check("c");
    expect(check("a").allowed).toBe(true); // "a" was evicted
  });
  it("derives a bounded client key", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers())).toBe("unknown");
    expect(clientKey(new Headers({ "x-forwarded-for": "x".repeat(500) }))).toHaveLength(64);
  });
});
