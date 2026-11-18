import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/security/origin";

describe("isSameOriginRequest", () => {
  const url = "https://breathewise.example/api/assistant";
  it("trusts the browser's Sec-Fetch-Site header", () => {
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-origin" }), url)).toBe(true);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "none" }), url)).toBe(true);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "cross-site" }), url)).toBe(false);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-site" }), url)).toBe(false);
  });
  it("falls back to comparing Origin with the request host", () => {
    expect(isSameOriginRequest(new Headers({ origin: "https://breathewise.example" }), url)).toBe(true);
    expect(isSameOriginRequest(new Headers({ origin: "https://evil.example" }), url)).toBe(false);
    expect(isSameOriginRequest(new Headers({ origin: "::bad::" }), url)).toBe(false);
  });
  it("allows non-browser clients that send neither header", () => {
    expect(isSameOriginRequest(new Headers(), url)).toBe(true);
  });
});
