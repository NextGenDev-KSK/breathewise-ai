import { expect, test } from "@playwright/test";
import { setup } from "./helpers";

test.describe("dashboard and location", () => {
  test("first visit shows onboarding and an empty state", async ({ page }) => {
    await setup(page, { seedPlace: false, onboarded: false });
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Welcome to BreatheWise AI" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Choose a location to begin" })).toBeVisible();
  });

  test("a city can be searched and selected, and labelled model data appears", async ({ page }) => {
    await setup(page, { seedPlace: false });
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search for a city" });
    await search.fill("Delhi");
    await page.getByRole("option", { name: "Delhi, Delhi, India" }).click();
    await expect(page.getByText("152", { exact: true })).toBeVisible();
    await expect(page.getByText("Unhealthy", { exact: true })).toBeVisible();
    await expect(page.getByText("86.6 µg/m³", { exact: true })).toBeVisible();
    await expect(page.getByText("The values above are not India's official National AQI")).toBeVisible();
    await expect(page.getByText("Model estimate and forecast (not a station measurement)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What to do today" })).toBeVisible();
  });

  test("keyboard users can select a city", async ({ page }) => {
    await setup(page, { seedPlace: false });
    await page.goto("/");
    await page.getByRole("combobox", { name: "Search for a city" }).fill("Delhi");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("86.6 µg/m³", { exact: true })).toBeVisible();
  });

  test("API failure shows an error state with a working retry", async ({ page }) => {
    await setup(page, { airStatus: 500 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Couldn't load air-quality data" })).toBeVisible();
    await page.unroute("https://air-quality-api.open-meteo.com/**");
    await setup(page);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("86.6 µg/m³", { exact: true })).toBeVisible();
  });

  test("a saved copy is shown, clearly labelled, when the API fails after a success", async ({ page }) => {
    await setup(page);
    await page.goto("/");
    await expect(page.getByText("86.6 µg/m³", { exact: true })).toBeVisible();
    await page.unroute("https://air-quality-api.open-meteo.com/**");
    await page.route("https://air-quality-api.open-meteo.com/**", (r) =>
      r.fulfill({ status: 503, body: "{}" }),
    );
    await page.getByRole("button", { name: "Refresh air-quality data" }).click();
    await expect(page.getByText(/Showing a saved copy/)).toBeVisible();
  });
});

test.describe("monitoring stations", () => {
  test("the dashboard shows the nearest monitor's CPCB-method National AQI and readings", async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/");
    const card = page.locator("div.rounded-2xl", {
      has: page.getByRole("heading", { name: "Nearest monitoring stations" }),
    });
    await expect(card.getByRole("heading", { name: "Lodhi Road, New Delhi - IMD" })).toBeVisible();
    await expect(card.getByText("India National AQI (CPCB method)")).toBeVisible();
    await expect(card.getByText("Moderately polluted")).toBeVisible();
    await expect(card.getByText("Prominent pollutant:")).toContainText("PM10");
    await expect(card.getByText("80.5 µg/m³")).toBeVisible();
    await expect(card.getByRole("link", { name: /OpenAQ/ })).toBeVisible();
  });

  test("a station outage leaves the model data usable", async ({ page }) => {
    await setup(page, { stationsStatus: 502 });
    await page.goto("/");
    await expect(
      page.getByText(
        "Monitoring-station data is temporarily unavailable. The model estimate above is still available.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Outdoor air concern:")).toBeVisible();
  });
});

test("forecast: find my better outdoor window", async ({ page }) => {
  await setup(page);
  await page.goto("/forecast");
  await page.getByText("Jogging").click();
  await page.getByRole("button", { name: "Find my better outdoor window" }).click();
  const result = page.getByRole("region", { name: "Outdoor window result" });
  await expect(result).toBeVisible();
  await expect(result).toContainText(/Tomorrow 1[2-6]:00/);
  await expect(result).toContainText("not monitoring-station measurements");
  await expect(result).not.toContainText(/\bsafe\b/i);
  // Users click the visible label; the native radio input is visually hidden.
  await page.locator("label", { hasText: /^US AQI$/ }).click();
  await expect(page.getByRole("radio", { name: "US AQI" })).toBeChecked();
  await expect(page.getByRole("img", { name: /US AQI ranges from/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "Daily forecast summary" })).toBeVisible();
});

test("daily plan can be generated from preferences", async ({ page }) => {
  await setup(page);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit preferences" }).click();
  await page.getByLabel("Children").check();
  await page.getByLabel("Usual commute").selectOption("cycle");
  await page.getByRole("button", { name: "Generate my clean-air day" }).click();
  await expect(page.getByText("Your clean-air day plan has been updated.")).toBeVisible();
  for (const period of ["Morning", "Afternoon", "Evening", "Night"]) {
    await expect(page.getByRole("heading", { level: 3, name: new RegExp(`^${period}`) })).toBeVisible();
  }
  await expect(page.getByText("Cleanest period", { exact: true })).toBeVisible();
  await expect(page.getByText(/Prioritise the sleeping room of sensitive family members/)).toBeVisible();
});

test("indoor checklist interactions persist across reloads", async ({ page }) => {
  await setup(page);
  await page.goto("/indoor");
  await expect(page.getByText("Keep windows mostly closed for now")).toBeVisible();
  const item = page.getByRole("checkbox", { name: /Damp-dust surfaces/ });
  await item.check();
  await expect(page.getByText(/^1 of \d+ done$/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Damp-dust surfaces/ })).toBeChecked();
  await page.getByLabel("Room floor area (m²)").fill("12");
  await expect(page.getByText(/at least about 87 cfm/)).toBeVisible();
});

test("commute calculator returns the expected estimate", async ({ page }) => {
  await setup(page);
  await page.goto("/commute");
  await page.getByLabel("One-way trip distance (km)").fill("10");
  await page.getByLabel("Trips per day").fill("2");
  await page.getByLabel("Commuting days per week").fill("5");
  await page.getByLabel("Current transport").selectOption("car");
  await page.getByLabel("Alternative to compare").selectOption("metro");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByTestId("weekly-saving")).toHaveText("13.8 kg CO₂e");
  await expect(page.getByTestId("monthly-saving")).toHaveText("59.8 kg CO₂e");
  await page.getByLabel("One-way trip distance (km)").fill("0");
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("Distance must be at least 0.1 km.")).toBeVisible();
});

test.describe("assistant", () => {
  test("works in rule-based fallback mode without a Gemini key", async ({ page }) => {
    await setup(page);
    await page.goto("/assistant");
    await expect(page.getByText("Rule-based mode: Gemini is not configured")).toBeVisible();
    await page.getByLabel("Your question").fill("Is it a good time to go walking?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Rule-based answer (no AI used)")).toBeVisible();
    await expect(page.getByText(/Gemini is not configured on this server/)).toBeVisible();
    await expect(page.getByText(/modelled US AQI is 152/)).toBeVisible();
  });

  test("renders a validated Gemini response (mocked)", async ({ page }) => {
    await setup(page);
    const sent: string[] = [];
    await page.route("**/api/assistant", (route) => {
      if (route.request().method() === "POST") sent.push(route.request().postData() ?? "");
      return route.request().method() === "GET"
        ? route.fulfill({ json: { configured: true } })
        : route.fulfill({
            json: {
              source: "gemini",
              model: "gemini-3.8-flash",
              response: {
                summary: "Delay your walk: air is unhealthy now and lower tomorrow afternoon.",
                risk_context: "US AQI is 152 (Unhealthy), led by PM2.5 at 86.6 µg/m³.",
                top_actions: [
                  {
                    action: "Walk tomorrow afternoon",
                    why: "Forecast PM2.5 is lowest then.",
                    when: "Tomorrow afternoon",
                  },
                ],
                timing: "Tomorrow afternoon is comparatively better.",
                indoor_recommendations: ["Keep windows closed tonight."],
                commute_recommendation: "Prefer metro where practical.",
                environmental_impact: "Metro lowers CO2e; this does not change today's AQI.",
                uncertainties: ["Model data, not a station."],
                disclaimer: "Not medical advice.",
              },
            },
          });
    });
    await page.goto("/assistant");
    await expect(page.getByText("Gemini AI, grounded in your local data")).toBeVisible();
    await page.getByRole("button", { name: "Is it a good time to go walking?" }).click();
    await expect(page.getByText("Gemini · gemini-3.8-flash")).toBeVisible();
    await expect(
      page.getByText("Delay your walk: air is unhealthy now and lower tomorrow afternoon."),
    ).toBeVisible();
    // Gemini is grounded in the nearest station's measurements too, and still never sees coordinates.
    const context = JSON.parse(sent[0] ?? "{}").context;
    expect(context.station).toMatchObject({
      name: "Lodhi Road, New Delhi - IMD",
      nationalAqi: { index: 141 },
    });
    expect(sent[0]).not.toMatch(/latitude|longitude|28\.65/);
  });

  test("falls back to rules when the AI response fails validation", async ({ page }) => {
    await setup(page);
    await page.route("**/api/assistant", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: { configured: true } })
        : route.fulfill({ json: { source: "gemini", model: "x", response: { summary: "<b>bad</b>" } } }),
    );
    await page.goto("/assistant");
    await page.getByRole("button", { name: "Why is PM2.5 particularly concerning?" }).click();
    await expect(page.getByText("Rule-based answer (no AI used)")).toBeVisible();
    await expect(page.getByText(/failed BreatheWise's safety and accuracy checks/)).toBeVisible();
  });
});

test("progress: 7-day mission can be started, ticked and reset", async ({ page }) => {
  await setup(page);
  await page.goto("/progress");
  await page.getByRole("button", { name: "Start mission" }).click();
  await page.getByRole("checkbox", { name: /Reduced indoor smoke sources/ }).check();
  await expect(page.getByText("1 of 7 done", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset weekly challenge" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your mission?" });
  await dialog.getByRole("button", { name: "Reset mission" }).click();
  await expect(page.getByText("0 of 7 done", { exact: true })).toBeVisible();
});

test("demo mode shows a persistent sample-data label and never live data", async ({ page }) => {
  await setup(page, { seedPlace: false, settings: { demoMode: true } });
  let apiCalls = 0;
  await page.route("https://air-quality-api.open-meteo.com/**", (r) => {
    apiCalls++;
    return r.abort();
  });
  for (const path of ["/", "/plan", "/assistant"]) {
    await page.goto(path);
    await expect(page.getByRole("note", { name: "Demo mode" })).toContainText("SAMPLE DATA · DEMO MODE");
  }
  await page.goto("/");
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  expect(apiCalls).toBe(0);
});

test("settings change behaviour: 12-hour time and European AQI first", async ({ page }) => {
  await setup(page);
  await page.goto("/settings");
  await page.getByText("European AQI (EEA)", { exact: true }).click();
  await page.getByText("12-hour", { exact: true }).click();
  await page.goto("/");
  await expect(page.getByText(/10:30 PM/).first()).toBeVisible();
  const indexCards = page.getByText(/^(US AQI \(US EPA\)|European AQI \(EEA\))$/);
  await expect(indexCards.first()).toHaveText("European AQI (EEA)");
});

test("skip link moves focus to main content", async ({ page }) => {
  await setup(page);
  await page.goto("/commute");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("mobile navigation works @mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await setup(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation menu" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Smart Commute" }).click();
  await expect(page).toHaveURL(/\/commute$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Smart commute" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
