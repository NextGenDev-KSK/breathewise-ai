# Architecture

## Goals that shaped it

1. **Deterministic first.** Every number and every decision comes from pure, tested functions in `lib/engine`. AI only rephrases and explains.
2. **No server-side personal data.** Air data is fetched by the browser; the server only handles the optional AI call, and receives no coordinates.
3. **Graceful degradation.** Live → saved copy → error with retry; Gemini → rule engine; real data → clearly labelled sample data.
4. **Small surface.** Seven runtime dependencies, no database, no auth.

## Layers

| Layer | Path | Responsibility |
|---|---|---|
| Routes | `app/*/page.tsx` | Server components: page heading and description, then one client feature component. |
| API | `app/api/assistant/route.ts` | `GET` reports whether AI is configured (boolean only). `POST` validates, rate-limits, calls Gemini, validates output, and returns typed errors. |
| Proxy | `proxy.ts`, `lib/security/csp.ts` | Generates a per-request nonce and a strict CSP. Pages render dynamically so Next.js can stamp the nonce. |
| App state | `components/app/AppProvider.tsx` | Settings, preferences, place, air state, `refresh()`, `nowMs`, `formatTime`. Fetches with `AbortController` on every place change; uses the cache; falls back to the saved snapshot. |
| Data | `lib/air/*` | URL building, Zod validation and normalization of Open-Meteo responses, index bands, pollutant metadata, geocoding, chart series and day summaries, in-memory TTL cache. |
| Engine | `lib/engine/*` | `analysis` (concern, dominant pollutant, trend, staleness), `windows` (better outdoor window), `recommendations` (10 rules → prioritised `Recommendation[]`), `dailyPlan` (4 periods), `indoor` (ventilation, checklist, CADR), `emissions` (CO₂e), `mission` (7-day tracker). |
| AI | `lib/ai/*` | Schemas (request, response, envelopes), context builder, prompt, grounding guard, Gemini wrapper (`server-only`), browser client, rule-based fallback. |
| UI | `components/*` | Feature modules plus a small UI kit (Button, Card, Badge, LevelBadge, Dialog, Toast, States). |

## Key contracts

- `AirQualitySnapshot` (`types/air.ts`): place, timezone and offset, current readings (nullable), hourly points with absolute `epochMs` and local `time`, model metadata, `origin: live | cache | demo`.
- `Recommendation` (`types/recommendation.ts`): `id, category, title, description, reason, evidence[], recommendedTime, impactType, confidence, source, limitations[], caution?, priority`.
- `AssistantResponse` (`lib/ai/schema.ts`): the 9-field structured answer shared by Gemini and the rule engine.

## Time handling

Open-Meteo returns local wall-clock strings plus `utc_offset_seconds`. `lib/time.ts` converts them to absolute instants for comparison and keeps the wall-clock strings for display. All logic is independent of the browser's own time zone: a user in London looking at Delhi sees Delhi times. "Now" is injected (`nowMs`) into every engine function, which makes the engine deterministic and testable.

## Rendering and performance

- Pages are server components; interactive modules are client components.
- The chart is a hand-written SVG component with no chart library.
- City search is debounced (300 ms) and aborts outdated requests; air requests abort when the place changes.
- Air responses are cached for 10 minutes in memory, and the last good snapshot is kept in localStorage for offline display.
- There is no background polling. The clock refreshes every 5 minutes only to keep time labels and windows current.
- Fonts are self-hosted by `next/font` (no third-party requests at runtime).

## Error handling

| Failure | Behaviour |
|---|---|
| Open-Meteo network, HTTP or 429 error | Typed `AirQualityError` → saved copy (labelled) if one exists for that place, otherwise an error state with **Try again** |
| Malformed or partial API data | Zod rejects structure; individual bad values become `null`, never 0 |
| European model has no data for a point | Automatic retry with the global model |
| Geolocation denied or unavailable | Toast with a suggestion to search |
| Gemini not configured, timeout, upstream error, invalid JSON, schema failure, ungrounded claims | Typed API error → client uses the rule engine and explains why |
| Unexpected render error | `app/error.tsx` boundary with retry |
