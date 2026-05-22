/**
 * Lightweight mock HTTP server that simulates the ftm-app backend.
 * Used exclusively by Playwright E2E tests (BACKEND_URL=http://localhost:9999).
 * Run via: node e2e/mock-backend.mjs
 */
import http from "http";

const CATEGORIES_RESPONSE = {
  asOfDate: "2026-05-15",
  timeframe: "MONTH",
  categories: [
    {
      id: "TECH",
      name: "Information Technology",
      type: "EQUITY_SECTOR",
      etfTicker: "XLK",
      compositeScore: 0.82,
      compositeTrend5d: 0.04,
      compositeTrend10d: 0.06,
      compositeTrend20d: 0.08,
      rrgQuadrant: "1",
      rs60: 0.031,
      rs120: 0.015,
      flow20d: 1.42,
      persistence20d: 16,
      rank: 1,
      latestClose: 192.5,
      priceDate: "2026-05-15",
    },
    {
      id: "HLTH",
      name: "Health Care",
      type: "EQUITY_SECTOR",
      etfTicker: "XLV",
      compositeScore: 0.64,
      compositeTrend5d: 0.01,
      compositeTrend10d: 0.02,
      compositeTrend20d: 0.03,
      rrgQuadrant: "2",
      rs60: 0.015,
      rs120: 0.018,
      flow20d: null,
      persistence20d: null,
      rank: 2,
      latestClose: 145.3,
      priceDate: "2026-05-15",
    },
    {
      id: "ENRG",
      name: "Energy",
      type: "EQUITY_SECTOR",
      etfTicker: "XLE",
      compositeScore: 0.31,
      compositeTrend5d: -0.05,
      compositeTrend10d: -0.08,
      compositeTrend20d: -0.12,
      rrgQuadrant: "4",
      rs60: -0.042,
      rs120: -0.030,
      flow20d: -1.18,
      persistence20d: 6,
      rank: 3,
      latestClose: 87.4,
      priceDate: "2026-05-15",
    },
    {
      id: "GOLD",
      name: "Gold",
      type: "PRECIOUS_METAL",
      etfTicker: "GLD",
      compositeScore: 0.71,
      compositeTrend5d: 0.02,
      compositeTrend10d: 0.03,
      compositeTrend20d: 0.05,
      rrgQuadrant: "1",
      rs60: 0.028,
      rs120: 0.020,
      flow20d: null,
      persistence20d: null,
      rank: 4,
      latestClose: 310.2,
      priceDate: "2026-05-15",
    },
    {
      id: "TLTD",
      name: "Long-Duration Treasuries",
      type: "FIXED_INCOME",
      etfTicker: "TLT",
      compositeScore: 0.38,
      compositeTrend5d: -0.02,
      compositeTrend10d: -0.03,
      compositeTrend20d: -0.04,
      rrgQuadrant: "3",
      rs60: -0.018,
      rs120: -0.010,
      flow20d: null,
      persistence20d: null,
      rank: 5,
      latestClose: 88.6,
      priceDate: "2026-05-15",
    },
    {
      id: "CASH",
      name: "Cash & Short-Term",
      type: "CASH",
      etfTicker: "BIL",
      compositeScore: null,
      compositeTrend5d: null,
      compositeTrend10d: null,
      compositeTrend20d: null,
      rrgQuadrant: null,
      rs60: null,
      rs120: null,
      flow20d: null,
      persistence20d: null,
      rank: 6,
      latestClose: 91.1,
      priceDate: "2026-05-15",
    },
  ],
};

const MACRO_RESPONSE = {
  asOfDate: "2026-05-15",
  regime: "RISK_ON_GROWTH",
  indicators: {
    yieldSpread10y2y: -0.3,
    vix: 15.2,
    usdIndex: 104.5,
    breakevenInflation: 2.3,
    fedFundsRate: 5.25,
    tenYearYield: 4.5,
    twoYearYield: 4.8,
    wtiCrudeOilPrice: 78.5,
  },
  previousIndicators: {
    yieldSpread10y2y: -0.5,
    vix: 18.1,
    usdIndex: 105.2,
    breakevenInflation: 2.25,
    fedFundsRate: 5.25,
    tenYearYield: 4.65,
    twoYearYield: 4.95,
    wtiCrudeOilPrice: 81.2,
  },
  regimeHistory: [
    { date: "2026-02-28", regime: "RISK_OFF_DEFENSIVE" },
    { date: "2026-03-07", regime: "RISK_OFF_DEFENSIVE" },
    { date: "2026-03-14", regime: "RISK_ON_GROWTH" },
    { date: "2026-03-21", regime: "RISK_ON_GROWTH" },
    { date: "2026-03-28", regime: "RISK_ON_GROWTH" },
    { date: "2026-04-04", regime: "RISK_OFF_FLIGHT" },
    { date: "2026-04-11", regime: "RISK_OFF_FLIGHT" },
    { date: "2026-04-18", regime: "RISK_ON_DEFENSIVE" },
    { date: "2026-04-25", regime: "RISK_ON_GROWTH" },
    { date: "2026-05-02", regime: "RISK_ON_GROWTH" },
    { date: "2026-05-09", regime: "RISK_ON_GROWTH" },
    { date: "2026-05-15", regime: "RISK_ON_GROWTH" },
  ],
  macroFitByCategory: {
    TECH: 0.78,
    FINL: 0.71,
    HLTH: 0.63,
    DISR: 0.59,
    INDU: 0.55,
    ENRG: 0.48,
    MATL: 0.44,
    UTIL: 0.32,
    REIT: 0.39,
    STPL: 0.41,
    COMM: 0.62,
    GLD: 0.35,
    SLV: 0.31,
    TLT: 0.28,
    BIL: 0.22,
  },
};

const ROTATION_RESPONSE = {
  asOfDate: "2026-05-15",
  topLeaders: [
    { categoryId: "TECH", categoryName: "Information Technology", compositeScore: 0.82, relativeStrength60Day: 1.12, relativeRotationGraphQuadrant: 4 },
    { categoryId: "HLTH", categoryName: "Health Care",            compositeScore: 0.71, relativeStrength60Day: 1.05, relativeRotationGraphQuadrant: 3 },
  ],
  bottomLaggards: [
    { categoryId: "UTIL", categoryName: "Utilities",  compositeScore: 0.22, relativeStrength60Day: 0.93, relativeRotationGraphQuadrant: 1 },
  ],
  recentEvents: [],
};

const RRG_RESPONSE = {
  date: "2026-05-15",
  categories: [
    {
      id: "TECH",
      name: "Information Technology",
      color: "#3b82f6",
      quadrant: 4,
      trail: [
        { date: "2026-05-01", ratio: 101.2, momentum: 100.8 },
        { date: "2026-05-15", ratio: 102.1, momentum: 101.3 },
      ],
    },
    {
      id: "HLTH",
      name: "Health Care",
      color: "#22c55e",
      quadrant: 3,
      trail: [
        { date: "2026-05-01", ratio: 99.8, momentum: 100.4 },
        { date: "2026-05-15", ratio: 100.5, momentum: 100.1 },
      ],
    },
  ],
};

const TECH_SUB_SECTORS_RESPONSE = [
  { id: "SEMI", name: "Semiconductors",  parentId: "TECH", etfTicker: "SMH",  rs20: 1.08, rs60: 1.12, rs120: 1.15, momentum: 0.03, rrgQuadrant: "4", compositeScore: 0.84 },
  { id: "AIRO", name: "AI & Robotics",   parentId: "TECH", etfTicker: "BOTZ", rs20: 1.05, rs60: 1.08, rs120: 1.10, momentum: 0.01, rrgQuadrant: "3", compositeScore: 0.71 },
  { id: "CLOD", name: "Cloud Computing", parentId: "TECH", etfTicker: "WCLD", rs20: 0.98, rs60: 1.02, rs120: 1.04, momentum: -0.01, rrgQuadrant: "2", compositeScore: 0.55 },
  { id: "SOFT", name: "Software",        parentId: "TECH", etfTicker: "IGV",  rs20: 0.95, rs60: 0.97, rs120: 0.99, momentum: -0.02, rrgQuadrant: "1", compositeScore: 0.38 },
];

const FACTOR_ETF_RESPONSE = [
  { id: "MTUM", name: "Momentum Factor",       parentId: "FTRS", etfTicker: "MTUM", rs20: 1.04, rs60: 1.07, rs120: 1.09, momentum: 0.02, rrgQuadrant: "4", compositeScore: 0.78 },
  { id: "QUAL", name: "Quality Factor",        parentId: "FTRS", etfTicker: "QUAL", rs20: 1.02, rs60: 1.04, rs120: 1.06, momentum: 0.01, rrgQuadrant: "3", compositeScore: 0.65 },
  { id: "USMV", name: "Low Volatility Factor", parentId: "FTRS", etfTicker: "USMV", rs20: 0.99, rs60: 1.01, rs120: 1.02, momentum: -0.01, rrgQuadrant: "2", compositeScore: 0.51 },
  { id: "VLUE", name: "Value Factor",          parentId: "FTRS", etfTicker: "VLUE", rs20: 0.97, rs60: 0.99, rs120: 1.00, momentum: -0.02, rrgQuadrant: "1", compositeScore: 0.43 },
];

const PORTFOLIO_RESPONSE = {
  allocations: [
    { categoryId: "TECH", categoryName: "Information Technology", categoryType: "EQUITY_SECTOR",  allocationPct: 30, compositeScore: 0.82, optimalAllocationPct: 35 },
    { categoryId: "HLTH", categoryName: "Health Care",            categoryType: "EQUITY_SECTOR",  allocationPct: 20, compositeScore: 0.71, optimalAllocationPct: 18 },
    { categoryId: "GOLD", categoryName: "Gold",                   categoryType: "PRECIOUS_METAL", allocationPct: 10, compositeScore: null, optimalAllocationPct: null },
    { categoryId: "CASH", categoryName: "Cash & Short-Term",      categoryType: "CASH",           allocationPct: 40, compositeScore: null, optimalAllocationPct: null },
  ],
  alignmentScore: 0.74,
  alignmentLabel: "ALIGNED",
  rebalanceSuggestions: [
    { categoryId: "TECH", categoryName: "Information Technology", action: "INCREASE", currentAllocationPct: 30, optimalAllocationPct: 35, deltaPct: 5 },
  ],
};

const HOLDINGS_RESPONSE = [
  {
    ticker: "AAPL", name: "Apple Inc.", categoryId: "TECH", currency: "USD",
    quantity: 10, avgCostLocal: 175.0, usdFxRate: 1.08,
    marketValueUsd: 1925.0, currentPriceLocal: 192.5,
    priceDate: "2026-05-15", priceSource: "YAHOO",
    marketValueEur: 1782.41,
  },
  {
    ticker: "XLK", name: "Technology Select SPDR", categoryId: "TECH", currency: "USD",
    quantity: 5, avgCostLocal: 185.0, usdFxRate: 1.08,
    marketValueUsd: 962.5, currentPriceLocal: 192.5,
    priceDate: "2026-05-15", priceSource: "YAHOO",
    marketValueEur: 891.2,
  },
];

const ALERTS_RESPONSE = {
  activeCount: 1,
  alerts: [
    {
      id: 1,
      createdAt: "2026-05-15T10:00:00Z",
      categoryId: "TECH",
      ruleId: "RRG_ENTERING_LEADING",
      severity: "INFO",
      message: "TECH entered Leading quadrant",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
  ],
};

const INGEST_RESPONSE = {
  runIds: ["00000000-0000-0000-0000-000000000001"],
  status: "queued",
  message: "Ingestion started",
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1:9999");
  const path = url.pathname;
  const parent = url.searchParams.get("parent");

  if (path === "/api/v1/categories/score-history") {
    const scores30 = [0.55,0.57,0.58,0.61,0.63,0.65,0.67,0.68,0.70,0.71,0.72,0.73,0.74,0.75,0.76,0.77,0.78,0.79,0.80,0.81,0.81,0.82,0.83,0.83,0.84,0.84,0.83,0.82,0.82,0.82];
    res.writeHead(200);
    res.end(JSON.stringify({
      TECH: scores30,
      HLTH: scores30.map(v => v * 0.78),
      ENRG: scores30.map(v => v * 0.38),
      GOLD: scores30.map(v => v * 0.55),
    }));
  } else if (path === "/api/v1/categories") {
    res.writeHead(200);
    res.end(JSON.stringify(CATEGORIES_RESPONSE));
  } else if (path === "/api/v1/macro") {
    res.writeHead(200);
    res.end(JSON.stringify(MACRO_RESPONSE));
  } else if (path === "/api/v1/rotation") {
    res.writeHead(200);
    res.end(JSON.stringify(ROTATION_RESPONSE));
  } else if (path === "/api/v1/rrg") {
    res.writeHead(200);
    res.end(JSON.stringify(RRG_RESPONSE));
  } else if (path === "/api/v1/sub-sectors") {
    if (parent === "TECH") {
      res.writeHead(200);
      res.end(JSON.stringify(TECH_SUB_SECTORS_RESPONSE));
    } else if (parent === "FTRS") {
      res.writeHead(200);
      res.end(JSON.stringify(FACTOR_ETF_RESPONSE));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify([]));
    }
  } else if (path === "/api/v1/portfolio" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(PORTFOLIO_RESPONSE));
  } else if (path === "/api/v1/portfolio" && req.method === "PUT") {
    res.writeHead(200);
    res.end(JSON.stringify(PORTFOLIO_RESPONSE));
  } else if (path === "/api/v1/portfolio/holdings" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(HOLDINGS_RESPONSE));
  } else if (path === "/api/v1/portfolio/holdings/template" && req.method === "GET") {
    res.setHeader("Content-Type", "text/csv");
    res.writeHead(200);
    res.end("ticker,name,currency,quantity,avg_cost_local\nAAPL,Apple Inc.,USD,10,175.00\n");
  } else if (path === "/api/v1/alerts" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(ALERTS_RESPONSE));
  } else if (/^\/api\/v1\/alerts\/\d+\/acknowledge$/.test(path) && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify({ ...ALERTS_RESPONSE.alerts[0], status: "ACKNOWLEDGED", acknowledgedAt: "2026-05-15T11:00:00Z" }));
  } else if (path === "/api/v1/ingest/trigger" && req.method === "POST") {
    res.writeHead(202);
    res.end(JSON.stringify(INGEST_RESPONSE));
  } else if (path === "/api/v1/backtest/recent") {
    res.writeHead(200);
    res.end(JSON.stringify([]));
  } else if (path === "/api/v1/admin/ticker-mappings" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify([
      { ticker: "XLK", categoryId: "TECH", notes: "Technology Select Sector SPDR", updatedAt: "2026-05-17T00:00:00Z" },
      { ticker: "XLF", categoryId: "FINL", notes: "Financial Select Sector SPDR", updatedAt: "2026-05-17T00:00:00Z" },
      { ticker: "GLD", categoryId: "GOLD", notes: "SPDR Gold Shares", updatedAt: "2026-05-17T00:00:00Z" },
    ]));
  } else if (path === "/api/v1/admin/ticker-mappings" && req.method === "POST") {
    const body = await new Promise((resolve) => {
      let data = ""; req.on("data", (c) => { data += c; }); req.on("end", () => resolve(JSON.parse(data)));
    });
    res.writeHead(200);
    res.end(JSON.stringify({ ticker: body.ticker, categoryId: body.categoryId, notes: body.notes ?? null, updatedAt: "2026-05-17T00:00:00Z" }));
  } else if (/^\/api\/v1\/admin\/ticker-mappings\/[^/]+$/.test(path) && req.method === "DELETE") {
    res.writeHead(204);
    res.end();
  } else if (path === "/api/v1/ingest/status/latest") {
    res.writeHead(200);
    res.end(JSON.stringify([
      { runId: "aaa-111", source: "PRICES", status: "SUCCESS", startedAt: "2026-05-15T06:00:00Z", finishedAt: "2026-05-15T06:05:30Z", rowsInserted: 1842 },
      { runId: "aaa-112", source: "MACRO",  status: "SUCCESS", startedAt: "2026-05-15T06:00:05Z", finishedAt: "2026-05-15T06:00:48Z", rowsInserted: 8 },
    ]));
  } else if (path === "/api/v1/backtest/run" && req.method === "POST") {
    const curve = [];
    for (let i = 0; i < 252; i++) {
      const date = new Date("2025-01-02");
      date.setDate(date.getDate() + i);
      curve.push({
        date: date.toISOString().split("T")[0],
        portfolioValue: 10000 * (1 + 0.185 * i / 252),
        spyValue: 10000 * (1 + 0.143 * i / 252),
      });
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      runId: "00000000-0000-0000-0000-000000000002",
      runAt: "2026-05-15T10:00:00Z",
      startDate: "2025-01-02",
      endDate: "2026-01-02",
      rebalanceFrequency: "MONTHLY",
      topN: 3,
      signalThreshold: null,
      totalReturnPct: 18.5,
      annualizedReturnPct: 18.5,
      maxDrawdownPct: 8.2,
      sharpeRatio: 1.42,
      spyTotalReturnPct: 14.3,
      spyAnnualizedReturnPct: 14.3,
      spyMaxDrawdownPct: 11.5,
      spySharpeRatio: 1.05,
      tradingDays: 252,
      equityCurve: curve,
      rebalanceHistory: [
        { date: "2025-02-03", categoryIds: ["TECH", "HLTH", "FINL"], portfolioValue: 10150 },
        { date: "2025-03-03", categoryIds: ["TECH", "COMM", "FINL"], portfolioValue: 10320 },
        { date: "2025-04-01", categoryIds: ["TECH", "HLTH", "COMM"], portfolioValue: 10580 },
      ],
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found", path }));
  }
});

const PORT = 9999;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-backend] listening on http://127.0.0.1:${PORT}`);
});
