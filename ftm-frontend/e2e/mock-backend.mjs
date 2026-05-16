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
      compositeScore: null,
      compositeTrend20d: null,
      rrgQuadrant: null,
      rs60: null,
      flow20d: null,
      persistence20d: null,
      rank: 1,
      latestClose: 192.5,
      priceDate: "2026-05-15",
    },
    {
      id: "HLTH",
      name: "Health Care",
      type: "EQUITY_SECTOR",
      etfTicker: "XLV",
      compositeScore: null,
      compositeTrend20d: null,
      rrgQuadrant: null,
      rs60: null,
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
      compositeScore: null,
      compositeTrend20d: null,
      rrgQuadrant: null,
      rs60: null,
      flow20d: null,
      persistence20d: null,
      rank: 3,
      latestClose: 87.4,
      priceDate: "2026-05-15",
    },
    {
      id: "GOLD",
      name: "Gold",
      type: "COMMODITY",
      etfTicker: "GLD",
      compositeScore: null,
      compositeTrend20d: null,
      rrgQuadrant: null,
      rs60: null,
      flow20d: null,
      persistence20d: null,
      rank: 4,
      latestClose: 310.2,
      priceDate: "2026-05-15",
    },
    {
      id: "CASH",
      name: "Cash & Short-Term",
      type: "FIXED_INCOME",
      etfTicker: "BIL",
      compositeScore: null,
      compositeTrend20d: null,
      rrgQuadrant: null,
      rs60: null,
      flow20d: null,
      persistence20d: null,
      rank: 5,
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
  },
  regimeHistory: [],
};

const INGEST_RESPONSE = {
  runIds: ["00000000-0000-0000-0000-000000000001"],
  status: "queued",
  message: "Ingestion started",
};

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = req.url?.split("?")[0] ?? "";

  if (path === "/categories") {
    res.writeHead(200);
    res.end(JSON.stringify(CATEGORIES_RESPONSE));
  } else if (path === "/macro") {
    res.writeHead(200);
    res.end(JSON.stringify(MACRO_RESPONSE));
  } else if (path === "/ingest/trigger" && req.method === "POST") {
    res.writeHead(202);
    res.end(JSON.stringify(INGEST_RESPONSE));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found", path }));
  }
});

const PORT = 9999;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-backend] listening on http://127.0.0.1:${PORT}`);
});
