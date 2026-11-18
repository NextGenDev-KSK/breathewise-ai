/** Origins the browser may contact. Air-quality data is fetched client-side from Open-Meteo. */
const OPEN_METEO_ORIGINS = [
  "https://air-quality-api.open-meteo.com",
  "https://geocoding-api.open-meteo.com",
] as const;

interface CspOptions {
  isDev: boolean;
  /** True when the page was requested over HTTPS (directly or behind a TLS-terminating proxy). */
  secure: boolean;
}

/**
 * Strict Content-Security-Policy for one page response: nonce-based scripts with `strict-dynamic`,
 * connections only to this origin and Open-Meteo, no framing or plugins. `upgrade-insecure-requests`
 * is added only over HTTPS; `unsafe-eval` and websockets only in development.
 */
export function buildContentSecurityPolicy(nonce: string, { isDev, secure }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (chart bar heights, progress widths) need 'unsafe-inline' for styles only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${OPEN_METEO_ORIGINS.join(" ")}${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ];
  // Only meaningful over HTTPS. WebKit (Safari) also applies it to http://localhost, where it would
  // rewrite the page's own scripts to https:// and stop them loading.
  if (secure) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
