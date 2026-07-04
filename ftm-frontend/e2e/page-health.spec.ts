import { test, expect } from "@playwright/test";

/**
 * Smoke test against the real running app (playwright.real.config.ts, baseURL :3000).
 * Loads every navigable page and fails if the route errors, throws an uncaught
 * exception, shows the Next runtime error overlay, or makes a failing backend
 * request. Does NOT assert fixture counts, so it is safe against real data.
 */
const routes: [label: string, path: string][] = [
  ["Sector Rotation", "/"],
  ["Daily Brief", "/brief"],
  ["RRG Chart", "/rrg"],
  ["Themes", "/themes"],
  ["Sub-Sectors", "/sectors"],
  ["Factor Flows", "/factors"],
  ["Capital Flows", "/flows"],
  ["Macro Regime", "/macro"],
  ["Portfolio", "/portfolio"],
  ["Alerts", "/alerts"],
  ["Backtester", "/backtest"],
  ["Ticker Mappings", "/admin/ticker-mappings"],
];

for (const [label, path] of routes) {
  test(`${label} (${path}) loads without errors`, async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("pageerror", (e) => pageErrors.push(e.message.split("\n")[0]));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().split("\n")[0]);
    });
    page.on("response", (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    const resp = await page.goto(path, { waitUntil: "networkidle" });
    expect(resp, `no response for ${path}`).not.toBeNull();
    expect(resp!.status(), `HTTP status for ${path}`).toBeLessThan(400);

    // The Next dev runtime-error overlay renders a dialog labelled with the error
    // count/kind — distinct from the always-present dev-tools indicator portal.
    const overlay = page.locator("nextjs-portal").getByRole("dialog");
    const overlayText = (await overlay.count()) > 0 ? await overlay.innerText() : "";

    // Report everything found, so a failing page tells us WHY, not just that it failed.
    const report = {
      path,
      pageErrors: [...new Set(pageErrors)],
      consoleErrors: [...new Set(consoleErrors)].slice(0, 5),
      failedRequests: [...new Set(failedRequests)],
      overlay: overlayText.slice(0, 400),
    };
    if (
      report.pageErrors.length ||
      report.failedRequests.length ||
      report.overlay
    ) {
      console.log(`\n### ${label} (${path}) PROBLEM:\n` + JSON.stringify(report, null, 2));
    }

    const bodyText = await page.locator("body").innerText();
    const banners = [...bodyText.matchAll(/Failed to load [^\n:]{2,40}:[^\n]{0,40}/g)].map((m) =>
      m[0].trim(),
    );

    await expect(page.locator("body")).not.toContainText("This page could not be found");
    // In-page data-fetch error banners (e.g. "Failed to load categories: fetch failed") render
    // as normal 200 HTML — this is the class of error a status-code check silently misses.
    expect(banners, `in-page fetch-error banners on ${path}`).toEqual([]);
    expect(bodyText, `"fetch failed" text on ${path}`).not.toContain("fetch failed");
    expect(pageErrors, `uncaught errors on ${path}`).toEqual([]);
    expect(overlayText, `Next runtime error overlay on ${path}`).toBe("");
    expect(failedRequests, `4xx/5xx requests on ${path}`).toEqual([]);
  });
}
