# How I built BreatheWise

This page explains how I built BreatheWise: the research behind the data sources, the tools I chose and why, the architecture, how I designed and refined the prompts across submissions, how I tested it, and how I used generative AI along the way.

## Tools and why they were chosen

| Tool                                                             | Used for                                                                                                                    | Why                                                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code** (Anthropic Claude, an AI coding assistant)       | Implementing the application, tests and documentation from my specifications; running builds, tests, audits and live checks | Works directly in the repository and terminal, so every change could be built, tested and verified before it was kept         |
| **Google Gemini API** (`gemini-3.5-flash-lite`, `@google/genai`) | The in-app AI Clean-Air Assistant                                                                                           | Structured JSON output with a schema, low latency (about 3 s in live tests; `gemini-3.8-flash` took 13–30 s and was replaced) |
| **OpenAQ v3**                                                    | Real-time readings from official monitors (CPCB and state pollution-control boards in India)                                | Free, documented API that republishes CPCB station data; the organisers named it                                              |
| **Open-Meteo** (Copernicus CAMS)                                 | Air-quality forecasts and city search                                                                                       | Free, no key, hourly forecasts for any location in India                                                                      |
| **Next.js, React, TypeScript, Tailwind, Zod**                    | The web app                                                                                                                 | One codebase for pages and server routes; strict types and runtime validation at every boundary                               |
| **Vitest, Testing Library, Playwright, axe-core, Lighthouse**    | Testing, accessibility and performance checks                                                                               | Automated evidence for every claim in the README                                                                              |
| **GitHub Actions, CodeQL, Vercel**                               | CI, security scanning, hosting                                                                                              | Every push is tested in Chromium, Firefox and WebKit before it deploys                                                        |

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

### How my build prompts evolved across submissions

| Stage                         | What I did                                                                                                                                                                                                                                                                                                                                         | Result                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Research and first build      | Studied the problem and the data available for Indian cities, then wrote a detailed master prompt: the users, the three challenge areas, the data rules (never invent AQI values, never label model data as India's CPCB AQI, deterministic fallback, explainable recommendations), the six scoring areas, and testing and documentation standards | First submission: 96.83                                    |
| After evaluation 1            | Analysed the score breakdown (Code Quality 88, Security 99, Testing 99) and set precise priorities: remove every lint suppression, split the engine into modules, enforce same-origin requests on the AI route, add CodeQL and coverage thresholds                                                                                                 | All gaps closed with reproducible evidence                 |
| After evaluation 2            | Reviewed the code the way an evaluator reads it and specified the next standard: tests that mirror the source tree, a doc comment on every export, complexity and duplication limits enforced in CI                                                                                                                                                | Second submission: 97.27                                   |
| After the organisers' session | Studied the expert's guidance question by question and mapped each expectation to a feature: real-time CPCB station data through OpenAQ with the official National AQI method, carpooling, combined errands, two-wheeler and student advice, honest indoor-plants guidance                                                                         | All expectations implemented and verified on the live site |

## My work

**Research.** I compared the air-quality sources available for India (CPCB's portal, OpenAQ and Open-Meteo's Copernicus forecasts) and chose a combination: OpenAQ for official station readings, because it republishes CPCB and state-board data through a documented API, and Open-Meteo for forecasts, which station networks do not provide. I studied how CPCB calculates the National AQI (24-hour averages with at least 16 hours of data, 8-hour averages for ozone and CO, at least three pollutants including PM2.5 or PM10) and required the app to follow that method exactly. I chose Gemini 3.5 Flash-Lite after comparing response times on the live site.

**Prompt design.** I wrote the master build prompt that defined the product: who it serves, what it must do, and the guardrails it must never break. Those guardrails became the rules of the in-app Gemini prompt: use only retrieved data, copy numbers exactly, keep station and model values distinct, never say "safe", never diagnose, keep CO₂e separate from local AQI, treat user text as untrusted, and personalise by routine, commute and household. I refined the prompts after every evaluation and after the organisers' session.

**Testing.** I tested every feature on the deployed site: city search and location detection for cities across India, station readings and the National AQI, the assistant with real questions (including the expert's example of a child playing outside in the evening), the outdoor-window planner, the day plan for different routines, the indoor advisor, the commute and combine-errands calculators, demo mode, settings, and the mobile layout. I checked every result against the automated test, accessibility and performance reports.

**Decisions and delivery.** I made the product and engineering decisions: the data sources, the model, public repository and Vercel hosting, which improvements to prioritise, and when to submit. I set up and secured the Gemini, OpenAQ and Vercel accounts, keeping every key server-side and out of the code.

**How I used AI.** I used Claude Code as my implementation tool: it wrote the application code, tests and documentation from my specifications, and I reviewed, tested and approved each change before it shipped. Inside the app, Gemini interprets each user's real data and answers their questions; it never supplies an air-quality value.

## How claims were verified

Every figure in the README is reproducible: `npm run verify` (format, lint, unused code, duplicates, types, tests, build), `npm run test:coverage`, `npm run test:e2e`, and the live checks listed in [TESTING.md](TESTING.md). Station data was validated against live OpenAQ responses for Delhi, Mumbai, Kolkata and Noida before release.
