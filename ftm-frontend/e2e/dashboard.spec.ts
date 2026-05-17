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
    // Type badge abbreviations: EQUITY_SECTOR→"EQ", COMMODITY→"PM", FIXED_INCOME→"FI"
    // Use exact:true to avoid partial matches (e.g. "FI" in "FINL" ticker)
    await expect(page.getByText("EQ", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("PM", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("FI", { exact: true }).first()).toBeVisible();
  });

  test("null signal values display as dash", async ({ page }) => {
    await page.goto("/");
    // All scores are null in the fixture — table cells show "—"
    const dashes = page.getByText("—");
    await expect(dashes.first()).toBeVisible();
  });
});
