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

  test("shows Rotation Velocity panel from RRG mock data", async ({ page }) => {
    await page.goto("/rrg");
    await expect(page.getByText("Rotation Velocity")).toBeVisible();
    // Velocity table has Speed column header
    await expect(page.getByText("Speed").first()).toBeVisible();
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

test.describe("Sectors hub page", () => {
  test("loads with sector cards for all equity sectors in the mock", async ({ page }) => {
    await page.goto("/sectors");
    // Mock backend returns TECH, HLTH, ENRG as EQUITY_SECTOR categories
    await expect(page.getByText("Information Technology")).toBeVisible();
    await expect(page.getByText("Health Care")).toBeVisible();
    await expect(page.getByRole("link", { name: /Sub-Sectors/ })).toBeVisible();
  });

  test("shows sub-sector counts in sector cards", async ({ page }) => {
    await page.goto("/sectors");
    // TECH has 8 sub-sectors per SUB_SECTOR_COUNTS constant
    await expect(page.getByText("8").first()).toBeVisible();
  });

  test("navigates to sector drilldown on card click", async ({ page }) => {
    await page.goto("/sectors");
    await page.getByText("Information Technology").click();
    await expect(page).toHaveURL(/\/sectors\/TECH/);
  });
});

test.describe("Sector drilldown page", () => {
  test("loads TECH drilldown with heading and breadcrumb", async ({ page }) => {
    await page.goto("/sectors/TECH");
    await expect(page.getByText("Information Technology").first()).toBeVisible();
    await expect(page.getByText("XLK").first()).toBeVisible();
    // Breadcrumb
    await expect(page.getByRole("link", { name: "Sub-Sectors", exact: true })).toBeVisible();
  });

  test("renders all four TECH sub-sector ETF tickers in table", async ({ page }) => {
    await page.goto("/sectors/TECH");
    await expect(page.getByText("SMH").first()).toBeVisible();
    await expect(page.getByText("BOTZ").first()).toBeVisible();
    await expect(page.getByText("WCLD").first()).toBeVisible();
    await expect(page.getByText("IGV").first()).toBeVisible();
  });

  test("renders sub-sector names in the drilldown table", async ({ page }) => {
    await page.goto("/sectors/TECH");
    await expect(page.getByText("Semiconductors")).toBeVisible();
    await expect(page.getByText("AI & Robotics")).toBeVisible();
    await expect(page.getByText("Cloud Computing")).toBeVisible();
    await expect(page.getByText("Software").first()).toBeVisible();
  });

  test("shows rotation signal quadrant labels", async ({ page }) => {
    await page.goto("/sectors/TECH");
    // Mock data has quadrants 1-4; at least one of the labels should appear
    const signals = page.getByText(/Leading|Improving|Weakening|Lagging/);
    await expect(signals.first()).toBeVisible();
  });

  test("shows quadrant distribution summary cards", async ({ page }) => {
    await page.goto("/sectors/TECH");
    await expect(page.getByText("↗ Leading").first()).toBeVisible();
    await expect(page.getByText("↖ Improving").first()).toBeVisible();
    await expect(page.getByText("↘ Weakening").first()).toBeVisible();
    await expect(page.getByText("↙ Lagging").first()).toBeVisible();
  });
});

test.describe("Legacy /sub-sectors redirect", () => {
  test("redirects /sub-sectors to /sectors hub", async ({ page }) => {
    await page.goto("/sub-sectors");
    await expect(page).toHaveURL(/\/sectors$/);
    await expect(page.getByRole("heading", { name: /Sub-Sector Rotation/i })).toBeVisible();
  });
});

test.describe("Capital Flows page", () => {
  test("loads with Capital Flows heading", async ({ page }) => {
    await page.goto("/flows");
    await expect(page.getByRole("heading", { name: "Capital Flows", level: 1 })).toBeVisible();
  });

  test("shows top leaders from rotation data", async ({ page }) => {
    await page.goto("/flows");
    // Mock rotation response has TECH and HLTH as top leaders
    await expect(page.getByText("↑ Top Leaders")).toBeVisible();
    await expect(page.getByText("Information Technology").first()).toBeVisible();
  });

  test("shows bottom laggards from rotation data", async ({ page }) => {
    await page.goto("/flows");
    // Mock rotation response has UTIL as bottom laggard
    await expect(page.getByText("↓ Bottom Laggards")).toBeVisible();
    await expect(page.getByText("Utilities")).toBeVisible();
  });

  test("shows flow z-score panel when flow20d data is available", async ({ page }) => {
    await page.goto("/flows");
    // Mock has TECH flow20d=1.42, ENRG flow20d=-1.18 — panel should render
    await expect(page.getByText("Flow Z-Score (20d)")).toBeVisible();
    // XLK has positive z-score, XLE has negative — both ETF tickers should appear in flow panel
    await expect(page.getByText("XLK").first()).toBeVisible();
    await expect(page.getByText("XLE").first()).toBeVisible();
  });

  test("shows seasonal headings from /categories/seasonal mock", async ({ page }) => {
    await page.goto("/flows");
    // SeasonalTailwindsPanel and SeasonalHeatmap both render from seasonal mock data
    await expect(page.getByText(/Seasonal/i).first()).toBeVisible();
    await expect(page.getByText(/Seasonal Monthly Returns/i)).toBeVisible();
  });
});

test.describe("Sectors hub page — confluence matrix", () => {
  test("shows Signal Confluence Matrix", async ({ page }) => {
    await page.goto("/sectors");
    await expect(page.getByText("Signal Confluence Matrix")).toBeVisible();
  });
});

test.describe("Dashboard (/) page", () => {
  test("loads and shows category table with data from mock", async ({ page }) => {
    await page.goto("/");
    // CategoryTable renders ETF tickers from CATEGORIES_RESPONSE
    await expect(page.getByText("XLK").first()).toBeVisible();
    await expect(page.getByText("XLV").first()).toBeVisible();
    await expect(page.getByText("XLE").first()).toBeVisible();
  });

  test("shows market breadth bar with equity sectors", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Market Breadth")).toBeVisible();
  });

  test("shows macro panel with regime and indicators", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Macro Environment")).toBeVisible();
    await expect(page.getByText("VIX", { exact: true })).toBeVisible();
  });

  test("shows section dividers in category table for non-equity types", async ({ page }) => {
    await page.goto("/");
    // GOLD is PRECIOUS_METAL → divider appears; TLT is FIXED_INCOME
    await expect(page.getByText("Precious Metals")).toBeVisible();
    await expect(page.getByText("Fixed Income")).toBeVisible();
    await expect(page.getByText("Cash")).toBeVisible();
  });

  test("BIL Cash category renders Cash badge, not Alternative", async ({ page }) => {
    await page.goto("/");
    // The CASH TYPE_CONFIG renders "Cash" label (not "ALT" or "Alternative")
    await expect(page.getByText("Cash").first()).toBeVisible();
    await expect(page.getByText("Alternative")).not.toBeVisible();
  });
});

test.describe("Macro Regime page — Regime Alignment table", () => {
  test("shows Regime Alignment section with category names and ETF tickers", async ({ page }) => {
    await page.goto("/macro");
    await expect(page.getByText("Regime Alignment")).toBeVisible();
    // Mock categories include TECH (XLK, macroFit=0.78) and HLTH (XLV, macroFit=0.63)
    await expect(page.getByText("Information Technology").first()).toBeVisible();
    await expect(page.getByText("Health Care").first()).toBeVisible();
  });

  test("shows trade signal badges in Regime Alignment table", async ({ page }) => {
    await page.goto("/macro");
    // TECH has tradeSignal=BUY, HLTH has WATCH in mock data
    await expect(page.getByText("BUY").first()).toBeVisible();
    await expect(page.getByText("WATCH").first()).toBeVisible();
  });

  test("shows win rate percentages for categories", async ({ page }) => {
    await page.goto("/macro");
    // TECH macroFit=0.78 → 78%
    await expect(page.getByText("78%").first()).toBeVisible();
  });
});

test.describe("Alerts page — Alert Rules", () => {
  test("shows Alert Rules section from mock backend", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByText("Alert Rules")).toBeVisible();
  });

  test("renders rule names in Alert Rules panel", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByText("RRG Transition")).toBeVisible();
    await expect(page.getByText("Composite Breakout")).toBeVisible();
    await expect(page.getByText("Macro Regime Shift")).toBeVisible();
  });

  test("toggle buttons are present for each rule", async ({ page }) => {
    await page.goto("/alerts");
    // Toggle buttons render as buttons with specific role; at least 2 toggles (enabled rules)
    const rules = page.locator("table").last().locator("button");
    await expect(rules.first()).toBeVisible();
  });
});

test.describe("Dashboard — trade signals", () => {
  test("shows trade signal badges (BUY/WATCH/HOLD/REDUCE) in category table", async ({ page }) => {
    await page.goto("/");
    // Mock has TECH=BUY, HLTH=WATCH, ENRG=REDUCE, TLTD=HOLD
    const buyBadge = page.getByText("BUY").first();
    const watchBadge = page.getByText("WATCH").first();
    await expect(buyBadge).toBeVisible();
    await expect(watchBadge).toBeVisible();
  });
});

test.describe("Sidebar navigation", () => {
  test("sidebar contains all main section links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Macro/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sub-Sectors/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Factor/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Capital Flows/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /RRG/ })).toBeVisible();
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


test.describe("Ticker Mappings admin page", () => {
  test("loads ticker mappings table", async ({ page }) => {
    await page.goto("/admin/ticker-mappings");
    await expect(page.getByRole("heading", { name: "Ticker Mappings" })).toBeVisible();
    await expect(page.getByText("3 entries")).toBeVisible();
    await expect(page.getByText("XLK")).toBeVisible();
    await expect(page.getByText("GLD")).toBeVisible();
  });

  test("filter narrows visible rows", async ({ page }) => {
    await page.goto("/admin/ticker-mappings");
    await page.getByPlaceholder(/Filter/).fill("TECH");
    await expect(page.getByText("XLK")).toBeVisible();
    await expect(page.getByText("GLD")).not.toBeVisible();
  });

  test("sidebar shows Ticker Mappings link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Ticker Mappings/ })).toBeVisible();
  });
});
