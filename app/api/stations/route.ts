import "@/lib/zodConfig";
import { NextResponse, type NextRequest } from "next/server";
import { fetchStationReport, OpenAqError, readOpenAqKey } from "@/lib/stations/openaq";
import { StationQuerySchema, type StationErrorCode, type StationReport } from "@/lib/stations/schema";
import { isSameOriginRequest } from "@/lib/security/origin";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Station data updates hourly, so a 10-minute cache keeps OpenAQ usage low without going stale. */
const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHED = 200;
const cache = new Map<string, { report: StationReport; storedAt: number }>();

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

const MESSAGES: Record<StationErrorCode, string> = {
  invalid_request: "Latitude and longitude are required.",
  forbidden_origin: "Requests must come from this site.",
  rate_limited: "Too many requests in a short time. Please wait a moment.",
  stations_not_configured: "Monitoring-station data is not configured on this server.",
  stations_timeout: "The monitoring-station service took too long to respond.",
  stations_rate_limited: "The monitoring-station service is busy. Please try again in a minute.",
  stations_unavailable: "Monitoring-station data is temporarily unavailable.",
};

const UPSTREAM_FAILURES: Record<OpenAqError["kind"], { code: StationErrorCode; status: number }> = {
  timeout: { code: "stations_timeout", status: 504 },
  "rate-limited": { code: "stations_rate_limited", status: 503 },
  unavailable: { code: "stations_unavailable", status: 502 },
};

function failure(code: StationErrorCode, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { error: code, message: MESSAGES[code] },
    { status, headers: { ...HEADERS, ...headers } },
  );
}

function cached(key: string, nowMs: number): StationReport | null {
  const hit = cache.get(key);
  return hit && nowMs - hit.storedAt < CACHE_TTL_MS ? hit.report : null;
}

function store(key: string, report: StationReport, nowMs: number): void {
  cache.set(key, { report, storedAt: nowMs });
  const oldest = cache.size > MAX_CACHED ? cache.keys().next().value : undefined;
  if (oldest !== undefined) cache.delete(oldest);
}

/**
 * Nearby monitoring stations from OpenAQ (CPCB and state boards in India) for one location. The
 * coordinates are rounded to ~1 km, used only for this lookup, and never logged or stored beyond the
 * short response cache.
 */
export async function GET(req: NextRequest) {
  if (!isSameOriginRequest(req.headers, req.url)) return failure("forbidden_origin", 403);
  const rate = limiter(clientKey(req.headers));
  if (!rate.allowed) return failure("rate_limited", 429, { "Retry-After": String(rate.retryAfterSeconds) });

  const query = StationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) return failure("invalid_request", 400);
  const key = readOpenAqKey();
  if (!key) return failure("stations_not_configured", 503);

  const { lat, lon } = query.data;
  const cacheKey = `${lat},${lon}`;
  const nowMs = Date.now();
  const hit = cached(cacheKey, nowMs);
  if (hit) return NextResponse.json(hit, { headers: HEADERS });
  try {
    const report = await fetchStationReport(lat, lon, { key, nowMs });
    store(cacheKey, report, nowMs);
    return NextResponse.json(report, { headers: HEADERS });
  } catch (error) {
    if (!(error instanceof OpenAqError)) throw error;
    const { code, status } = UPSTREAM_FAILURES[error.kind];
    return failure(code, status, error.kind === "rate-limited" ? { "Retry-After": "60" } : {});
  }
}
