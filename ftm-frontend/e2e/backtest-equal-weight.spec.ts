import { test, expect } from "@playwright/test";

/**
 * Verifies the equal-weight benchmark card renders in the backtest results against the real app
 * (playwright.real.config.ts, baseURL :3000). Anchors on the verdict line, which is unique to the
 * equal-weight card, then checks the strategy/SPY comparison cards are present too.
 */
test("backtest results show the equal-weight benchmark alongside strategy and SPY", async ({
  page,
}) => {
  await page.goto("/backtest", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Run Backtest/ }).click();

  // Verdict text exists only inside the equal-weight benchmark card.
  const verdict = page.getByText(
    /Signal underperforms naive diversification|Signal beats equal-weight/,
  );
  await expect(verdict.first()).toBeVisible({ timeout: 45000 });

  // Comparison cards are all present (legend + card headers both match, hence .first()).
  await expect(page.getByText(/Strategy \(Top-/).first()).toBeVisible();
  await expect(page.getByText("SPY Benchmark").first()).toBeVisible();
});
