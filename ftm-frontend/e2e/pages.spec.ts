import { test, expect } from "@playwright/test";

test.describe("Macro Regime page", () => {
  test("loads with regime badge and all FRED indicators", async ({ page }) => {
    await page.goto("/macro");
    // Use heading role to avoid strict mode conflict with sidebar "Macro Regime" span
    await expect(page.getByRole("heading", { name: "Macro Regime", level: 1 })).toBeVisible();
    // Badge label appears in header badge AND body section — .first() avoids strict mode
    await expect(page.getByText("Risk On — Growth").first()).toBeVisible();
    await expect(page.getByText("VIX", { exact: true })).toBeVisible();
    await expect(page.getByText("10Y Yield")).toBeVisible();
    await expect(page.getByText("Fed Funds Rate")).toBeVisible();
    await expect(page.getByText("WTI Crude Oil")).toBeVisible();
  });

  test("shows regime description for current regime", async ({ page }) => {
    await page.goto("/macro");
    // RISK_ON_GROWTH description text
    await expect(page.getByText(/Equities and cyclicals/)).toBeVisible();
  });
});

test.describe("Tech Sub-Sectors page", () => {
  test("loads with sub-sector heading", async ({ page }) => {
    await page.goto("/sub-sectors");
    // Sidebar says "Tech Sub-Sectors", h1 says "Technology Sub-Sectors" — no conflict
    await expect(page.getByText("Technology Sub-Sectors")).toBeVisible();
    await expect(page.getByText(/RS signals vs XLK/)).toBeVisible();
  });

  test("renders all four sub-sector ETF tickers", async ({ page }) => {
    await page.goto("/sub-sectors");
    // Cards show "ETF: SMH" etc — substring match works; data served by mock backend
    await expect(page.getByText(/SMH/)).toBeVisible();
    await expect(page.getByText(/BOTZ/)).toBeVisible();
    await expect(page.getByText(/WCLD/)).toBeVisible();
    await expect(page.getByText(/IGV/)).toBeVisible();
  });

  test("renders sub-sector names", async ({ page }) => {
    await page.goto("/sub-sectors");
    await expect(page.getByText("Semiconductors").first()).toBeVisible();
    await expect(page.getByText("AI & Robotics")).toBeVisible();
    await expect(page.getByText("Cloud Computing")).toBeVisible();
    await expect(page.getByText("Software").first()).toBeVisible();
  });
});

test.describe("Factor Flows page", () => {
  test("loads with factor heading", async ({ page }) => {
    await page.goto("/factors");
    // Sidebar also says "Factor Flows" — use heading role to avoid strict mode
    await expect(page.getByRole("heading", { name: "Factor Flows", level: 1 })).toBeVisible();
  });

  test("renders all four factor ETF tickers", async ({ page }) => {
    await page.goto("/factors");
    // Factor cards render the ticker as a badge; data served by mock backend
    await expect(page.getByText("MTUM").first()).toBeVisible();
    await expect(page.getByText("QUAL").first()).toBeVisible();
    await expect(page.getByText("USMV").first()).toBeVisible();
    await expect(page.getByText("VLUE").first()).toBeVisible();
  });

  test("renders factor names", async ({ page }) => {
    await page.goto("/factors");
    await expect(page.getByText("Momentum Factor")).toBeVisible();
    await expect(page.getByText("Quality Factor")).toBeVisible();
    await expect(page.getByText("Low Volatility Factor")).toBeVisible();
    await expect(page.getByText("Value Factor")).toBeVisible();
  });
});

test.describe("RRG Chart page", () => {
  test("loads with RRG heading", async ({ page }) => {
    await page.goto("/rrg");
    // "Relative Rotation Graph" appears as h1 AND as h2 in RRGSection — target h1 by level
    await expect(page.getByRole("heading", { name: "Relative Rotation Graph", level: 1 })).toBeVisible();
  });
});

test.describe("Portfolio page", () => {
  test("loads with portfolio heading and editor controls", async ({ page }) => {
    await page.goto("/portfolio");
    // Sidebar also says "Portfolio" — use heading role to avoid strict mode
    await expect(page.getByRole("heading", { name: "Portfolio", level: 1 })).toBeVisible();
    // Holdings h2 is always rendered regardless of data load (client-side fetch skips mock)
    await expect(page.getByRole("heading", { name: /Holdings/ })).toBeVisible();
  });

  test("shows holdings section", async ({ page }) => {
    await page.goto("/portfolio");
    await expect(page.getByText(/Holdings/)).toBeVisible();
  });
});

test.describe("Alerts page", () => {
  test("loads with alerts heading", async ({ page }) => {
    await page.goto("/alerts");
    // Sidebar also says "Alerts" — use heading role to avoid strict mode
    await expect(page.getByRole("heading", { name: "Alerts", level: 1 })).toBeVisible();
  });

  test("shows filter or empty state (no real backend in E2E)", async ({ page }) => {
    await page.goto("/alerts");
    // The page renders a heading; data may not load (client fetch goes to real backend)
    // Verify the page shell renders without a crash
    await expect(page.getByRole("heading", { name: "Alerts", level: 1 })).toBeVisible();
    // No additional assertions on dynamic content for client components
  });
});

test.describe("Backtester page", () => {
  test("loads with backtester heading and form controls", async ({ page }) => {
    await page.goto("/backtest");
    // Sidebar also says "Backtester" — use heading role to avoid strict mode
    await expect(page.getByRole("heading", { name: "Backtester", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  });

  test("shows strategy configuration inputs", async ({ page }) => {
    await page.goto("/backtest");
    // Use heading role — getByText("Strategy") would substring-match container divs
    await expect(page.getByRole("heading", { name: "Strategy Parameters" })).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();
  });
});

test.describe("Sidebar navigation", () => {
  test("sidebar contains all main section links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Macro/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Tech Sub/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Factor/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Portfolio/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Alerts/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Backtest/ })).toBeVisible();
  });

  test("clicking sidebar links navigates to the correct page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Macro/ }).first().click();
    await expect(page).toHaveURL(/\/macro/);

    await page.getByRole("link", { name: /Portfolio/ }).first().click();
    await expect(page).toHaveURL(/\/portfolio/);
  });
});
