// Captures the small README screenshots from a running production server, using the
// captured real Open-Meteo response for Delhi (17 Nov 2026) so images are reproducible.
// Usage: node scripts/readme-screenshots.mjs http://localhost:3100
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const delhi = readFileSync(new URL("../tests/fixtures/open-meteo-delhi.json", import.meta.url), "utf8");
const place = { id: "geo-1273294", name: "Delhi", admin1: "Delhi", country: "India", countryCode: "IN", latitude: 28.652, longitude: 77.2315, source: "search" };
const settings = { aqiStandard: "us", timeFormat: "24h", aiEnabled: true, demoMode: false, onboarded: true };

const shots = [
  { path: "/", file: "dashboard.png", viewport: { width: 1280, height: 860 } },
  { path: "/plan", file: "plan.png", viewport: { width: 1280, height: 860 } },
  { path: "/forecast", file: "forecast.png", viewport: { width: 1280, height: 860 }, action: async (p) => { await p.getByText("Jogging").click(); await p.getByRole("button", { name: "Find my better outdoor window" }).click(); await p.getByRole("region", { name: "Outdoor window result" }).scrollIntoViewIfNeeded(); } },
  { path: "/assistant", file: "assistant.png", viewport: { width: 1280, height: 860 }, action: async (p) => { await p.getByRole("button", { name: "Is it a good time to go walking?" }).click(); await p.getByText("Rule-based answer (no AI used)").waitFor(); } },
  { path: "/", file: "mobile.png", viewport: { width: 390, height: 844 } },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.viewport });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-11-17T17:05:00Z"));
  await page.route("https://air-quality-api.open-meteo.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: delhi }));
  await page.addInitScript(([p, st]) => {
    localStorage.setItem("breathewise:v1:place", JSON.stringify(p));
    localStorage.setItem("breathewise:v1:settings", JSON.stringify(st));
  }, [place, settings]);
  await page.goto(base + s.path, { waitUntil: "networkidle" });
  if (s.action) await s.action(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/screenshots/${s.file}` });
  console.log("saved", s.file);
  await ctx.close();
}
await browser.close();
