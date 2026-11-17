# Demo video script (about 110 seconds) and submission checklist

Record at 1280×800 or larger. Use **live data** for a real city, or **demo mode** (the banner must stay visible). Never present sample data as live.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:12 | Dashboard, empty | "An AQI alert tells you the air is bad, but not what to do differently. BreatheWise turns air-quality data into decisions families can act on." |
| 0:12–0:32 | Search "Delhi" and select it. Show the AQI card, pollutant grid, CPCB notice and Data confidence panel. | "This is modelled CAMS data via Open-Meteo, clearly labelled. US and European AQI are named, PM2.5 is flagged as the main pollutant, and since this is India, we say plainly that it isn't the official CPCB index and link to it. Here is exactly how far to trust the data." |
| 0:32–0:50 | Forecast → Jogging → **Find my better outdoor window** | "Planning a run? It compares every forecast hour and picks the comparatively cleanest one, tomorrow at 14:00. It never calls the air safe, and if every hour is poor, it says so." |
| 0:50–1:08 | My Clean-Air Day → Edit preferences → tick Children → Generate. Open one "Why this recommendation?" | "Add your routine and household and you get a plan for tonight, morning, afternoon and evening. Every action shows why, when, the data behind it, the confidence and its limits." |
| 1:08–1:20 | Indoor Air: ventilation status, tick two checklist items | "Indoors: keep windows closed now, with a better time to air out. A personal checklist saves in your browser. No ozone generators, no houseplant myths." |
| 1:20–1:32 | Smart Commute: car → metro, 10 km × 2 × 5 → Calculate | "Switching this commute to metro avoids about 13.8 kg of CO₂e a week, using OECD's Indian case-study factors, with the method shown. CO₂e is kept separate from local AQI." |
| 1:32–1:48 | AI Assistant: "My child has school tomorrow. What precautions should I consider?" | "Ask anything. Gemini answers from this exact data in a strict format. Any invented number is rejected, and without a key the rule engine answers, labelled as such." |
| 1:48–1:55 | My Progress | "And a 7-day mission builds the habits. BreatheWise: understand the air, make smarter choices, breathe better." |

## Video checklist

- [ ] 90–120 s, audio clear, captions on (YouTube auto-captions reviewed, or burned in)
- [ ] Shows real model data, or the demo banner is visible throughout
- [ ] Shows at least one "Why this recommendation?" expansion
- [ ] Shows the AI source badge (Gemini, or rule-based)
- [ ] Uploaded as **Unlisted** on YouTube, or Google Drive shared as "Anyone with the link: Viewer"
- [ ] Link opened in a private window to confirm access

## GitHub publication checklist

- [ ] `npm run verify` passes on a fresh clone (`git clone … && npm ci && npm run verify`)
- [ ] `npx playwright install chromium && npm run test:e2e` passes
- [ ] `npm run repo:size` reports under 9 MB tracked
- [ ] `git ls-files | grep -E '^\.env($|\.)'` shows only `.env.example`
- [ ] `git log -p | grep -i "AIza"` returns nothing (no keys in history)
- [ ] Repository visibility set to **Public**, then confirmed by opening the URL while logged out
- [ ] Vercel deployment live; optional `GEMINI_API_KEY` set in Vercel only
- [ ] Deployed URL tested: search a city, ask the assistant one question
- [ ] README links (live demo, video) filled in
- [ ] Submission count tracked (at most 3 allowed): submit only after all boxes above are ticked
