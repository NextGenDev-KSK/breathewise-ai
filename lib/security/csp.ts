/** Origins the browser may contact. Air-quality data is fetched client-side from Open-Meteo. */
export const OPEN_METEO_ORIGINS = [
  "https://air-quality-api.open-meteo.com",
  "https://geocoding-api.open-meteo.com",
] as const;

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
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
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
