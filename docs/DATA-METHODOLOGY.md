# Data methodology

## Sources

**Open-Meteo Air Quality API** (`https://air-quality-api.open-meteo.com/v1/air-quality`), verified against the official documentation on 2026-11-17.

| Model | Domain | Grid | Time step | Forecast | Updates |
|---|---|---|---|---|---|
| CAMS Global atmospheric composition | Worldwide (used for India) | 0.4° (~45 km) | 3-hourly (hourly values interpolated) | 5 days | every 12 h |
| CAMS European air-quality ensemble | Europe | 0.1° (~11 km) | hourly | 4 days | daily |

BreatheWise requests the domain explicitly (`cams_europe` inside 25°W–45°E, 30°N–72°N, otherwise `cams_global`) so the model shown in the *Data confidence* panel is the model actually used. If the European model returns no data for a point, the app retries with the global model.

**Requested variables.** Current: `pm2_5, pm10, nitrogen_dioxide, sulphur_dioxide, carbon_monoxide, ozone, dust, ammonia, us_aqi, european_aqi, us_aqi_pm2_5, us_aqi_pm10, us_aqi_nitrogen_dioxide, us_aqi_sulphur_dioxide, us_aqi_carbon_monoxide, us_aqi_ozone`. Hourly: `pm2_5, pm10, nitrogen_dioxide, ozone, us_aqi, european_aqi`. Also `forecast_days=4` and `timezone=auto`. All concentrations are in µg/m³.

## Validation rules

- The response structure is validated with Zod; invalid payloads are rejected with a typed error.
- Each value must be a finite number ≥ 0; anything else becomes `null`. **Missing values are never converted to zero**, and the UI shows "Not available".
- Timestamps must match `YYYY-MM-DDTHH:MM`.
- A snapshot restored from localStorage is validated again before use and always labelled "Saved copy".

## Indices

| Standard | Bands used | Source of values |
|---|---|---|
| US AQI (US EPA) | 0–50 Good, 51–100 Moderate, 101–150 Unhealthy for Sensitive Groups, 151–200 Unhealthy, 201–300 Very Unhealthy, 301+ Hazardous | Calculated by Open-Meteo |
| European AQI (EEA, 2024 bands) | 0–20 Good, 20–40 Fair, 40–60 Moderate, 60–80 Poor, 80–100 Very poor, >100 Extremely poor | Calculated by Open-Meteo |
| **India National AQI (CPCB)** | **Not computed.** It needs station measurements and specific averaging periods. A notice links to official CPCB readings. | not applicable |

**Concern level.** The engine uses a neutral 0–5 scale (*Low, Moderate, Elevated, High, Very high, Severe*) derived from US AQI when available, else European AQI, else PM2.5 concentration (US EPA 2024 PM2.5 breakpoints: 9 / 35.4 / 55.4 / 125.4 / 225.4 µg/m³). The UI always shows which basis was used, together with the standard's own category name.

**Dominant pollutant.** The pollutant with the highest US AQI sub-index (the EPA definition).

**WHO context.** Each pollutant card shows its ratio to the WHO 2021 guideline (PM2.5 15, PM10 45, NO₂ 25, SO₂ 40 µg/m³ for 24 hours; CO 4 mg/m³ for 24 hours; O₃ 100 µg/m³ as an 8-hour peak). It is labelled "context only", because an hourly model value is not a 24-hour average.

## Better outdoor window

1. Candidates are the next 24 hours, starting no earlier than now, within realistic hours for the activity (e.g. 05:00–22:00 for walking, 07:00–19:00 for children's play).
2. **Ranking metric: hourly PM2.5 concentration.** Open-Meteo's US AQI for particles uses a 24-hour rolling average, which lags behind real changes and points to the wrong hour. A test covers this case. Indices are used only when PM2.5 is missing.
3. The window with the lowest mean wins; ties go to the earliest. Hours with missing data are skipped, never treated as clean.
4. The verdict depends on the concern level, the exertion (light, moderate or vigorous) and whether anyone sensitive is involved (children, older adults, respiratory sensitivity, or children's play). The outcomes are *reasonable*, *reduce* or *avoid*.
5. The wording is always "comparatively better". If even the best hour is concerning, the result says all hours are poor and suggests an indoor alternative.
6. Uncertainty is flagged when more than 20 % of candidate hours are missing or fewer than 3 slots exist. A note explains the global model's 3-hour steps and that similar values mean timing matters little.

## Recommendation engine

Ten rules (`lib/engine/recommendations.ts`) each return zero or more `Recommendation`s: outdoor timing, sensitive household, ventilation, purification, trend, dust, cooking, commute, dominant pollutant, and data freshness/CPCB. They are sorted by `priority` (1 = urgent), which combines urgency (concern level, sensitive members) with practicality.

**Confidence** is *high* for current European-model data, *medium* for current global-model data, and *low* for stale (more than 3 h old), cached or sample data, or for uncertain windows.

**Trend.** The next 3 hours are compared with hours 6–12 ahead; a change of ±20 % or more counts as improving or worsening.

**Ventilation.** Favourable at concern level ≤1, brief at level 2, limit at ≥3. The cleanest hour in the next 12 hours is suggested if it is at least 20 % lower than now. Advice always reminds users to ventilate for fuel-burning appliances.

No rule outputs exposure-reduction percentages, personal risk numbers or health statistics. Benefits are described qualitatively ("less personal exposure", "cleaner indoor air", "lower emissions (CO₂e)", "better-informed decisions").

## Daily plan

The next occurrence of each period (morning 06–12, afternoon 12–17, evening 17–22, night 22–06) is taken from the next ~30 hours. An in-progress period with fewer than 2 hours left is replaced by its next occurrence. Periods are shown chronologically. Each period gets the mean and peak of the ranking metric, a concern level, and explained items (activity, ventilation, commute, cooking, indoor sources, bedroom, preparation for tomorrow) that depend on the saved preferences.

## Commute emissions

Life-cycle factors (g CO₂e per passenger-km) from *OECD (2023), Life-cycle assessment of passenger transport: an Indian case study*: car 162, two-wheeler 65, urban non-AC bus 28, metro 24, walking and cycling 0 (direct operational emissions only, in this simplified comparison).

```
weekly kg  = factor × one-way km × trips per day × days per week ÷ 1000
monthly kg = weekly × 52 ÷ 12
```

Inputs are validated (0.1–200 km, 1–10 trips, 1–7 days). The UI states that the factors are illustrative, and that CO₂e reductions do not equal a measurable change in local AQI.

## Purifier sizing

The AHAM rule of thumb: smoke CADR (cfm) ≥ ⅔ × room area (ft²), with the area converted from m² and the result also shown in m³/h. It assumes a standard ~2.4 m ceiling.

## Demo data

`lib/demo/fixture.ts` generates 72 hours of a fixed, plausible North-Indian winter pattern anchored to the current hour, so the forecast is always "upcoming". The data has `origin: "demo"`, model "Built-in sample data (not real)" and place "Sample City". A persistent banner is shown, and no air-quality requests are made while demo mode is on.
