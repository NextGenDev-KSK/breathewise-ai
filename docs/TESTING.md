# Testing

All results below were produced on 2026-11-18 on Linux with Node 22.23.2 and Chromium 1255 (Playwright 1.65.1). The suites never call live services.

## Commands

```bash
npm run format:check  # Prettier
npm run lint          # ESLint with type-aware rules, --max-warnings=0
npm run lint:unused   # Knip: unused files, exports, dependencies
npm run typecheck     # tsc --noEmit (strict)
npm run test          # Vitest: unit + integration + hook + component
npm run test:coverage # with v8 coverage and enforced thresholds
npx playwright install chromium firefox   # first time only (CI also installs webkit)
npm run test:e2e      # builds, starts `next start` on :3200, runs Playwright
```

## Results (latest run)

| Suite                                                  | Result                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Prettier, ESLint (type-aware), Knip, TypeScript        | all clean; 0 lint suppressions in source                                                                       |
| Vitest                                                 | **19 files, 245 tests passed**                                                                                 |
| Coverage (all source)                                  | 92.7 % statements · 81.6 % branches · 89.9 % functions · 94.3 % lines (thresholds 90 / 78 / 85 / 90, enforced) |
| Coverage (`lib/engine`, `lib/engine/plan`)             | 98.4 % / 96.4 % statements · 99.0 % / 97.5 % lines                                                             |
| Playwright, Chromium desktop + mobile                  | **35 passed** (the mobile-only test is skipped on the desktop project)                                         |
| Playwright, Firefox                                    | **16 passed** (all functional flows)                                                                           |
| Playwright `--repeat-each=2`, all three local projects | **102 passed**, 0 flaky                                                                                        |
| Playwright, WebKit                                     | runs in CI, inside the official Playwright Docker image (`mcr.microsoft.com/playwright:v1.65.1-noble`)         |
| axe-core (WCAG 2.0/2.1/2.2 A and AA tags)              | 0 violations on all 8 pages at desktop and Pixel 7 sizes, plus the onboarding dialog                           |
| `next build`                                           | success; every route dynamic (required for the CSP nonce)                                                      |

## What is tested

### Unit (`tests/unit`)

- **Indices:** US and EU band edges, PM2.5 breakpoints, `assessConcern` priority, null handling.
- **Formatting and time:** units, "Not available" for missing data, WHO ratio, offset round-trips (+05:30, −05:00), 12/24-hour clocks, Today/Tomorrow across the year boundary, data age.
- **Outdoor window:** cleanest hour, never "safe", all-poor → avoid, exertion and sensitivity matrix, realistic hours, past hours excluded, missing ≠ clean, insufficient data, uncertainty flag, hourly PM2.5 preferred over the lagging 24-hour AQI, "Tomorrow" labels.
- **Recommendations:** full contract, priority order, household caution, equipment tailoring, ventilation polarity, CO₂e vs AQI wording, no cleaner-route claims, CPCB only for India, stale data lowers confidence, trends, dominant pollutant, demo labelling, no percentages or guarantees.
- **Daily plan:** period mapping, chronological order, cleanest period, preferred activity time, commuters only, explainability fields, adapting to poor days, demo note, no-data plans, night across midnight.
- **Emissions:** factor values, the worked example (car → metro, 100 pkm/week = 13.8 kg/week, 59.8 kg/month), zero-emission modes, negative savings, validation messages.
- **Indoor and mission:** ventilation statuses and better time, checklist personalisation, no plant or ionizer advice, CADR rule, mission days, toggles, streak, totals.
- **AI:** context privacy (no coordinates), request validation, prompt separation, grounding guard (invented numbers, guarantees, quantified benefits, negated caveats allowed), fallback intent detection for all 7 sample questions, with every answer schema-valid and guard-clean.
- **Security and storage:** rate limiter, client key, CSP, storage validation and clearing, demo fixture labelling, Gemini config sanitising.

### Integration (`tests/integration`)

- **Open-Meteo:** URL parameters, explicit domains, normalization of a **real captured Delhi response**, malformed payloads, null/negative/string values, missing variables, 429/500/network/abort/non-JSON, and the European → global fallback.
- **Geocoding:** a real captured Pune response, malformed results, HTTP and network errors, coordinate rounding.
- **`/api/assistant`:** success; 503 without a key; 415, 400 and 413; invalid model JSON or schema → 502; ungrounded claims → 502; timeout → 504; no leakage; unknown fields stripped; rate limit → 429.
- **Gemini SDK wrapper:** exact config (JSON schema, system rules, token cap), no coordinates in contents, empty, failure and timeout mapping.
- **Browser client:** validated success, client-side rejection, typed errors, network failure, abort.

### Component (React Testing Library)

Commute calculator (worked example, accessible errors, focus management), chart (text summary as accessible name, data table toggle), city combobox (debounce, keyboard selection, persistence, no-results announcement), assistant fallback mode and input validation, indoor checklist persistence, safe rendering of hostile text.

### End-to-end (Playwright, production build)

The browser clock is pinned to the fixture time and Open-Meteo and Gemini are mocked with `page.route`.

1. First visit: onboarding dialog (Escape closes) and empty state.
2. Search and select a city with the mouse and with the keyboard; labelled data, the CPCB notice and model labels appear.
3. API failure → error state → retry works; failure after success → labelled saved copy.
4. Forecast: better window for jogging ("Tomorrow"), no "safe", metric switch, daily table.
5. Daily plan generated from edited preferences.
6. Indoor checklist persists across reloads; CADR helper.
7. Commute calculator returns 13.8 and 59.8 kg; validation error.
8. Assistant fallback (no key), mocked successful Gemini response, invalid AI response → fallback with notice.
9. 7-day mission start, tick and reset (with confirmation dialog).
10. Demo mode banner on every page and zero air-API calls.
11. Settings change behaviour (12-hour time, European AQI first).
12. Skip link moves focus to `main`.
13. Mobile drawer navigation, with no horizontal page overflow.
14. axe-core audit of every page (desktop and mobile).

## Lighthouse (real measurements)

Lighthouse 12, default mobile emulation with simulated throttling, against `next start` on localhost. The home page has no saved location (first-visit state). Measured after the code-quality refactor (2026-11-18); earlier numbers in parentheses.

| Page                  | Performance  | Accessibility | Best Practices | SEO | LCP           | TBT                 | CLS |
| --------------------- | ------------ | ------------- | -------------- | --- | ------------- | ------------------- | --- |
| `/`                   | 94 (93 / 92) | 100           | 100            | 100 | 3.0 s         | 80 ms (240–320 ms)  | 0   |
| `/commute`            | 96 (91)      | 100           | 100            | 100 | 2.8 s         | 40 ms (250 ms)      | 0   |
| `/assistant` (2 runs) | 95 / 99 (91) | 100           | 100            | 100 | 2.9 s / 2.3 s | 80 / 60 ms (210 ms) | 0   |

Scores vary between runs and machines; these are the actual numbers from this machine.

## Not covered by automation

- Real Gemini output quality. The integration is verified with mocks in CI, and manually on the live site: 8 of 8 test questions were answered by `gemini-3.5-flash-lite` in 2.4–3.5 s, grounded in the live data.
- Real screen readers (NVDA, VoiceOver). The code follows ARIA patterns and passes axe, but a manual screen-reader pass is recommended.
- WebKit locally (it runs in CI).
