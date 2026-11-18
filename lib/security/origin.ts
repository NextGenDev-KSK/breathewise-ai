/**
 * Rejects cross-site browser requests to our API. Browsers send Sec-Fetch-Site on every
 * request; when it is absent (older browsers, non-browser clients), the Origin header is
 * compared with the request's own host instead. Requests with neither header (curl, server
 * to server) are allowed: they cannot ride on a visitor's browser, and rate limiting still applies.
 */
export function isSameOriginRequest(headers: Headers, requestUrl: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";

  const origin = headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(requestUrl).host;
  } catch {
    return false; // malformed Origin header
  }
}
