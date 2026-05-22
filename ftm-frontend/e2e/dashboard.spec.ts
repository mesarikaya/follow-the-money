import { test, expect } from "@playwright/test";

test.describe("Dashboard shell", () => {
  test("loads with sidebar navigation items", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Follow the Money")).toBeVisible();
    await expect(page.getByRole("link", { name: /Rotation/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Macro/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /RRG/ })).toBeVisible();
  });

  test("renders category table with mock data", async ({ page }) => {
    await page.goto("/");
    // Verify category name and ETF ticker appear in table cells
    await expect(page.getByRole("cell", { name: "Information Technology" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "XLK", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Health Care" })).toBeVisible();
    // Verify rank column renders (rank=1 for first category)
    await expect(page.getByRole("cell", { name: "1", exact: true }).first()).toBeVisible();
  });

  test("renders macro panel with FRED indicators and regime badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Macro Environment")).toBeVisible();
    await expect(page.getByText("VIX")).toBeVisible();
    await expect(page.getByText("10Y Yield")).toBeVisible();
    await expect(page.getByText("Fed Funds Rate")).toBeVisible();
    await expect(page.getByText("RISK ON GROWTH")).toBeVisible();
  });

  test("timeframe selector changes URL param and re-renders", async ({ page }) => {
    await page.goto("/");
    // Default timeframe is MONTH
    await expect(page.getByRole("button", { name: "Month" })).toBeVisible();
    // Click Week
    await page.getByRole("button", { name: "Week" }).click();
    await expect(page).toHaveURL(/timeframe=WEEK/);
  });

  test("refresh button triggers ingestion and shows confirmation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Refresh/ }).click();
    await expect(page.getByText(/Started/)).toBeVisible();
  });

  test("shows type badges on category rows", async ({ page }) => {
    await page.goto("/");
    // Type badge full labels: EQUITY_SECTOR→"Equity", PRECIOUS_METAL→"Precious Metal",
    // FIXED_INCOME→"Fixed Income", CASH→"Cash"
    await expect(page.getByText("Equity", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Precious Metal", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Fixed Income", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Cash", { exact: true }).first()).toBeVisible();
  });

  test("equity sector ETF tickers in category table link to sector drilldown", async ({ page }) => {
    await page.goto("/");
    // XLK is an equity sector — its ETF ticker cell should be a link to /sectors/TECH
    const xlkLink = page.getByRole("link", { name: "XLK", exact: true });
    await expect(xlkLink).toBeVisible();
    await xlkLink.click();
    await expect(page).toHaveURL(/\/sectors\/TECH/);
  });

  test("null signal values display as dash", async ({ page }) => {
    await page.goto("/");
    // All scores are null in the fixture — table cells show "—"
    const dashes = page.getByText("—");
    await expect(dashes.first()).toBeVisible();
  });

  test("shows momentum leaders panel with accelerating and decelerating sections", async ({ page }) => {
    await page.goto("/");
    // Mock data has TECH (+8 pts trend), HLTH (+3 pts), ENRG (-12 pts)
    await expect(page.getByText("Accelerating")).toBeVisible();
    await expect(page.getByText("Decelerating")).toBeVisible();
    // TECH should be in the accelerating column (highest positive trend)
    await expect(page.getByText("XLK").first()).toBeVisible();
    // ENRG should appear as a decelerator (largest negative trend)
    await expect(page.getByText("XLE").first()).toBeVisible();
  });

  test("market breadth bar shows sector breadth signal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Market Breadth")).toBeVisible();
    // Mock data has TECH (bullish), HLTH (moderate), ENRG (bearish) — Mixed signal
    await expect(page.getByText(/Risk-On|Risk-Off|Mixed/).first()).toBeVisible();
  });
});
