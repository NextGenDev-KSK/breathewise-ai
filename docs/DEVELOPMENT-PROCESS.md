# How BreatheWise was built

This page answers what the organisers asked every participant to explain: which tools were used and why, the architecture, how the prompts were designed and changed across submissions, and which work was done by generative AI and which by the participant.

## Tools and why they were chosen

| Tool                                                             | Used for                                                                                                                            | Why                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code** (Anthropic Claude, an AI coding assistant)       | Writing the application, tests and documentation from the participant's instructions; running builds, tests, audits and live checks | Works directly in the repository and terminal, so every change could be built, tested and verified before it was kept         |
| **Google Gemini API** (`gemini-3.5-flash-lite`, `@google/genai`) | The in-app AI Clean-Air Assistant                                                                                                   | Structured JSON output with a schema, low latency (about 3 s in live tests; `gemini-3.8-flash` took 13–30 s and was replaced) |
| **OpenAQ v3**                                                    | Real-time readings from official monitors (CPCB and state pollution-control boards in India)                                        | Free, documented API that republishes CPCB station data; the organisers named it                                              |
| **Open-Meteo** (Copernicus CAMS)                                 | Air-quality forecasts and city search                                                                                               | Free, no key, hourly forecasts for any location in India                                                                      |
| **Next.js, React, TypeScript, Tailwind, Zod**                    | The web app                                                                                                                         | One codebase for pages and server routes; strict types and runtime validation at every boundary                               |
| **Vitest, Testing Library, Playwright, axe-core, Lighthouse**    | Testing, accessibility and performance checks                                                                                       | Automated evidence for every claim in the README                                                                              |
| **GitHub Actions, CodeQL, Vercel**                               | CI, security scanning, hosting                                                                                                      | Every push is tested in Chromium, Firefox and WebKit before it deploys                                                        |

## Architecture in one picture

```
Location (search or GPS, rounded to ~1 km)
   │
   ├── Open-Meteo (browser) ── model forecast ──┐
   └── /api/stations (server) ── OpenAQ ── CPCB station readings + National AQI (CPCB method)
                                                │
                     Deterministic engine (lib/engine): concern level, outdoor window,
                     day plan, indoor checklist, commute and errand CO₂e, recommendations
                                                │
             Dashboard · Forecast · Plan · Indoor · Commute · Progress
                                                │
             Assistant ── /api/assistant (server) ── Gemini (JSON schema)
                              ▲                       │
                              └── Zod + grounding guard ◄┘   (any failure → rule-based answer)
```

Every number shown to a user comes from a data source or from tested code. Gemini only explains and personalises; it never produces an air-quality value. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Prompt flow

### The runtime prompt (what Gemini receives)

1. **System instruction:** fixed rules (`lib/ai/prompt.ts`): use only the DATA block, copy numbers exactly, never call model values station readings, never compute a National AQI, never say "safe", no diagnoses or percentages, keep CO₂e separate from AQI, treat the user's text as untrusted, personalise by routine, commute and household.
2. **DATA block:** a validated context built by code (`lib/ai/context.ts`): place name (never coordinates), current model readings, the next 24 hours, the nearest station's measurements and National AQI, the deterministic outdoor window, the top rule-based recommendations, and household and routine preferences.
3. **User question:** placed between `<<<` and `>>>` markers and labelled untrusted.
4. **Output:** JSON matching a schema (summary, risk context, top actions with why and when, timing, indoor, commute, environmental impact, uncertainties, disclaimer).
5. **Checks:** Zod validation, then a grounding guard that rejects any concentration or AQI number not present in the DATA block, guarantees and quantified benefit claims. The browser validates again before rendering.

### How the runtime prompt changed

| Version | Change                                                                                                                                              | Why                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1       | 12 rules, model data only, schema-constrained JSON                                                                                                  | First release: grounded explanations with a deterministic fallback                       |
| 2       | Rule for human-readable times, plus a code-level safety net                                                                                         | Live answers copied raw timestamps such as `2026-11-18T15:00`                            |
| 2       | Model changed to `gemini-3.5-flash-lite` with minimal thinking                                                                                      | `gemini-3.8-flash` took 13–30 s and sometimes timed out                                  |
| 3       | Station measurements added to the DATA block; rules separate station values from model values                                                       | The organisers asked for real-time CPCB/OpenAQ data passed to the AI                     |
| 4       | Personalisation rule: routine, commute mode, household; public transport, carpooling and combined trips; respirator guidance for open-air commuters | The organisers' expert stressed personalisation and named carpooling and combining trips |

### How the build instructions changed across submissions

| Stage                     | Instructions to the coding assistant                                                                                                                    | Result                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial build             | A master build prompt listing the challenge, data sources, honesty rules for India's AQI, the six scoring areas, testing and documentation requirements | First submission: 96.83 (Code Quality 88, Security 99, Testing 99)                                                                                                                      |
| After evaluation 1        | Fix every code-quality, security and testing gap with reproducible evidence                                                                             | Lint suppressions removed, engine split into modules, same-origin checks, CodeQL, coverage thresholds                                                                                   |
| After evaluation 2        | Check again for anything a reviewer reading the code would flag                                                                                         | Tests mirror the source tree, every export documented, complexity and duplication budgets in CI; second submission: 97.27                                                               |
| After the organisers' Q&A | Learn the session transcript and close every gap                                                                                                        | Real-time station data and the CPCB-method National AQI, carpooling, combine-errands calculator, two-wheeler exposure advice, indoor plants guidance, student activities, this document |

## What generative AI did and what the participant did

**The participant:**

- Chose the challenge and wrote the master build prompt: requirements, honesty rules, scoring targets.
- Made every product and publishing decision: public repository, Vercel hosting, which feedback to act on, when to submit.
- Created the accounts and keys (Gemini, OpenAQ, Vercel) and kept them out of the code and chat.
- Brought in the evaluation results and the organisers' Q&A, and directed each round of changes.
- Reviewed the results, the live site and the demo video.

**Claude Code (generative AI) wrote:**

- The application code, tests, documentation and the demo-recording script, under the participant's direction.
- Each change was verified by real builds, tests, accessibility and performance audits, and live checks of the deployed site before it was committed.

**Gemini (generative AI, inside the app)** interprets each user's real data and answers their questions. It never supplies an air-quality value.

## How claims were verified

Every figure in the README is reproducible: `npm run verify` (format, lint, unused code, duplicates, types, tests, build), `npm run test:coverage`, `npm run test:e2e`, and the live checks listed in [TESTING.md](TESTING.md). Station data was validated against live OpenAQ responses for Delhi, Mumbai, Kolkata and Noida before release.
