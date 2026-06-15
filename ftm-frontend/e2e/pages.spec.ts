import { test, expect } from "@playwright/test";

test.describe("Macro Regime page", () => {
  test("loads with regime badge and all FRED indicators", async ({ page }) => {
    await page.goto("/macro");
    // Use heading role to avoid strict mode conflict with sidebar "Macro Regime" span
    await expect(page.getByRole("heading", { name: "Macro Regime", level: 1 })).toBeVisible();
    // Badge label appears in header badge AND body section — .first() avoids strict mode
    await expect(page.getByText("Risk On — Growth").first()).toBeVisible();
    await expect(page.getByText("VIX", { exact: true }).first()).toBeVisible();
    // "10Y Yield" vs "Real 10Y Yield" — use exact match and first() to pick indicator card
    await expect(page.getByText("10Y Yield", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Fed Funds Rate", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("WTI Crude Oil", { exact: true }).first()).toBeVisible();
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
    // exact:true to avoid partial substring matches against longer sentences
    await expect(page.getByText("Momentum Factor", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Quality Factor", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Low Volatility Factor", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Value Factor", { exact: true }).first()).toBeVisible();
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

test.describe("Daily Brief page", () => {
  test("loads and shows signal grid sections", async ({ page }) => {
    await page.goto("/brief");
    // Brief is an RSC page — it uses <h1> Daily Brief in the header
    await expect(page.getByRole("heading", { name: "Daily Brief" })).toBeVisible();
    // Signal grid column headers
    await expect(page.getByText("Buy").first()).toBeVisible();
    await expect(page.getByText("Watch").first()).toBeVisible();
  });

  test("shows themes section with mock data", async ({ page }) => {
    await page.goto("/brief");
    // THEMES_RESPONSE has AI_INFRA and CHIP_COMPUTE — at least one theme name should appear
    await expect(page.getByText(/AI Infrastructure|Semiconductor/).first()).toBeVisible();
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
    // Multiple <select> elements exist — use first() to avoid strict mode
    await expect(page.getByRole("combobox").first()).toBeVisible();
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
    // Scope to table cells — sub-sector names now also appear in the theme overlap panel
    await expect(page.getByRole("cell", { name: "Semiconductors" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "AI & Robotics" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cloud Computing" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Software" })).toBeVisible();
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

  test("shows RS vs Flow scatter panel when flow20d data is available", async ({ page }) => {
    await page.goto("/flows");
    // RSFlowScatterPanel renders when categories have rs60 + flow20d
    await expect(page.getByText("RS vs Flow Positioning")).toBeVisible();
    await expect(page.getByText("Confirmed").first()).toBeVisible();
  });
});

test.describe("Sectors hub page — confluence matrix", () => {
  test("shows Signal Confluence Matrix", async ({ page }) => {
    await page.goto("/sectors");
    await expect(page.getByText("Signal Confluence Matrix")).toBeVisible();
  });
});

test.describe("Dashboard — Sector Rotation Wheel", () => {
  test("renders Sector Rotation Wheel on dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sector Rotation Wheel")).toBeVisible();
    // Description text is always present
    await expect(page.getByText(/RS-60.*5d score trend/)).toBeVisible();
  });

  test("renders quadrant labels and sector tickers in the wheel SVG", async ({ page }) => {
    await page.goto("/");
    // Use .first() — "↗ Leading" now appears in multiple places (SVG, RRG table, rotation strip)
    await expect(page.getByText("↗ Leading").first()).toBeVisible();
    await expect(page.getByText("↙ Lagging").first()).toBeVisible();
    // SVG text for sector ETF tickers (TECH=XLK, ENRG=XLE have non-null rs60+compositeTrend5d)
    await expect(page.getByText("XLK").first()).toBeVisible();
    await expect(page.getByText("XLE").first()).toBeVisible();
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
    // exact:true avoids matching sentences like "Market breadth is mixed…"
    await expect(page.getByText("Market Breadth", { exact: true })).toBeVisible();
  });

  test("shows macro panel with regime and indicators", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Macro Environment")).toBeVisible();
    await expect(page.getByText("VIX", { exact: true }).first()).toBeVisible();
  });

  test("shows section dividers in category table for non-equity types", async ({ page }) => {
    await page.goto("/");
    // GOLD is PRECIOUS_METAL → divider appears; TLT is FIXED_INCOME
    // "Precious Metals" (with s) is unique to the divider row (footer badge says "Precious Metal")
    await expect(page.getByText("Precious Metals", { exact: true })).toBeVisible();
    // Scope to <td> elements to avoid matching the footer badge with the same text
    await expect(page.locator("td").filter({ hasText: /^Fixed Income$/ }).first()).toBeVisible();
    await expect(page.locator("td").filter({ hasText: /^Cash$/ }).first()).toBeVisible();
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
    // Scope all sidebar link checks to the <aside> to avoid matching dashboard panel links
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: /Macro/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Sub-Sectors/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Factor/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Capital Flows/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /RRG/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Portfolio/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Alerts/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Backtest/ })).toBeVisible();
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
    // ActiveAlertsStrip shows "BUY XLK" — scope to table cells to avoid strict mode violation
    await expect(page.getByRole("cell", { name: "XLK", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "GLD", exact: true })).toBeVisible();
  });

  test("filter narrows visible rows", async ({ page }) => {
    await page.goto("/admin/ticker-mappings");
    await page.getByPlaceholder(/Filter/).fill("TECH");
    // Scope to table cells to avoid matching the ActiveAlertsStrip ticker spans
    await expect(page.getByRole("cell", { name: "XLK", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "GLD", exact: true })).not.toBeVisible();
  });

  test("sidebar shows Ticker Mappings link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Ticker Mappings/ })).toBeVisible();
  });
});

test.describe("Investment Themes page (/themes)", () => {
  test("loads with Investment Themes heading", async ({ page }) => {
    await page.goto("/themes");
    await expect(page.getByRole("heading", { name: "Investment Themes", level: 1 })).toBeVisible();
  });

  test("renders original five theme cards from mock data", async ({ page }) => {
    await page.goto("/themes");
    // Theme names appear in multiple places (ThemeNarrative, RotationMomentumStrip, ThemeCard)
    await expect(page.getByText("AI Infrastructure").first()).toBeVisible();
    await expect(page.getByText("Semiconductor Supercycle").first()).toBeVisible();
    await expect(page.getByText("SaaS at Risk").first()).toBeVisible();
    await expect(page.getByText("Defense Rearmament").first()).toBeVisible();
    await expect(page.getByText("Clean Power Renaissance").first()).toBeVisible();
  });

  test("renders four additional market-narrative themes", async ({ page }) => {
    await page.goto("/themes");
    await expect(page.getByText("Rate Pivot & Duration Trade").first()).toBeVisible();
    await expect(page.getByText("Commodity Supercycle & Electrification").first()).toBeVisible();
    await expect(page.getByText("Physical AI & Robotics").first()).toBeVisible();
    await expect(page.getByText("Hard Assets & Precious Metals").first()).toBeVisible();
  });

  test("shows dominant signal badges on theme cards", async ({ page }) => {
    await page.goto("/themes");
    // AI Infrastructure is BUY, SaaS at Risk is REDUCE in mock data
    await expect(page.getByText("BUY").first()).toBeVisible();
    await expect(page.getByText("REDUCE").first()).toBeVisible();
  });

  test("shows divergence from parent sectors chip", async ({ page }) => {
    await page.goto("/themes");
    // AI Infrastructure has divergenceFromParentSectors: 0.14 → shows "+14pt"
    await expect(page.getByText(/\+14pt/).first()).toBeVisible();
    // SaaS at Risk has divergence -0.18 → shows "-18pt"
    await expect(page.getByText(/-18pt/).first()).toBeVisible();
  });

  test("shows summary stats bar with theme and ETF count", async ({ page }) => {
    await page.goto("/themes");
    // Mock now has 12 themes
    await expect(page.getByText(/12 themes/)).toBeVisible();
    // constituentCount sum: 7+5+3+4+5+5+6+5+5+5+4+4=58
    await expect(page.getByText(/58 ETFs tracked/)).toBeVisible();
  });

  test("shows sparkline SVGs for themes with history data", async ({ page }) => {
    await page.goto("/themes");
    // Mock backend serves history for every theme — sparklines are SVG polylines
    const sparklines = page.locator("svg polyline");
    await expect(sparklines.first()).toBeVisible();
  });

  test("sidebar shows Themes link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Themes/ })).toBeVisible();
  });
});

test.describe("Theme detail page (/themes/[id])", () => {
  test("loads AI Infrastructure detail page with correct heading", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    await expect(page.getByRole("heading", { name: "AI Infrastructure", level: 1 })).toBeVisible();
  });

  test("shows thesis text on detail page", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    await expect(page.getByText(/Capital flooding into AI compute/)).toBeVisible();
  });

  test("shows dominant signal badge on detail page", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    // AI Infrastructure is BUY signal
    await expect(page.getByText("BUY").first()).toBeVisible();
  });

  test("shows aggregate metrics including vs Sectors divergence", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    await expect(page.getByText("Composite", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("vs Sectors", { exact: true })).toBeVisible();
    // AI Infrastructure divergence is +14pt
    await expect(page.getByText("+14pt")).toBeVisible();
  });

  test("renders constituent ETF table with top ETFs from mock", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    // Mock AI_INFRA detail: SMH, BOTZ, AIQ are top constituents
    await expect(page.getByText("SMH").first()).toBeVisible();
    await expect(page.getByText("BOTZ").first()).toBeVisible();
  });

  test("shows back link to themes hub", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    await expect(page.getByRole("link", { name: /← Themes/ })).toBeVisible();
  });

  test("returns 404 for unknown theme id", async ({ page }) => {
    const response = await page.goto("/themes/DOES_NOT_EXIST");
    // Next.js notFound() returns 404
    expect(response?.status()).toBe(404);
  });

  test("shows alert history section with resolved alerts", async ({ page }) => {
    await page.goto("/themes/AI_INFRA");
    // Header span uses CSS text-transform:uppercase so innerText is "ALERT HISTORY · N"
    await expect(page.getByText("ALERT HISTORY", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("RESOLVED").first()).toBeVisible();
  });
});

test.describe("Alerts page — new theme alert rules", () => {
  test("shows Setup Acceleration rule in Alert Rules panel", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByText("Setup Acceleration")).toBeVisible();
  });

  test("shows Phase Fading and Momentum Exhaustion rules", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByText("Phase Fading")).toBeVisible();
    await expect(page.getByText("Momentum Exhaustion")).toBeVisible();
  });

  test("shows Failed Breakout and Recovery Signal rules", async ({ page }) => {
    await page.goto("/alerts");
    // Use .first() — the note text also contains these words so strict mode would see 2 elements
    await expect(page.getByText("Failed Breakout").first()).toBeVisible();
    await expect(page.getByText("Recovery Signal").first()).toBeVisible();
  });

  test("shows recovery signal active alert in recent alerts feed", async ({ page }) => {
    await page.goto("/alerts");
    // Recovery signal alert for SAAS_AT_RISK is in ALERTS_RESPONSE.alerts
    await expect(page.getByText(/early turn signal/).first()).toBeVisible();
  });
});

test.describe("Theme detail page — phase fading and recovery alerts", () => {
  test("shows phase fading alert in SAAS_AT_RISK history", async ({ page }) => {
    await page.goto("/themes/SAAS_AT_RISK");
    await expect(page.getByText(/FADING phase/).first()).toBeVisible();
  });

  test("shows recovery signal alert in SAAS_AT_RISK history", async ({ page }) => {
    await page.goto("/themes/SAAS_AT_RISK");
    // Recovery signal message appears in alert history panel
    await expect(page.getByText(/early turn signal/).first()).toBeVisible();
  });
});

test.describe("Dashboard — ThemeSignalWidget Near Entry section", () => {
  test("shows NEAR ENTRY section when approaching-BUY themes exist", async ({ page }) => {
    await page.goto("/");
    // CLEAN_POWER (score 0.58) and COMMODITY_ELECTRIFICATION (score 0.61) qualify for Near Entry
    await expect(page.getByText("NEAR ENTRY")).toBeVisible();
    await expect(page.getByText(/approaching BUY/)).toBeVisible();
  });

  test("shows approaching BUY theme names in Near Entry section", async ({ page }) => {
    await page.goto("/");
    // CLEAN_POWER and COMMODITY_ELECTRIFICATION are in 55-65 range with positive 5d trend
    await expect(page.getByText("Clean Power Renaissance").first()).toBeVisible();
    await expect(page.getByText("Commodity Supercycle & Electrification").first()).toBeVisible();
  });

  test("shows pt-to-BUY distance in Near Entry rows", async ({ page }) => {
    await page.goto("/");
    // CLEAN_POWER: score 0.58 → 7pt to BUY; COMMODITY: score 0.61 → 4pt to BUY
    await expect(page.getByText(/pt to BUY/).first()).toBeVisible();
  });
});

test.describe("Alerts page — Strong Breakout Confirmation rule", () => {
  test("shows Strong Breakout Confirmation rule in Alert Rules panel", async ({ page }) => {
    await page.goto("/alerts");
    // BUILTIN_RULES label for theme_strong_breakout_confirmation
    await expect(page.getByText("Strong Breakout Confirmed")).toBeVisible();
  });

  test("shows strong breakout active alert for AI_INFRA", async ({ page }) => {
    await page.goto("/alerts");
    // Alert id=7 in ALERTS_RESPONSE: AI_INFRA strong breakout confirmed, severity ACTION
    await expect(page.getByText(/institutional follow-through/).first()).toBeVisible();
  });

  test("shows Strong Breakout active alert with score details", async ({ page }) => {
    await page.goto("/alerts");
    // Alert id=7: AI_INFRA strong breakout message includes "score 78"
    await expect(page.getByText(/score 78/).first()).toBeVisible();
  });
});

test.describe("Dashboard — CategoryTable filter", () => {
  test("shows filter input in CategoryTable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("category-filter-input")).toBeVisible();
  });

  test("filtering by name narrows displayed rows", async ({ page }) => {
    await page.goto("/");
    const table = page.getByTestId("category-table");
    await table.getByTestId("category-filter-input").fill("Technology");
    // Information Technology row should remain in the table
    await expect(table.getByText("Information Technology").first()).toBeVisible();
    // Health Care row should be removed from the table tbody
    await expect(table.locator("tbody").getByText("Health Care")).not.toBeVisible();
  });

  test("filtering by ETF ticker narrows displayed rows", async ({ page }) => {
    await page.goto("/");
    const table = page.getByTestId("category-table");
    await table.getByTestId("category-filter-input").fill("XLK");
    await expect(table.getByText("Information Technology").first()).toBeVisible();
    await expect(table.locator("tbody").getByText("Health Care")).not.toBeVisible();
  });

  test("clear button resets filter and shows all categories", async ({ page }) => {
    await page.goto("/");
    const table = page.getByTestId("category-table");
    await table.getByTestId("category-filter-input").fill("XLK");
    await expect(table.locator("tbody").getByText("Health Care")).not.toBeVisible();
    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(table.locator("tbody").getByText("Health Care")).toBeVisible();
  });

  test("shows match count when filtering", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("category-filter-input").fill("XLK");
    // "1 of 6" (TECH matches, 6 total in mock)
    await expect(page.getByText(/1 of \d+/).first()).toBeVisible();
  });
});
