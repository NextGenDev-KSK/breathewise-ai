import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { clearAllStored, readStored, writeStored, STORAGE_KEYS } from "@/lib/storage";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/types/preferences";
import { SnapshotSchema } from "@/lib/air/snapshotSchema";
import { buildDemoSnapshot } from "@/lib/demo/fixture";
import { readGeminiConfig, DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";

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

describe("content security policy", () => {
  it("is strict in production", () => {
    const csp = buildContentSecurityPolicy("abc", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com");
  });
  it("only relaxes eval in development", () => {
    expect(buildContentSecurityPolicy("abc", true)).toContain("'unsafe-eval'");
  });
});

describe("local storage", () => {
  it("round-trips validated values", () => {
    writeStored(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, demoMode: true });
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS).demoMode).toBe(true);
  });
  it("falls back on corrupt JSON or tampered data", () => {
    localStorage.setItem("breathewise:v1:settings", "{not json");
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem("breathewise:v1:settings", JSON.stringify({ aqiStandard: "<script>" }));
    expect(readStored(STORAGE_KEYS.settings, SettingsSchema, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
  it("clears only BreatheWise keys", () => {
    localStorage.setItem("other-app", "keep");
    writeStored(STORAGE_KEYS.mission, { a: 1 });
    clearAllStored();
    expect(localStorage.getItem("other-app")).toBe("keep");
    expect(readStored(STORAGE_KEYS.mission, z.unknown(), null)).toBeNull();
  });
  it("validates a demo snapshot with the persisted-snapshot schema", () => {
    expect(SnapshotSchema.safeParse(buildDemoSnapshot(Date.UTC(2026, 10, 17, 6))).success).toBe(true);
  });
});

describe("demo fixture", () => {
  it("is explicitly labelled as sample data", () => {
    const s = buildDemoSnapshot(Date.UTC(2026, 10, 17, 6));
    expect(s.origin).toBe("demo");
    expect(s.model.id).toBe("sample");
    expect(s.place.name).toBe("Sample City");
    expect(s.hourly).toHaveLength(72);
    expect(s.current.epochMs).toBeLessThanOrEqual(Date.UTC(2026, 10, 17, 6));
  });
});

describe("Gemini configuration", () => {
  it("is absent without a key", () => {
    expect(readGeminiConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(readGeminiConfig({ GEMINI_API_KEY: "  " } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
  it("defaults and sanitises the model name", () => {
    expect(readGeminiConfig({ GEMINI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)?.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(readGeminiConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.6-flash" } as unknown as NodeJS.ProcessEnv)?.model).toBe("gemini-3.6-flash");
    expect(readGeminiConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "../../evil?x=1" } as unknown as NodeJS.ProcessEnv)?.model).toBe(DEFAULT_GEMINI_MODEL);
  });
});
