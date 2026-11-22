import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as OpenAqModule from "@/lib/stations/openaq";
import type { StationReport } from "@/lib/stations/schema";

const fetchReport = vi.fn<typeof OpenAqModule.fetchStationReport>();

vi.mock("@/lib/stations/openaq", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenAqModule>();
  return { ...actual, fetchStationReport: (...args: Parameters<typeof fetchReport>) => fetchReport(...args) };
});

const { GET } = await import("@/app/api/stations/route");
const { OpenAqError } = await import("@/lib/stations/openaq");

const REPORT: StationReport = {
  source: "OpenAQ",
  fetchedAt: "2026-11-22T04:00:00.000Z",
  stations: [],
  nearest: null,
};

let ip = 0;
/** Each request comes from a new client unless `client` is given, so rate limits do not interfere. */
function request(query: string, headers: Record<string, string> = {}, client = `10.1.0.${++ip}`) {
  return new NextRequest(`http://localhost/api/stations${query}`, {
    headers: { "x-forwarded-for": client, ...headers },
  });
}

// Each test uses unique coordinates so the route's response cache never leaks between tests.
let coord = 0;
const place = () => `?lat=${(10 + ++coord / 10).toFixed(4)}&lon=77.2090`;

beforeEach(() => {
  fetchReport.mockReset();
  fetchReport.mockResolvedValue(REPORT);
  vi.stubEnv("OPENAQ_API_KEY", "test-key-not-real");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/stations", () => {
  it("returns the report for coordinates rounded to ~1 km", async () => {
    const res = await GET(request("?lat=28.61394&lon=77.20902"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(REPORT);
    expect(fetchReport).toHaveBeenCalledWith(
      28.61,
      77.21,
      expect.objectContaining({ key: "test-key-not-real" }),
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves repeat lookups for the same area from its cache", async () => {
    const query = place();
    await GET(request(query));
    await GET(request(query));
    expect(fetchReport).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-site browser requests", async () => {
    const res = await GET(request(place(), { "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(fetchReport).not.toHaveBeenCalled();
  });

  it.each(["", "?lat=28.6", "?lat=abc&lon=77", "?lat=91&lon=77", "?lat=28&lon=181"])(
    "rejects invalid coordinates: %s",
    async (query) => {
      const res = await GET(request(query));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "invalid_request" });
    },
  );

  it("says station data is not configured when there is no key, without calling OpenAQ", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "");
    const res = await GET(request(place()));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "stations_not_configured" });
    expect(fetchReport).not.toHaveBeenCalled();
  });

  it("limits each client to 20 requests a minute", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await GET(request(place(), {}, "10.9.9.9"))).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it.each([
    ["timeout", 504, "stations_timeout"],
    ["rate-limited", 503, "stations_rate_limited"],
    ["unavailable", 502, "stations_unavailable"],
  ] as const)("maps an OpenAQ %s to %s without leaking details", async (kind, status, code) => {
    fetchReport.mockRejectedValue(new OpenAqError(kind));
    const res = await GET(request(place()));
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.error).toBe(code);
    expect(JSON.stringify(body)).not.toMatch(/test-key|OpenAQ (timeout|rate|unavailable)/);
    if (kind === "rate-limited") expect(res.headers.get("retry-after")).toBe("60");
  });

  it("does not cache failures", async () => {
    const query = place();
    fetchReport.mockRejectedValueOnce(new OpenAqError("unavailable"));
    expect((await GET(request(query))).status).toBe(502);
    expect((await GET(request(query))).status).toBe(200);
  });

  it("lets unexpected errors surface instead of hiding them", async () => {
    fetchReport.mockRejectedValue(new Error("bug"));
    await expect(GET(request(place()))).rejects.toThrow("bug");
  });
});
