import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

describe("content security policy", () => {
  it("is strict in production", () => {
    const csp = buildContentSecurityPolicy("abc", { isDev: false, secure: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain(
      "connect-src 'self' https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com",
    );
  });
  it("only relaxes eval in development", () => {
    expect(buildContentSecurityPolicy("abc", { isDev: true, secure: false })).toContain("'unsafe-eval'");
  });
  it("upgrades insecure requests only for pages served over HTTPS", () => {
    expect(buildContentSecurityPolicy("abc", { isDev: false, secure: true })).toContain(
      "upgrade-insecure-requests",
    );
    expect(buildContentSecurityPolicy("abc", { isDev: false, secure: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});
