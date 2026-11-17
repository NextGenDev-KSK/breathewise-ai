// Captures screenshots of every page for visual review (not part of the test suite).
// Usage: node scripts/screenshots.mjs <baseUrl> <outDir> [mode: live|demo]
import { chromium } from "@playwright/test";

const [base = "http://localhost:3000", out = "screenshots", mode = "live"] = process.argv.slice(2);
const PAGES = ["/", "/forecast", "/plan", "/indoor", "/commute", "/assistant", "/progress", "/settings"];
const place = { id: "geo-1273294", name: "Delhi", admin1: "Delhi", country: "India", countryCode: "IN", latitude: 28.65195, longitude: 77.23149, source: "search" };
const settings = { aqiStandard: "us", timeFormat: "24h", aiEnabled: true, demoMode: mode === "demo", onboarded: true };

const browser = await chromium.launch();
for (const [label, viewport] of [["desktop", { width: 1366, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(([p, s]) => {
    localStorage.setItem("breathewise:v1:place", JSON.stringify(p));
    localStorage.setItem("breathewise:v1:settings", JSON.stringify(s));
  }, [place, settings]);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`[${label}] console error:`, m.text()));
  for (const path of PAGES) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const name = `${out}/${label}-${path === "/" ? "home" : path.slice(1)}.png`;
    await page.screenshot({ path: name, fullPage: true });
    console.log("saved", name);
  }
  await ctx.close();
}
await browser.close();
