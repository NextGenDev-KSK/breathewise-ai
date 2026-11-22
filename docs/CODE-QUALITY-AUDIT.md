# Code-quality audit and remediation (2026-11-18)

This audit started from the first competition evaluation (96.83/100): **Code Quality 88**, Security 99, Efficiency 100, Testing 99, Accessibility 100, Problem Statement Alignment 100. The goal was to close every code-quality gap without regressing any perfect score. Every number below was measured, and each one can be reproduced with the commands in the last section.

## Before and after

| Metric (production source: `app`, `components`, `hooks`, `lib`, `types`)                              | Before                      | After                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint-rule suppressions (`eslint-disable`)                                                             | 4                           | **0**                                                                                                                                               |
| Lines matching `as SomeType` (grep heuristic; also matches import aliases and comments)               | 32                          | **3**: 1 real cast (documented, `lib/collections.ts`) + 1 import alias + 1 comment                                                                  |
| Non-null assertions (`!`)                                                                             | 1                           | **0**                                                                                                                                               |
| Largest source file                                                                                   | 455 lines (`dailyPlan.ts`)  | 296 lines (`lib/engine/windows.ts`); every file now capped at 300 lines by lint                                                                     |
| Unused exports / types / files (Knip)                                                                 | 28 / 36 / 2                 | **0 / 0 / 0**                                                                                                                                       |
| Undeclared dependencies (Knip)                                                                        | 1 (`postcss`)               | **0**                                                                                                                                               |
| Files not matching the formatter (Prettier)                                                           | 98                          | **0**                                                                                                                                               |
| Functions over the complexity/size budgets (complexity > 12, nesting > 3, > 4 parameters, > 80 lines) | 18                          | **0**, enforced as lint errors                                                                                                                      |
| Copy-pasted code blocks (jscpd)                                                                       | not measured                | **0 clones**, enforced in CI (`npm run lint:duplicates`)                                                                                            |
| Exported functions without a doc comment                                                              | 70 of 213                   | **0**, enforced (`jsdoc/require-jsdoc`)                                                                                                             |
| ESLint rule set                                                                                       | Next + syntactic TypeScript | + type-aware rules (floating promises, misused promises, exhaustive switches, unnecessary assertions, non-null assertions, consistent type imports) |
| Unit/integration/component tests                                                                      | 191 (15 files)              | **384** (71 files mirroring the source tree)                                                                                                        |
| Statement / branch / line coverage (all source)                                                       | 77.2 % / – / 78.4 %         | **97.5 % / 86.9 % / 98.5 %**, enforced thresholds (95 / 84 / 96)                                                                                    |
| End-to-end browsers                                                                                   | Chromium                    | Chromium (desktop + mobile), Firefox; WebKit in CI                                                                                                  |
| Lighthouse Performance (mobile, `/`, `/commute`, `/assistant`)                                        | 92–93, 91, 91               | **94, 96, 95–99**                                                                                                                                   |
| Total blocking time (`/`, `/commute`)                                                                 | 240–320 ms, 250 ms          | **80 ms, 40 ms**                                                                                                                                    |

## Root causes and fixes

### 1. State copied from browser storage into React state (removed 2 lint suppressions)

**Cause.** `usePersistentState` read `localStorage` inside an effect and copied it into state. This rendered twice, needed two `eslint-disable` comments, and could drift when another tab or a "clear data" action changed storage.
**Fix.**

- `lib/storage.ts` is now a subscribable store: writes notify listeners, and the browser `storage` event syncs other tabs. `storedSnapshotReader` returns referentially stable, validated snapshots.
- `hooks/useStoredState.ts` reads the store through React's `useSyncExternalStore`.
- `hooks/useHydrated.ts` replaces the "loaded" flags.
  **Evidence.** `tests/unit/lib/storage.test.ts` → "storage store" and `tests/unit/hooks/useStoredState.test.tsx`: two components stay in sync; clear resets them; invalid data falls back; another tab's changes are picked up.

### 2. Data fetching set state synchronously inside an effect (removed 1 lint suppression)

**Cause.** `AppProvider` was a 164-line component that fetched, cached, handled demo mode and fell back to a saved copy, all inside one effect with a block-level `eslint-disable`.
**Fix.**

- `hooks/useAirQuality.ts` derives `loading`, `refreshing`, `success` and `error` from a request key. State is set only in async callbacks, and every new request aborts the previous one.
- Cache and offline-copy logic moved to `lib/air/cache.ts` (`loadAirQuality`, `savedSnapshotFor`, `invalidateCached`).
- `AppProvider` is now a composition of hooks.
  **Evidence.** `tests/unit/hooks/useAirQuality.test.tsx`: loading then success, idle, error, labelled saved copy, refresh keeps data visible, cache hit avoids a second request, demo mode never fetches.

### 3. Full page reload to clear data (removed the last lint suppression)

**Cause.** Settings → "Clear all local data" called `window.location.assign("/")` to reset in-memory state, which needed a suppressed Next.js rule.
**Fix.** Clearing storage now notifies every subscriber, so the app resets in place, then navigates with the router (`components/settings/PrivacySettings.tsx`).
**Evidence.** `tests/unit/components/settings/SettingsPanel.test.tsx` → "clears all local data after confirmation".

### 4. Duplicated logic

| Duplicate                                                    | Copies                                      | Now                                                  |
| ------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| Concern level for a metric value                             | 3 (`levelOf`, `levelForMetric`, `levelFor`) | `concernLevelFor` in `lib/air/indices.ts`            |
| Source label and baseline confidence                         | 2 (recommendations, daily plan)             | `lib/engine/provenance.ts`                           |
| Default 24-hour time formatter                               | 5 inline lambdas                            | `formatTime24` in `lib/time.ts`                      |
| Model, indoor-sensor and CPCB notices; CPCB URL              | strings repeated across engine and UI       | `lib/content/notices.ts`                             |
| Assistant answer length limits                               | numbers repeated in schema and fallback     | `RESPONSE_LIMITS` in `lib/ai/schema.ts`              |
| Segmented control                                            | 2 different implementations                 | `components/ui/SegmentedControl.tsx` (native radios) |
| Confirm dialog                                               | 2                                           | `components/ui/ConfirmDialog.tsx`                    |
| External link with "(opens in a new tab)"                    | 6                                           | `components/ui/ExternalLink.tsx`                     |
| Labelled form field wiring (hint, error, `aria-describedby`) | 2 forms                                     | `components/ui/FormField.tsx`                        |
| Weekday names                                                | 2                                           | `weekdayShort` in `lib/time.ts`                      |
| "Open-air commute" check                                     | 3                                           | `isOpenAirMode` in `lib/engine/emissions.ts`         |

### 5. Oversized modules and components

- `lib/engine/dailyPlan.ts` (455 lines, one function branching over four periods) became `lib/engine/plan/`:
  - `periods.ts`: grouping and statistics.
  - `context.ts`: shared item construction.
  - `items.ts`: activity, ventilation and commute items.
  - `builders.ts`: one builder per period, held in a `Record<PeriodId, …>`.
  - `index.ts`: the orchestrator.
- `lib/engine/recommendations.ts` (352 lines, ten rules) became `lib/engine/recommendations/`. Rules are grouped by topic (`outdoor`, `home`, `commute`, `awareness`) and share a precomputed `RuleContext`, so concern, source and confidence are computed once rather than in every rule.
- `lib/ai/fallback.ts` became `fallback/intents.ts` (table-driven detection) and `fallback/index.ts` (one handler per intent in a `Record<Intent, …>`; the compiler now enforces that every intent has an answer).
- Activity profiles and the caution policy moved from `windows.ts` to `lib/engine/activities.ts`.
- Components were split into focused files:

| Component           | Split into                                                                   |
| ------------------- | ---------------------------------------------------------------------------- |
| `AssistantChat`     | `useAssistantChat` hook + `Conversation`, `QuestionForm`, `AssistantSidebar` |
| `MissionTracker`    | `MissionStats`, `TodayActions`, `WeeklyChart`, `HabitTotals`                 |
| `CommuteCalculator` | `CommuteForm`, `CommuteResults`, `EmissionMethodology`                       |
| `IndoorView`        | `VentilationCard`, `IndoorChecklist`, `IndoorGuide`, `CadrHelper`            |
| `SettingsPanel`     | `PreferenceSettings`, `PrivacySettings`, `DataSources`                       |
| `LocationPicker`    | search logic moved to the `useCitySearch` hook                               |

### 6. Type safety

- Casts replaced with real narrowing:
  - `SelectField` returns only its own option values, removing five `e.target.value as …` casts.
  - `parseCommuteForm` uses an `isCommuteField` type guard.
  - `Dialog` uses `instanceof HTMLElement`.
  - Band scales carry an explicit unbounded top band.
  - The four `Object.fromEntries(...) as Record<…>` sites use one documented `recordFromKeys` helper.
- `mean(...) as number` and `best[metric] as number` hid nullability. They were replaced with `minBy`/`maxBy` and `presentValues` (`lib/math.ts`), which skip missing readings explicitly.
- Two `Record<string, string>` lookups with `??` fallbacks became exhaustive typed records:
  - `POLLUTANT_TIPS` is keyed by pollutant.
  - `FALLBACK_NOTICES` is keyed by every failure code.
    A new error code or pollutant now fails to compile until it has text. A test also asserts every server error code has a notice.

### 7. Lint findings the stricter rules surfaced (all fixed)

| Finding                                                                                 | Effect                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Non-exhaustive `switch` in the assistant fallback ("general" handled only by `default`) | Replaced by the exhaustive handler record.                                              |
| Floating promise in the assistant status check                                          | Now explicitly fire-and-forget (`void`); the function already handled its own errors.   |
| `\|\|` where `??` was meant, and optional chains                                        | Fixed. The client-IP fallback now states its intent: an empty header counts as missing. |
| Non-null assertion in the demo fixture                                                  | Replaced by a generator that computes the current hour directly.                        |

### 8. Defects found during the audit

| Defect                                                                                                                                                                                                                                                                                                   | Status                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Latent:** an outdoor window's end time used string arithmetic, so 23:00 + 1 h became "00:00" on the same date. No activity currently runs past 22:00, so users could not trigger it.                                                                                                                   | End times now come from absolute time. Covered by "window end times are computed from absolute time".                                                      |
| The "Use my location" button held two copies of its label and relied on CSS to hide one. Without CSS (or with CSS overridden) its accessible name was doubled.                                                                                                                                           | It now has a single label that is visually hidden only on small screens.                                                                                   |
| **Found by the new WebKit runs:** the CSP always sent `upgrade-insecure-requests`. WebKit (Safari) applies it even to `http://localhost`, rewriting the page's own scripts to `https://` so they never loaded. This broke local HTTP testing in Safari; production is HTTPS, so users were not affected. | The directive is now sent only when the request arrived over HTTPS (`proxy.ts`). Covered by "upgrades insecure requests only for pages served over HTTPS". |

### 9. Complexity and size budgets (second pass)

A second pass measured every function in shipped code with ESLint's `complexity`, `max-depth`, `max-params` and `max-lines-per-function` rules. It found 18 functions over budget. All 18 were refactored, and the budgets are now **errors** in `eslint.config.mjs` (plus `max-lines: 300` per file), so they cannot come back.

| Over budget                              | Refactor                                                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/assistant` (one long handler) | A pipeline of small steps: `checkGate` (origin 403, content type 415, rate limit 429) → `parseRequest` (413/400) → `askModel` (504/503/502) → `validateOutput` (502). Each step returns a typed `Step<T>` or a `Failure`.        |
| `findOutdoorWindow`                      | Split into `candidateHours`, `scanSlots`, `windowReasons`, `windowCautions` and `windowUncertainty`, sharing a `SearchContext`. Magic numbers became named constants (`MAX_MISSING_SHARE`, `MIN_SLOTS`, `SIMILAR_VALUES_SHARE`). |
| Plan items (activity, commute)           | `plannedActivity`, `periodWindow`, `forecastAtClock` and `commuteBasis` helpers; the afternoon builder became three named builders.                                                                                              |
| Indoor checklist and ventilation advice  | A declarative `CHECKLIST` table with `when` predicates; `cleanerTimeLater` and `adviceText` helpers.                                                                                                                             |
| Outdoor trend rule                       | `actionableTrend` plus a `TREND_TEXT` table.                                                                                                                                                                                     |
| `askGemini` (5 positional parameters)    | One typed `AskOptions` object.                                                                                                                                                                                                   |
| `HourlyChart`                            | `chart/geometry.ts` (pure, memoised), `ChartPlot`, `ChartLegend`, `ChartDataTable`.                                                                                                                                              |
| `LocationPicker`                         | `useCombobox` hook (keyboard handler map, outside-click close) + `PlaceListbox` + `DetectLocationButton`.                                                                                                                        |
| `ForecastView`, `OutdoorWindowPlanner`   | `ForecastChartCard`, `DailyOverview`, `ActivityPicker`, `WindowResult` (typed `Record<Verdict, …>` styles).                                                                                                                      |
| `PlanView`, `PreferencesForm`            | `PreferencesCard`, `PlanPeriodCard`; `RoutineFields`, `HouseholdFields`, `EquipmentFields` and `FormErrors`.                                                                                                                     |
| `AssistantAnswer`                        | `SourceBadge`, `TopActions`, `AnswerDetails`, with a shared `Detail` row and `BulletList`.                                                                                                                                       |

Every label, accessible name and piece of text is unchanged; the existing component, axe and end-to-end tests pass without edits (only the `askGemini` call sites in one integration test changed to the new options object).

### 10. Third pass: test structure, documentation and two defects

The second evaluation (97.27) scored Code Quality 89 and Testing 98. Every metric the first two passes measured was already at its target, so this pass looked at what a reviewer reading the code would notice.

| Finding                                                                                                                                                                                               | Fix                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Test files were grab-bags named after the refactor (`refactor-modules.test.ts`, `security-storage.test.ts`, `indoor-mission.test.ts`): a module's tests could not be found from its path.             | 19 files became 49 that mirror the source tree, plus 13 new ones (62 in all). Shared setup moved to `tests/setup.ts` and `tests/fixtures/`.  |
| 70 of 213 exported functions had no doc comment, including core ones (`searchPlaces`, `createRateLimiter`, `buildContentSecurityPolicy`, `toggleAction`).                                             | All documented; `jsdoc/require-jsdoc` now fails the lint step for any undocumented export.                                                   |
| `proxy.ts`, which issues the CSP nonce, had no tests and sat outside the coverage scope.                                                                                                              | New `tests/unit/proxy.test.ts`; `proxy.ts` added to coverage (100 %).                                                                        |
| `fetchAssistantStatus` cast the server's JSON (`as { configured?: unknown }`).                                                                                                                        | Validated with a new `AssistantStatusSchema`; the route's GET response is typed with the same schema.                                        |
| Nested ternaries and `let` reassignment chains (`useAssistantChat` notice, `prompt.ts` data origin, `DataStatus`).                                                                                    | `ruleModeNotice` and `historyFrom` helpers, an exhaustive `ORIGIN_NOTES` record, and a pure `dataStatus` function.                           |
| **Defect (found by the new `useCombobox` tests):** pressing ArrowUp before any option was active highlighted the _second_ option, because `(-1 - 1 + 3) % 3 = 1`. ArrowUp also did not open the list. | ArrowUp now opens the list at the last option, as the WAI-ARIA combobox pattern describes; covered by "opens on ArrowUp at the last option". |

## Security changes (Security 99)

| Change                                                                                                                                                                                                  | Evidence                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Same-origin enforcement on `POST /api/assistant` via `Sec-Fetch-Site`, falling back to `Origin` (`lib/security/origin.ts`). Stops other websites from spending the AI quota through visitors' browsers. | Route tests "same-origin protection"; unit tests "isSameOriginRequest"; `curl -H "sec-fetch-site: cross-site" …` → 403. |
| Extra headers: `Cross-Origin-Resource-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`.                                                                   | `curl -I http://localhost:3100/`                                                                                        |
| GitHub CodeQL (`security-extended`) on every push, pull request and weekly; Dependabot for npm and GitHub Actions.                                                                                      | `.github/workflows/codeql.yml`, `.github/dependabot.yml`                                                                |

## Testing changes (Testing 99)

- Tests now mirror the source tree (`tests/unit/lib/…`, `tests/unit/hooks/…`, `tests/unit/components/…`), one file per module, so each module's tests are easy to find. Repeated per-file setup (global resets, router mock, demo seeding, JSON responses) moved into `tests/setup.ts` and `tests/fixtures/`.
- New suites in the third pass: `proxy.ts` (nonce, policy, HTTPS-only upgrade, matcher), `useCombobox`, `useAssistantChat`, `fetchAssistantStatus`, `PreferencesForm`, `QuestionForm`, `AssistantAnswer` (including output rendered as text, never HTML), `Dialog`, `Toast`, `Onboarding` paths, `CommuteResults`, `CadrHelper`, `PageHeader`, `IndiaAqiNotice`, `dataStatus`, and live Indian data on the dashboard.
- Coverage thresholds enforced in CI (`vitest.config.mts`): statements 95, lines 96, functions 95, branches 84 (were 90 / 90 / 85 / 78). `proxy.ts` is now inside the coverage scope.
- End-to-end tests run in Chromium and Firefox locally, and in Chromium, Firefox and WebKit in CI. CI runs them inside the official Playwright Docker image: an earlier setup that downloaded browsers and system libraries at run time hung in 2 of 3 runs.

## User-visible behaviour changes

None in functionality. Small consistent improvements:

- Outdoor-window caveats use the shared wording "Based on modelled forecasts, not monitoring-station measurements."
- Clearing data no longer reloads the page.
- Settings stay in sync across open tabs.
- City search shows "Searching…" from the first keystroke instead of after the debounce.

## Reproduce every number

```bash
npm ci
npm run format:check && npm run lint && npm run lint:unused && npm run lint:duplicates && npm run typecheck
npm run test:coverage                       # 384 tests + enforced coverage
npx playwright install chromium firefox
npx playwright test --project=desktop-chromium --project=mobile-chromium --project=desktop-firefox --repeat-each=2
grep -rn "eslint-disable" app components hooks lib types proxy.ts | wc -l          # 0
find app components hooks lib types proxy.ts -name "*.ts*" | xargs wc -l | sort -rn | head -3
npx knip                                    # no findings
# The lint step already enforces: complexity 12, max-depth 3, max-params 4,
# max-lines-per-function 80, max-lines 300 (eslint.config.mjs)
npm run build && npx next start -p 3100 &   # then:
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "content-type: application/json" \
  -H "sec-fetch-site: cross-site" -d '{}' http://localhost:3100/api/assistant   # 403
```
