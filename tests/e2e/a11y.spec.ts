import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setup } from "./helpers";

const PAGES = ["/", "/forecast", "/plan", "/indoor", "/commute", "/assistant", "/progress", "/settings"];

test.describe("automated accessibility audit (axe-core, WCAG 2.2 A/AA) @mobile", () => {
  for (const path of PAGES) {
    test(`no detectable violations on ${path}`, async ({ page }) => {
      await setup(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main h1")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) – ${v.nodes[0]?.target.join(" ")}`);
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }

  test("onboarding dialog and empty state", async ({ page }) => {
    await setup(page, { seedPlace: false, onboarded: false });
    await page.goto("/");
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
