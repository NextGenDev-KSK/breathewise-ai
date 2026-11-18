import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

function cspFor(url: string, headers?: Record<string, string>) {
  const response = proxy(new NextRequest(url, { headers }));
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  return { response, csp, nonce: /'nonce-([^']+)'/.exec(csp)?.[1] };
}

describe("proxy (per-request Content-Security-Policy)", () => {
  it("issues a fresh nonce and forwards the same nonce and policy to the page renderer", () => {
    const first = cspFor("https://breathewise.example/forecast");
    const second = cspFor("https://breathewise.example/forecast");
    expect(first.nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(second.nonce).not.toBe(first.nonce);
    expect(first.response.headers.get("x-middleware-request-x-nonce")).toBe(first.nonce);
    expect(first.response.headers.get("x-middleware-request-content-security-policy")).toBe(first.csp);
  });

  it("sends a strict policy: nonce-only scripts, no framing, no plugins", () => {
    const { csp } = cspFor("https://breathewise.example/");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("upgrades insecure requests only for pages served over HTTPS (directly or behind a proxy)", () => {
    expect(cspFor("https://breathewise.example/").csp).toContain("upgrade-insecure-requests");
    expect(cspFor("http://localhost:3000/").csp).not.toContain("upgrade-insecure-requests");
    expect(cspFor("http://internal/", { "x-forwarded-proto": "https" }).csp).toContain(
      "upgrade-insecure-requests",
    );
  });

  it("runs for pages but not for API routes, static assets or prefetches", () => {
    const [matcher] = config.matcher;
    const runsFor = (path: string) => new RegExp(`^${matcher?.source}$`).test(path);
    expect(runsFor("/")).toBe(true);
    expect(runsFor("/forecast")).toBe(true);
    expect(runsFor("/api/assistant")).toBe(false);
    expect(runsFor("/_next/static/chunk.js")).toBe(false);
    expect(runsFor("/icon.svg")).toBe(false);
    expect(matcher?.missing.map((m) => m.key)).toEqual(["next-router-prefetch", "purpose"]);
  });
});
