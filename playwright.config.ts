import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * End-to-end tests run against a production build. All third-party APIs
 * (Open-Meteo, Gemini) are mocked, so the suite never depends on the internet.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    // No Gemini key: the server must run in rule-based mode for the fallback tests.
    env: { GEMINI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
