# Security and privacy

Audit performed on 2026-11-17 against the production build (`next build` + `next start`). "Evidence" lists the test or command that verifies each control.

## Threat model in one paragraph

BreatheWise has no accounts, no database and no stored personal data on the server. The assets worth protecting are the **Gemini API key** (cost and abuse), the **integrity of advice** (no invented numbers or unsafe claims), and **users' location and household preferences** (privacy). The attack surface is one API route (`/api/assistant`), the rendered pages, and the data the browser stores locally.

## Checklist (OWASP-oriented)

| # | Risk | Control | Evidence |
|---|---|---|---|
| 1 | Secret exposure | `GEMINI_API_KEY`/`GEMINI_MODEL` are read only in `lib/ai/gemini.ts`, which imports `server-only` (a client import breaks the build). There is no `NEXT_PUBLIC_` usage. `.env*` is git-ignored except `.env.example`. | `grep` of `.next/static` for `GEMINI_API_KEY`, `GoogleGenAI` and the system prompt: **0 matches**. `GET /api/assistant` returns only `{configured: boolean}` (integration test). |
| 2 | Improper env usage | The model name is restricted to `[a-z0-9.-]{2,61}`, otherwise the default is used. | Unit test "defaults and sanitises the model name". |
| 3 | XSS / unsafe HTML | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in source; ESLint `react/no-danger: error`. All AI and API text renders as React text nodes. | `grep` (only match is a comment); component test renders `<img onerror>` as text. |
| 4 | Script injection | A strict CSP with a per-request nonce plus `strict-dynamic`, no `unsafe-eval` in production, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and `connect-src` limited to self and the two Open-Meteo hosts. Zod's eval probe is disabled (`jitless`), so the console shows 0 CSP issues. | `curl -I` shows the header; CSP unit tests; Chrome DevTools Issues panel: none; Lighthouse Best Practices 100. |
| 5 | Input validation | Zod on every boundary: Open-Meteo responses, geocoding results, localStorage reads, API request, model output and client-side re-validation. Question limited to 600 characters, history to 6 short turns, numbers bounded 0–100 000. | `tests/unit/ai.test.ts` request-validation cases; route tests. |
| 6 | Oversized requests | A 16 KB limit enforced on the actual streamed bytes (not only on `Content-Length`) returns 413. Non-JSON returns 415. | Route test; `curl` with a 30 KB body → **413**; `text/plain` → **415**. |
| 7 | API abuse | Sliding-window limiter at 10 requests/min per client IP returns 429 with `Retry-After`. Memory is bounded at 5 000 keys. Gemini calls time out after 20 s and output is capped at 2 048 tokens. | Route test (11th request → 429); rate-limit unit tests. **Limitation:** in-memory and per serverless instance; strict global limits need a shared store. |
| 8 | Error-information leakage | Fixed, generic error messages per error code. Upstream errors are never forwarded, there are no stack traces, and the validation error never echoes input. Server logs record only the error kind or issue count. | Route test asserts that `stack`, the key and `Error:` are absent. |
| 9 | Prompt injection | User text is delimited and declared untrusted. System rules forbid changing format or revealing instructions. Output must pass the JSON schema and the grounding guard, otherwise it is discarded. The model has no tools and cannot execute anything. | Prompt test; guard tests (invented µg/m³ or AQI values, "completely safe", "guarantee", "reduce … by 60%" are rejected). |
| 10 | Client trust of AI output | The client re-validates the API envelope with Zod before rendering; failure leads to the rule engine with a visible notice. | e2e "falls back to rules when the AI response fails validation"; `askGemini` tests. |
| 11 | Unsafe URL handling | All query strings are built with `URLSearchParams`; search queries are stripped of control characters and capped at 80 characters. External links use `rel="noopener noreferrer"`. | Geocoding tests (encoding, sanitising). |
| 12 | Unnecessary personal data | No account, no analytics, no cookies. Geolocation is requested only on click and rounded to about 1 km. Coordinates go only to Open-Meteo from the browser, **never to the BreatheWise server or Gemini**. Household questions are yes/no circumstances, not diagnoses. | Context test "never includes coordinates"; route test strips unknown fields. |
| 13 | Browser storage | localStorage holds settings, preferences, place, the last snapshot, checklist and mission progress only. No secrets or conversation history (conversations live in memory only). Values are validated on read. A **Clear all local data** button is provided. | Storage tests (corrupt or tampered data → defaults; clears only BreatheWise keys). |
| 14 | Clickjacking and transport | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS (2 years), `upgrade-insecure-requests`, `Cross-Origin-Opener-Policy: same-origin`. | Response headers. |
| 15 | Permissions | `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()`. | Response headers. |
| 16 | Dependencies | 7 runtime dependencies. `npm audit --omit=dev`: **0 vulnerabilities**. | `npm audit --omit=dev`. |
| 17 | Caching of AI responses | `Cache-Control: no-store` on every `/api/assistant` response. | `curl -D -`; route test. |
| 18 | Unsupported methods | Only `GET` and `POST` are exported; others return 405. | `curl -X PUT` → **405**. |

## Accepted risk: development-only advisory

`npm audit` (including dev dependencies) reports a high-severity ReDoS advisory in **picomatch ≤ 4.0.7**, pulled in by ESLint, Vite and Vitest tooling. No patched version has been published (latest is 4.0.7 as of 2026-11-17). It affects glob-pattern parsing in local build and test tools, which only ever receive this repository's own patterns, and it is **not included in the deployed application** (`npm audit --omit=dev` reports 0). Revisit when picomatch publishes a fix.

## Logging policy

The server never logs prompts, locations, preferences, IP addresses or keys. It logs only `assistant: upstream model error <kind>` and `assistant: rejected model output <n> issue(s)`.

## Reporting

Please report security issues privately to the repository owner rather than opening a public issue.
