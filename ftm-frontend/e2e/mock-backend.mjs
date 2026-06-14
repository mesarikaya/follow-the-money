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
      rrgQuadrant: "4",
      rs60: 0.031,
      rs120: 0.015,
      flow20d: 1.42,
      persistence20d: 16,
      rank: 1,
      latestClose: 192.5,
      priceDate: "2026-05-15",
      tradeSignal: "BUY",
      macroFit: 0.78,
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
      rrgQuadrant: "3",
      rs60: 0.015,
      rs120: 0.018,
      flow20d: null,
      persistence20d: null,
      rank: 2,
      latestClose: 145.3,
      priceDate: "2026-05-15",
      tradeSignal: "WATCH",
      macroFit: 0.63,
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
      rrgQuadrant: "1",
      rs60: -0.042,
      rs120: -0.030,
      flow20d: -1.18,
      persistence20d: 6,
      rank: 3,
      latestClose: 87.4,
      priceDate: "2026-05-15",
      tradeSignal: "REDUCE",
      macroFit: 0.48,
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
      rrgQuadrant: "4",
      rs60: 0.028,
      rs120: 0.020,
      flow20d: null,
      persistence20d: null,
      rank: 4,
      latestClose: 310.2,
      priceDate: "2026-05-15",
      tradeSignal: "WATCH",
      macroFit: 0.35,
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
      rrgQuadrant: "2",
      rs60: -0.018,
      rs120: -0.010,
      flow20d: null,
      persistence20d: null,
      rank: 5,
      latestClose: 88.6,
      priceDate: "2026-05-15",
      tradeSignal: "HOLD",
      macroFit: 0.28,
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
      tradeSignal: null,
      macroFit: null,
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
    { date: "2026-02-28", regime: "RISK_OFF_FLIGHT" },
    { date: "2026-03-07", regime: "RISK_OFF_FLIGHT" },
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
  { id: "SEMI", name: "Semiconductors",  parentId: "TECH", etfTicker: "SMH",  rs20: 1.08, rs60: 1.12, rs120: 1.15, momentum: 0.03, rrgQuadrant: "4", compositeScore: 0.84, compositeTrend5d: 0.05, compositeTrend20d: 0.09, scorePercentile252d: 0.92, tradeSignal: "BUY",  persistence5d: 4, persistence20d: 16, macroFit: 0.72, convictionScore: 88, signalDaysActive: 14 },
  { id: "AIRO", name: "AI & Robotics",   parentId: "TECH", etfTicker: "BOTZ", rs20: 1.05, rs60: 1.08, rs120: 1.10, momentum: 0.01, rrgQuadrant: "3", compositeScore: 0.71, compositeTrend5d: 0.02, compositeTrend20d: 0.04, scorePercentile252d: 0.75, tradeSignal: "WATCH", persistence5d: 3, persistence20d: 12, macroFit: 0.60, convictionScore: 71, signalDaysActive: 8 },
  { id: "CLOD", name: "Cloud Computing", parentId: "TECH", etfTicker: "WCLD", rs20: 0.98, rs60: 1.02, rs120: 1.04, momentum: -0.01, rrgQuadrant: "2", compositeScore: 0.55, compositeTrend5d: -0.03, compositeTrend20d: -0.05, scorePercentile252d: 0.48, tradeSignal: "HOLD",  persistence5d: 2, persistence20d: 9,  macroFit: 0.45, convictionScore: null, signalDaysActive: 3 },
  { id: "SOFT", name: "Software",        parentId: "TECH", etfTicker: "IGV",  rs20: 0.95, rs60: 0.97, rs120: 0.99, momentum: -0.02, rrgQuadrant: "1", compositeScore: 0.38, compositeTrend5d: -0.04, compositeTrend20d: -0.07, scorePercentile252d: 0.22, tradeSignal: "REDUCE", persistence5d: 1, persistence20d: 5, macroFit: 0.30, convictionScore: null, signalDaysActive: 5 },
];

const FACTOR_ETF_RESPONSE = [
  { id: "MTUM", name: "Momentum Factor",       parentId: "FTRS", etfTicker: "MTUM", rs20: 1.04, rs60: 1.07, rs120: 1.09, momentum: 0.02, rrgQuadrant: "4", compositeScore: 0.78, compositeTrend5d: 0.03, compositeTrend20d: 0.06, scorePercentile252d: 0.82, tradeSignal: "BUY",  persistence5d: 4, persistence20d: 15, macroFit: 0.68, convictionScore: 80, signalDaysActive: 12 },
  { id: "QUAL", name: "Quality Factor",        parentId: "FTRS", etfTicker: "QUAL", rs20: 1.02, rs60: 1.04, rs120: 1.06, momentum: 0.01, rrgQuadrant: "3", compositeScore: 0.65, compositeTrend5d: 0.01, compositeTrend20d: 0.02, scorePercentile252d: 0.70, tradeSignal: "WATCH", persistence5d: 3, persistence20d: 13, macroFit: 0.60, convictionScore: 65, signalDaysActive: 7 },
  { id: "USMV", name: "Low Volatility Factor", parentId: "FTRS", etfTicker: "USMV", rs20: 0.99, rs60: 1.01, rs120: 1.02, momentum: -0.01, rrgQuadrant: "2", compositeScore: 0.51, compositeTrend5d: -0.02, compositeTrend20d: -0.03, scorePercentile252d: 0.50, tradeSignal: "HOLD",  persistence5d: 2, persistence20d: 10, macroFit: 0.48, convictionScore: null, signalDaysActive: 4 },
  { id: "VLUE", name: "Value Factor",          parentId: "FTRS", etfTicker: "VLUE", rs20: 0.97, rs60: 0.99, rs120: 1.00, momentum: -0.02, rrgQuadrant: "1", compositeScore: 0.43, compositeTrend5d: -0.03, compositeTrend20d: -0.06, scorePercentile252d: 0.35, tradeSignal: "REDUCE", persistence5d: 1, persistence20d: 7, macroFit: 0.35, convictionScore: null, signalDaysActive: 6 },
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
  activeCount: 8,
  alerts: [
    {
      id: 1,
      createdAt: "2026-05-15T10:00:00Z",
      categoryId: "TECH",
      themeId: null,
      ruleId: "RRG_ENTERING_LEADING",
      severity: "INFO",
      message: "TECH entered Leading quadrant",
      triggerSnapshot: null,
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 2,
      createdAt: "2026-06-09T08:30:00Z",
      categoryId: null,
      themeId: "AI_INFRA",
      ruleId: "theme_5d_acceleration",
      severity: "ACTION",
      message: "AI Infrastructure theme momentum accelerating: 5d trend +11pt/day ahead of 20d — regime shift in progress",
      triggerSnapshot: "{\"themeId\":\"AI_INFRA\",\"delta5d20d\":0.0112,\"avg5d\":0.0250,\"avg20d\":0.0138}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 3,
      createdAt: "2026-06-09T08:30:00Z",
      categoryId: null,
      themeId: "CHIP_COMPUTE",
      ruleId: "theme_dominant_signal_transition",
      severity: "ACTION",
      message: "Semiconductor Supercycle dominant signal shifted WATCH → BUY (3/4 constituents bullish)",
      triggerSnapshot: "{\"themeId\":\"CHIP_COMPUTE\",\"fromSignal\":\"WATCH\",\"toSignal\":\"BUY\",\"bullishCount\":3}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 4,
      createdAt: "2026-06-08T14:15:00Z",
      categoryId: null,
      themeId: "SAAS_AT_RISK",
      ruleId: "theme_momentum_collapse",
      severity: "WARNING",
      message: "SaaS at Risk theme avg 20d trend -3.1pt — momentum collapsing, consider reducing exposure",
      triggerSnapshot: "{\"themeId\":\"SAAS_AT_RISK\",\"avgTrend20d\":-0.031}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 5,
      createdAt: "2026-06-10T09:00:00Z",
      categoryId: null,
      themeId: "CHIP_COMPUTE",
      ruleId: "theme_distribute_warning",
      severity: "WARNING",
      message: "Semiconductor Supercycle theme may be distributing: score 71 (BUY territory) but 20d flow -0.72σ — smart money exiting",
      triggerSnapshot: "{\"themeId\":\"CHIP_COMPUTE\",\"avgScore\":0.7100,\"avgFlow\":-0.72}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 7,
      createdAt: "2026-06-13T08:00:00Z",
      categoryId: null,
      themeId: "AI_INFRA",
      ruleId: "theme_strong_breakout_confirmation",
      severity: "ACTION",
      message: "AI_INFRA strong breakout confirmed: score 78 (was 61 20 days ago) — institutional follow-through above BUY threshold",
      triggerSnapshot: "{\"themeId\":\"AI_INFRA\",\"score\":0.7800,\"priorScore\":0.6100,\"signalDate\":\"2026-06-13\"}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 8,
      createdAt: "2026-06-13T09:30:00Z",
      categoryId: null,
      themeId: "DEFENSE_REARMAMENT",
      ruleId: "theme_peer_divergence",
      severity: "INFO",
      message: "DEFENSE_REARMAMENT internal rotation: INDU leads (score 72) while FINL lags (score 41) — spread of 31 pts suggests within-theme catch-up opportunity",
      triggerSnapshot: "{\"themeId\":\"DEFENSE_REARMAMENT\",\"leaderId\":\"INDU\",\"laggardId\":\"FINL\",\"spread\":0.3100,\"avgScore\":0.5600,\"signalDate\":\"2026-06-13\"}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
    {
      id: 6,
      createdAt: "2026-06-10T09:30:00Z",
      categoryId: null,
      themeId: "SAAS_AT_RISK",
      ruleId: "theme_recovery_signal",
      severity: "INFO",
      message: "SAAS_AT_RISK showing recovery: score 45, 5d trend +0.5pt/day (20d was negative 5 days ago) — early turn signal, watch for follow-through",
      triggerSnapshot: "{\"themeId\":\"SAAS_AT_RISK\",\"score\":0.4500,\"trend5d\":0.0050,\"priorTrend20d\":-0.0035,\"signalDate\":\"2026-06-10\"}",
      status: "ACTIVE",
      resolvedAt: null,
      acknowledgedAt: null,
    },
  ],
};

const ALERT_RULES_RESPONSE = [
  { ruleId: "rrg_transition",              enabled: true,  description: "Alert when a sector transitions RRG quadrant",                              lookbackDays: 5,  threshold: 0.65, severity: "ACTION"  },
  { ruleId: "composite_breakout",          enabled: true,  description: "Alert when composite score crosses 0.65 threshold",                        lookbackDays: 3,  threshold: 0.65, severity: "INFO"    },
  { ruleId: "rs_accel_crossover",          enabled: false, description: "Alert when 20-day RS acceleration crosses zero",                           lookbackDays: 10, threshold: 0.00, severity: "INFO"    },
  { ruleId: "macro_regime_shift",          enabled: true,  description: "Alert on macro regime change (rolling 4-week window)",                     lookbackDays: 28, threshold: 0.50, severity: "URGENT"  },
  { ruleId: "theme_5d_acceleration",       enabled: true,  description: "Theme 5d momentum accelerating above 20d trend",                          lookbackDays: 5,  threshold: null, severity: "ACTION"  },
  { ruleId: "theme_momentum_surge",        enabled: true,  description: "Theme avg 20d trend exceeds +0.010",                                       lookbackDays: 20, threshold: null, severity: "ACTION"  },
  { ruleId: "theme_momentum_collapse",     enabled: true,  description: "Theme avg 20d trend drops below -0.010",                                   lookbackDays: 20, threshold: null, severity: "WARNING" },
  { ruleId: "theme_distribute_warning",    enabled: true,  description: "Theme in BUY territory but flow turning negative",                         lookbackDays: 20, threshold: 0.65, severity: "WARNING" },
  { ruleId: "theme_phase_breakout_entry",  enabled: true,  description: "Theme transitioned into BREAKOUT phase from a lower phase",                lookbackDays: 5,  threshold: 0.65, severity: "ACTION"  },
  { ruleId: "theme_setup_acceleration",    enabled: true,  description: "Theme in SETUP phase with 5d momentum accelerating above 0.008/day",       lookbackDays: 5,  threshold: 0.65, severity: "ACTION"  },
  { ruleId: "theme_failed_breakout",       enabled: true,  description: "Theme score dropped from BUY zone (>=0.65) to below 0.57 within 5 days",  lookbackDays: 5,  threshold: 0.57, severity: "WARNING" },
  { ruleId: "theme_phase_fading",          enabled: true,  description: "Theme transitioned into FADING phase from a higher phase",                 lookbackDays: 5,  threshold: null, severity: "WARNING" },
  { ruleId: "theme_momentum_exhaustion",   enabled: true,  description: "BUY-zone theme showing negative 5d AND 20d trends simultaneously",         lookbackDays: 5,  threshold: 0.65, severity: "WARNING" },
  { ruleId: "theme_recovery_signal",           enabled: true,  description: "FADING/WEAK theme: score 35–55, 5d trend positive, 20d was negative 5d ago",        lookbackDays: 5,  threshold: null, severity: "INFO"   },
  { ruleId: "theme_strong_breakout_confirmation", enabled: true, description: "Theme score ≥ 0.70 AND was < 0.65 twenty trading days ago — institutional follow-through", lookbackDays: 20, threshold: 0.70, severity: "ACTION" },
  { ruleId: "theme_peer_divergence",             enabled: true, description: "≥3 theme constituents with signals and max−min spread >30 pts, avg score >0.40 — internal rotation", lookbackDays: null, threshold: 0.30, severity: "INFO" },
];

const INGEST_RESPONSE = {
  runIds: ["00000000-0000-0000-0000-000000000001"],
  status: "queued",
  message: "Ingestion started",
};

const WIN_RATES_RESPONSE = [
  { categoryId: "TECH", signalCount: 42, winRate: 0.74, avgReturn30d: 0.038 },
  { categoryId: "HLTH", signalCount: 31, winRate: 0.68, avgReturn30d: 0.021 },
  { categoryId: "ENRG", signalCount: 18, winRate: 0.44, avgReturn30d: -0.012 },
  { categoryId: "GOLD", signalCount: 24, winRate: 0.58, avgReturn30d: 0.015 },
  { categoryId: "TLTD", signalCount: 12, winRate: 0.50, avgReturn30d: 0.004 },
];

const PRICE_LEVELS_RESPONSE = [
  { categoryId: "TECH", currentPrice: 192.5, high52w: 205.0, low52w: 152.0, drawdownFromHigh: -0.061, positionInRange: 0.76, daysOfData: 252 },
  { categoryId: "HLTH", currentPrice: 145.3, high52w: 158.2, low52w: 127.4, drawdownFromHigh: -0.082, positionInRange: 0.58, daysOfData: 252 },
  { categoryId: "ENRG", currentPrice: 87.4,  high52w: 104.1, low52w: 78.2,  drawdownFromHigh: -0.160, positionInRange: 0.35, daysOfData: 252 },
  { categoryId: "GOLD", currentPrice: 310.2, high52w: 318.5, low52w: 264.0, drawdownFromHigh: -0.026, positionInRange: 0.84, daysOfData: 252 },
  { categoryId: "TLTD", currentPrice: 88.6,  high52w: 98.2,  low52w: 82.1,  drawdownFromHigh: -0.098, positionInRange: 0.41, daysOfData: 252 },
  { categoryId: "CASH", currentPrice: 91.1,  high52w: 91.5,  low52w: 90.8,  drawdownFromHigh: -0.004, positionInRange: 0.43, daysOfData: 252 },
];

const TRANSITIONS_RESPONSE = [
  { categoryId: "TECH", categoryName: "Information Technology", etfTicker: "XLK", previousSignal: "WATCH", currentSignal: "BUY",    currentScore: 0.82, comparisonDate: "2026-05-08", daysAgo: 7, scorePercentile252d: 0.88, macroFit: 0.78, signalDaysActive: 7, convictionScore: 85 },
  { categoryId: "ENRG", categoryName: "Energy",                 etfTicker: "XLE", previousSignal: "HOLD",  currentSignal: "REDUCE", currentScore: 0.31, comparisonDate: "2026-05-12", daysAgo: 3, scorePercentile252d: 0.18, macroFit: 0.48, signalDaysActive: 3, convictionScore: null },
];

const THEMES_RESPONSE = [
  {
    id: "AI_INFRA", name: "AI Infrastructure", thesis: "Capital flooding into AI compute: chips, data centers, and the power grid to run them.",
    constituentCount: 7, compositeScore: 0.78, rs60: 0.062, flow20d: 1.4, compositeTrend5d: 0.025, compositeTrend20d: 0.018,
    bullishCount: 5, dominantSignal: "BUY", divergenceFromParentSectors: 0.14, themePhase: "BREAKOUT",
    topConstituents: [
      { categoryId: "SEMI", parentCategoryId: "TECH", name: "Semiconductors", etfTicker: "SMH", compositeScore: 0.88, rs60: 0.09, flow20d: 1.8, compositeTrend20d: 0.025, tradeSignal: "BUY", convictionScore: 90 },
      { categoryId: "AIRO", parentCategoryId: "TECH", name: "AI & Robotics", etfTicker: "BOTZ", compositeScore: 0.82, rs60: 0.07, flow20d: 1.5, compositeTrend20d: 0.020, tradeSignal: "BUY", convictionScore: 82 },
      { categoryId: "TECH_AIQQ", parentCategoryId: "TECH", name: "Artificial Intelligence", etfTicker: "AIQ", compositeScore: 0.79, rs60: 0.06, flow20d: 1.2, compositeTrend20d: 0.015, tradeSignal: "BUY", convictionScore: 75 },
    ],
  },
  {
    id: "CHIP_COMPUTE", name: "Semiconductor Supercycle", thesis: "Secular demand for advanced chips across AI, EVs, and defense driving a multi-year capex supercycle.",
    constituentCount: 5, compositeScore: 0.72, rs60: 0.048, flow20d: 1.1, compositeTrend5d: 0.009, compositeTrend20d: 0.012,
    bullishCount: 3, dominantSignal: "WATCH", divergenceFromParentSectors: 0.09, themePhase: "MOMENTUM",
    topConstituents: [
      { categoryId: "SEMI", parentCategoryId: "TECH", name: "Semiconductors", etfTicker: "SMH", compositeScore: 0.88, rs60: 0.09, flow20d: 1.8, compositeTrend20d: 0.025, tradeSignal: "BUY", convictionScore: 90 },
      { categoryId: "AIRO", parentCategoryId: "TECH", name: "AI & Robotics", etfTicker: "BOTZ", compositeScore: 0.82, rs60: 0.07, flow20d: 1.5, compositeTrend20d: 0.020, tradeSignal: "BUY", convictionScore: 82 },
      { categoryId: "MATL_RARE", parentCategoryId: "MATL", name: "Rare Earth & Critical Minerals", etfTicker: "REMX", compositeScore: 0.58, rs60: 0.02, flow20d: 0.4, compositeTrend20d: 0.008, tradeSignal: "WATCH", convictionScore: 42 },
    ],
  },
  {
    id: "SAAS_AT_RISK", name: "SaaS at Risk", thesis: "Traditional SaaS models under pressure from AI-native disruptors. Watch for rotation away from legacy software.",
    constituentCount: 3, compositeScore: 0.41, rs60: -0.018, flow20d: -0.7, compositeTrend5d: -0.031, compositeTrend20d: -0.022,
    bullishCount: 0, dominantSignal: "REDUCE", divergenceFromParentSectors: -0.18, themePhase: "FADING",
    topConstituents: [
      { categoryId: "SOFT", parentCategoryId: "TECH", name: "Software", etfTicker: "IGV", compositeScore: 0.38, rs60: -0.03, flow20d: -0.9, compositeTrend20d: -0.028, tradeSignal: "REDUCE", convictionScore: null },
      { categoryId: "CLOD", parentCategoryId: "TECH", name: "Cloud Computing", etfTicker: "WCLD", compositeScore: 0.45, rs60: -0.01, flow20d: -0.5, compositeTrend20d: -0.018, tradeSignal: "HOLD", convictionScore: null },
      { categoryId: "COMM_SOCL", parentCategoryId: "COMM", name: "Social Media", etfTicker: "SOCL", compositeScore: 0.40, rs60: -0.02, flow20d: -0.7, compositeTrend20d: -0.020, tradeSignal: "HOLD", convictionScore: null },
    ],
  },
  {
    id: "DEFENSE_REARM", name: "Defense Rearmament", thesis: "European rearmament plus elevated US defense budgets driving a multi-year supercycle in defense contractors.",
    constituentCount: 4, compositeScore: 0.68, rs60: 0.041, flow20d: 0.8, compositeTrend5d: 0.015, compositeTrend20d: 0.009,
    bullishCount: 2, dominantSignal: "WATCH", divergenceFromParentSectors: 0.06, themePhase: "BREAKOUT",
    topConstituents: [
      { categoryId: "INDU_ADEF", parentCategoryId: "INDU", name: "Aerospace & Defense", etfTicker: "ITA", compositeScore: 0.74, rs60: 0.055, flow20d: 1.0, compositeTrend20d: 0.015, tradeSignal: "BUY", convictionScore: 68 },
      { categoryId: "INDU_PAVE", parentCategoryId: "INDU", name: "US Infrastructure", etfTicker: "PAVE", compositeScore: 0.66, rs60: 0.038, flow20d: 0.6, compositeTrend20d: 0.008, tradeSignal: "WATCH", convictionScore: 52 },
      { categoryId: "MATL_STEE", parentCategoryId: "MATL", name: "Steel", etfTicker: "SLX", compositeScore: 0.62, rs60: 0.029, flow20d: 0.7, compositeTrend20d: 0.005, tradeSignal: "WATCH", convictionScore: 44 },
    ],
  },
  {
    id: "CLEAN_POWER", name: "Clean Power Renaissance", thesis: "AI data center power demand plus decarbonization mandates channeling capital into nuclear, solar, and grid infrastructure.",
    constituentCount: 5, compositeScore: 0.58, rs60: 0.022, flow20d: 0.5, compositeTrend5d: 0.004, compositeTrend20d: 0.006,
    bullishCount: 2, dominantSignal: "WATCH", divergenceFromParentSectors: 0.03, themePhase: "BUILDING",
    topConstituents: [
      { categoryId: "ENRG_NUCL", parentCategoryId: "ENRG", name: "Nuclear Energy", etfTicker: "NLR", compositeScore: 0.71, rs60: 0.048, flow20d: 0.9, compositeTrend20d: 0.014, tradeSignal: "BUY", convictionScore: 62 },
      { categoryId: "ENRG_SOLR", parentCategoryId: "ENRG", name: "Solar Energy", etfTicker: "TAN", compositeScore: 0.55, rs60: 0.018, flow20d: 0.3, compositeTrend20d: 0.004, tradeSignal: "WATCH", convictionScore: 35 },
      { categoryId: "UTIL", parentCategoryId: "UTIL", name: "Utilities", etfTicker: "XLU", compositeScore: 0.52, rs60: 0.012, flow20d: 0.4, compositeTrend20d: 0.002, tradeSignal: "WATCH", convictionScore: 28 },
    ],
  },
  {
    id: "RATE_DURATION", name: "Rate Pivot & Duration Trade", thesis: "When the Fed signals easing, duration-sensitive assets front-run the rally. REITs, utilities, and investment-grade credit re-rate as real yields compress.",
    constituentCount: 5, compositeScore: 0.52, rs60: 0.008, flow20d: 0.3, compositeTrend5d: 0.006, compositeTrend20d: 0.004,
    bullishCount: 2, dominantSignal: "WATCH", divergenceFromParentSectors: 0.04, themePhase: "BUILDING",
    topConstituents: [
      { categoryId: "REIT", parentCategoryId: "REIT", name: "Real Estate", etfTicker: "XLRE", compositeScore: 0.59, rs60: 0.014, flow20d: 0.5, compositeTrend20d: 0.008, tradeSignal: "WATCH", convictionScore: 38 },
      { categoryId: "UTIL", parentCategoryId: "UTIL", name: "Utilities", etfTicker: "XLU", compositeScore: 0.52, rs60: 0.012, flow20d: 0.4, compositeTrend20d: 0.002, tradeSignal: "WATCH", convictionScore: 28 },
      { categoryId: "TLTD", parentCategoryId: null, name: "20yr Treasuries", etfTicker: "TLTD", compositeScore: 0.48, rs60: 0.002, flow20d: 0.2, compositeTrend20d: 0.002, tradeSignal: "HOLD", convictionScore: null },
    ],
  },
  {
    id: "COMMODITY_ELECTRIFICATION", name: "Commodity Supercycle & Electrification", thesis: "AI buildout, EV adoption, and de-globalization creating structural demand for copper, rare earths, and energy that supply cannot match.",
    constituentCount: 6, compositeScore: 0.61, rs60: 0.031, flow20d: 0.7, compositeTrend5d: 0.016, compositeTrend20d: 0.009,
    bullishCount: 3, dominantSignal: "WATCH", divergenceFromParentSectors: 0.07, themePhase: "SETUP",
    topConstituents: [
      { categoryId: "MATL_COPP", parentCategoryId: "MATL", name: "Copper Miners", etfTicker: "COPX", compositeScore: 0.68, rs60: 0.042, flow20d: 0.9, compositeTrend20d: 0.014, tradeSignal: "WATCH", convictionScore: 55 },
      { categoryId: "MATL_RARE", parentCategoryId: "MATL", name: "Rare Earth & Critical Minerals", etfTicker: "REMX", compositeScore: 0.65, rs60: 0.038, flow20d: 0.8, compositeTrend20d: 0.012, tradeSignal: "BUY", convictionScore: 51 },
      { categoryId: "INDU_ELEC", parentCategoryId: "INDU", name: "Smart Grid & Electrification", etfTicker: "GRID", compositeScore: 0.62, rs60: 0.028, flow20d: 0.6, compositeTrend20d: 0.010, tradeSignal: "WATCH", convictionScore: 46 },
    ],
  },
  {
    id: "PHYSICAL_AI_ROBOTICS", name: "Physical AI & Robotics", thesis: "AI leaving the server room. The next capital wave flows into industrial automation, smart grids, and robotics — the hardware layer of the AI productivity cycle.",
    constituentCount: 5, compositeScore: 0.70, rs60: 0.044, flow20d: 1.0, compositeTrend5d: 0.018, compositeTrend20d: 0.013,
    bullishCount: 3, dominantSignal: "WATCH", divergenceFromParentSectors: 0.08, themePhase: "MOMENTUM",
    topConstituents: [
      { categoryId: "AIRO", parentCategoryId: "TECH", name: "AI & Robotics", etfTicker: "BOTZ", compositeScore: 0.82, rs60: 0.07, flow20d: 1.5, compositeTrend20d: 0.020, tradeSignal: "BUY", convictionScore: 82 },
      { categoryId: "TECH_SMH", parentCategoryId: "TECH", name: "Semiconductors (VanEck)", etfTicker: "SMH", compositeScore: 0.76, rs60: 0.055, flow20d: 1.2, compositeTrend20d: 0.016, tradeSignal: "BUY", convictionScore: 74 },
      { categoryId: "TECH_IOTC", parentCategoryId: "TECH", name: "Internet of Things", etfTicker: "SNSR", compositeScore: 0.64, rs60: 0.032, flow20d: 0.7, compositeTrend20d: 0.009, tradeSignal: "WATCH", convictionScore: 50 },
    ],
  },
  {
    id: "HARD_ASSETS_GOLD", name: "Hard Assets & Precious Metals", thesis: "Central bank gold buying, de-dollarization pressure, and fiscal deficits have structurally re-priced gold. Miners provide leveraged exposure during geopolitical regime shifts.",
    constituentCount: 5, compositeScore: 0.74, rs60: 0.052, flow20d: 1.1, compositeTrend5d: 0.008, compositeTrend20d: 0.011,
    bullishCount: 4, dominantSignal: "BUY", divergenceFromParentSectors: 0.11, themePhase: "MOMENTUM",
    topConstituents: [
      { categoryId: "GOLD", parentCategoryId: null, name: "Gold", etfTicker: "GLD", compositeScore: 0.80, rs60: 0.065, flow20d: 1.3, compositeTrend20d: 0.015, tradeSignal: "BUY", convictionScore: 78 },
      { categoryId: "GDMN", parentCategoryId: null, name: "Gold Miners", etfTicker: "GDX", compositeScore: 0.76, rs60: 0.058, flow20d: 1.2, compositeTrend20d: 0.013, tradeSignal: "BUY", convictionScore: 72 },
      { categoryId: "MATL_GOLD", parentCategoryId: "MATL", name: "Gold Miners Senior", etfTicker: "GDX", compositeScore: 0.73, rs60: 0.050, flow20d: 1.0, compositeTrend20d: 0.010, tradeSignal: "BUY", convictionScore: 65 },
    ],
  },
  {
    id: "BIOTECH_WAVE", name: "Biotech Catalyst Cycle", thesis: "Rate normalization unlocks biotech funding. GLP-1 drug dominance, genomic medicine, and an FDA pipeline backlog are converging on a multi-year biotech upcycle. Capital flows back into speculative biopharma as the cost-of-capital tailwind returns.",
    constituentCount: 5, compositeScore: 0.58, rs60: 0.022, flow20d: 0.6, compositeTrend5d: 0.014, compositeTrend20d: 0.008,
    bullishCount: 3, dominantSignal: "WATCH", divergenceFromParentSectors: 0.06, themePhase: "SETUP",
    topConstituents: [
      { categoryId: "HLTH_BIOT", parentCategoryId: "HLTH", name: "Biotech SPDR", etfTicker: "XBI", compositeScore: 0.66, rs60: 0.035, flow20d: 0.9, compositeTrend20d: 0.012, tradeSignal: "BUY", convictionScore: 60 },
      { categoryId: "HLTH_BIOI", parentCategoryId: "HLTH", name: "Biotech iShares", etfTicker: "IBB", compositeScore: 0.62, rs60: 0.028, flow20d: 0.7, compositeTrend20d: 0.009, tradeSignal: "WATCH", convictionScore: 52 },
      { categoryId: "HLTH_GNOM", parentCategoryId: "HLTH", name: "Genomic Revolution", etfTicker: "ARKG", compositeScore: 0.55, rs60: 0.018, flow20d: 0.5, compositeTrend20d: 0.007, tradeSignal: "WATCH", convictionScore: 44 },
    ],
  },
  {
    id: "FINANCIAL_ROTATION", name: "Financial Services Rotation", thesis: "Rate normalization expands bank net interest margins while fintech platforms capture fee revenue. The question is who benefits as yield curves normalize — traditional banks rebuilding NIM or fintechs absorbing displaced deposits.",
    constituentCount: 4, compositeScore: 0.62, rs60: 0.028, flow20d: 0.4, compositeTrend5d: 0.006, compositeTrend20d: 0.004,
    bullishCount: 3, dominantSignal: "WATCH", divergenceFromParentSectors: 0.04, themePhase: "BUILDING",
    topConstituents: [
      { categoryId: "FINL_BANK", parentCategoryId: "FINL", name: "Banks SPDR", etfTicker: "KBE", compositeScore: 0.68, rs60: 0.038, flow20d: 0.6, compositeTrend20d: 0.007, tradeSignal: "BUY", convictionScore: 58 },
      { categoryId: "FINL_KBWB", parentCategoryId: "FINL", name: "KBW Banking ETF", etfTicker: "KBWB", compositeScore: 0.64, rs60: 0.032, flow20d: 0.5, compositeTrend20d: 0.005, tradeSignal: "BUY", convictionScore: 54 },
      { categoryId: "FINL_FINT", parentCategoryId: "FINL", name: "Fintech & Payments", etfTicker: "FINX", compositeScore: 0.58, rs60: 0.020, flow20d: 0.2, compositeTrend20d: 0.003, tradeSignal: "WATCH", convictionScore: 42 },
    ],
  },
  {
    id: "RESHORING_CYCLE", name: "US Manufacturing Renaissance", thesis: "IRA, CHIPS Act, and elevated defense budgets are funding the biggest domestic capital expenditure cycle in a generation. Industrial, infrastructure, and construction firms are the picks-and-shovels of American re-industrialization.",
    constituentCount: 4, compositeScore: 0.71, rs60: 0.040, flow20d: 0.8, compositeTrend5d: 0.010, compositeTrend20d: 0.007,
    bullishCount: 4, dominantSignal: "BUY", divergenceFromParentSectors: 0.09, themePhase: "MOMENTUM",
    topConstituents: [
      { categoryId: "INDU_AIRR", parentCategoryId: "INDU", name: "American Industrial Renaissance", etfTicker: "AIRR", compositeScore: 0.78, rs60: 0.055, flow20d: 1.1, compositeTrend20d: 0.011, tradeSignal: "BUY", convictionScore: 72 },
      { categoryId: "INDU_PAVE", parentCategoryId: "INDU", name: "US Infrastructure", etfTicker: "PAVE", compositeScore: 0.74, rs60: 0.046, flow20d: 0.9, compositeTrend20d: 0.008, tradeSignal: "BUY", convictionScore: 66 },
      { categoryId: "INDU_ROAD", parentCategoryId: "INDU", name: "Construction & Engineering", etfTicker: "ROAD", compositeScore: 0.68, rs60: 0.036, flow20d: 0.7, compositeTrend20d: 0.006, tradeSignal: "BUY", convictionScore: 58 },
    ],
  },
];

function generateThemeHistory(baseScore, days) {
  const scores = [];
  for (let i = days - 1; i >= 0; i--) {
    const trend = (days - i) / days * 0.08 - 0.04;
    const noise = Math.sin(i * 0.5) * 0.03;
    scores.push(Math.max(0.1, Math.min(0.99, baseScore + trend + noise)));
  }
  return scores.map((score, idx) => {
    const date = new Date("2026-05-15");
    date.setDate(date.getDate() - (days - 1 - idx));
    const trend5d = idx >= 5 ? (scores[idx] - scores[idx - 5]) / 5 : null;
    const trend20d = idx >= 20 ? (scores[idx] - scores[idx - 20]) / 20 : null;
    return {
      date: date.toISOString().split("T")[0],
      compositeScore: Math.round(score * 1000) / 1000,
      trend5d: trend5d != null ? Math.round(trend5d * 10000) / 10000 : null,
      trend20d: trend20d != null ? Math.round(trend20d * 10000) / 10000 : null,
    };
  });
}

function generateMacroHistory(days) {
  const indicators = ["vix", "tenYearYield", "fedFundsRate", "usdIndex", "wtiCrudeOilPrice"];
  const bases = { vix: 15.2, tenYearYield: 4.5, fedFundsRate: 5.25, usdIndex: 104.5, wtiCrudeOilPrice: 78.5 };
  const result = {};
  for (const ind of indicators) {
    result[ind] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date("2026-05-15");
      date.setDate(date.getDate() - i);
      const noise = (Math.sin(i * 0.3) * 0.5 + Math.cos(i * 0.1) * 0.3) * (bases[ind] * 0.03);
      result[ind].push({ date: date.toISOString().split("T")[0], value: Math.round((bases[ind] + noise) * 100) / 100 });
    }
  }
  return result;
}

function generateSignalHistory(categoryId, days) {
  const signalTypes = ["COMPOSITE", "RS_60", "RS_20", "MOM", "FLOW_20D"];
  const baseValues = { TECH: 0.82, HLTH: 0.64, ENRG: 0.31, GOLD: 0.71, TLTD: 0.38, CASH: null };
  const base = baseValues[categoryId] ?? 0.5;
  const entries = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date("2026-05-15");
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    for (const signalType of signalTypes) {
      const noise = (Math.random() - 0.5) * 0.1;
      entries.push({ signalDate: dateStr, signalType, value: Math.max(0, Math.min(1, base + noise)), computedAt: dateStr + "T06:00:00Z" });
    }
  }
  return entries;
}

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

  if (path === "/api/v1/alerts/active/count") {
    res.writeHead(200);
    res.end(JSON.stringify({ active: 1 }));
  } else if (path === "/api/v1/categories/win-rates") {
    res.writeHead(200);
    res.end(JSON.stringify(WIN_RATES_RESPONSE));
  } else if (path === "/api/v1/categories/price-levels") {
    res.writeHead(200);
    res.end(JSON.stringify(PRICE_LEVELS_RESPONSE));
  } else if (path === "/api/v1/categories/transitions") {
    res.writeHead(200);
    res.end(JSON.stringify(TRANSITIONS_RESPONSE));
  } else if (path === "/api/v1/macro/history") {
    const days = parseInt(url.searchParams.get("days") ?? "90", 10);
    res.writeHead(200);
    res.end(JSON.stringify(generateMacroHistory(Math.min(days, 90))));
  } else if (/^\/api\/v1\/signals\/[^/]+$/.test(path)) {
    const catId = path.split("/").at(-1).toUpperCase();
    const days = parseInt(url.searchParams.get("days") ?? "90", 10);
    res.writeHead(200);
    res.end(JSON.stringify(generateSignalHistory(catId, Math.min(days, 90))));
  } else if (path === "/api/v1/portfolio/holdings/refresh-prices" && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify({ updated: 2 }));
  } else if (path === "/api/v1/portfolio/holdings/upload" && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify({ imported: 2, skipped: 0 }));
  } else if (path === "/api/v1/backtest/sweep" && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify([]));
  } else if (path === "/api/v1/backtest/frequency-sweep" && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify([]));
  } else if (path === "/api/v1/alerts/bulk-dismiss" && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify({ dismissed: 1 }));
  } else if (path === "/api/v1/categories/seasonal") {
    res.writeHead(200);
    res.end(JSON.stringify([
      { categoryId: "TECH", month: 1,  avgReturn: 0.0312, sampleCount: 5 },
      { categoryId: "TECH", month: 6,  avgReturn: -0.0145, sampleCount: 5 },
      { categoryId: "HLTH", month: 3,  avgReturn: 0.0210, sampleCount: 4 },
      { categoryId: "ENRG", month: 6,  avgReturn: 0.0180, sampleCount: 6 },
    ]));
  } else if (path === "/api/v1/categories/score-history") {
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
  } else if (path === "/api/v1/themes") {
    res.writeHead(200);
    res.end(JSON.stringify(THEMES_RESPONSE));
  } else if (/^\/api\/v1\/themes\/[A-Z0-9_]+\/history$/.test(path)) {
    const themeId = path.split("/").at(-2);
    const theme = THEMES_RESPONSE.find(t => t.id === themeId);
    if (theme) {
      const days = parseInt(url.searchParams.get("days") ?? "30", 10);
      res.writeHead(200);
      res.end(JSON.stringify(generateThemeHistory(theme.compositeScore ?? 0.5, days)));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ detail: "Theme not found" }));
    }
  } else if (/^\/api\/v1\/themes\/[A-Z0-9_]+$/.test(path)) {
    const themeId = path.split("/").at(-1);
    const theme = THEMES_RESPONSE.find(t => t.id === themeId);
    if (theme) {
      res.writeHead(200);
      res.end(JSON.stringify({ ...theme, constituents: theme.topConstituents }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ detail: "Theme not found" }));
    }
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
  } else if (path === "/api/v1/alerts/recent" && req.method === "GET") {
    const recentEvents = [
      ...ALERTS_RESPONSE.alerts,
      { id: 85, createdAt: "2026-06-03T08:00:00Z", categoryId: null, themeId: "AI_INFRA", ruleId: "theme_phase_breakout_entry", severity: "ACTION", message: "AI_INFRA theme entered BREAKOUT phase (was SETUP): score 68", triggerSnapshot: null, status: "RESOLVED", resolvedAt: "2026-06-08T10:00:00Z", acknowledgedAt: null },
      { id: 86, createdAt: "2026-06-02T12:00:00Z", categoryId: null, themeId: "CHIP_COMPUTE", ruleId: "theme_momentum_surge", severity: "WARNING", message: "CHIP_COMPUTE momentum surge: 20d trend +1.2pt/day", triggerSnapshot: null, status: "ACKNOWLEDGED", resolvedAt: null, acknowledgedAt: "2026-06-02T14:00:00Z" },
      { id: 87, createdAt: "2026-06-05T10:00:00Z", categoryId: null, themeId: "SAAS_AT_RISK", ruleId: "theme_setup_acceleration", severity: "ACTION", message: "SAAS_AT_RISK setup acceleration: 5d trend +0.9pt/day while in SETUP zone (score 58)", triggerSnapshot: null, status: "RESOLVED", resolvedAt: "2026-06-09T08:00:00Z", acknowledgedAt: null },
      { id: 88, createdAt: "2026-06-07T09:00:00Z", categoryId: null, themeId: "SAAS_AT_RISK", ruleId: "theme_phase_fading", severity: "WARNING", message: "SAAS_AT_RISK entered FADING phase (score dropped to 41, 5d trend -3.1pt/day)", triggerSnapshot: null, status: "ACTIVE", resolvedAt: null, acknowledgedAt: null },
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 30);
    res.writeHead(200);
    res.end(JSON.stringify(recentEvents));
  } else if (path === "/api/v1/alerts" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(ALERTS_RESPONSE));
  } else if (path === "/api/v1/alerts/rules" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(ALERT_RULES_RESPONSE));
  } else if (/^\/api\/v1\/alerts\/rules\/[^/]+\/enabled$/.test(path) && req.method === "PUT") {
    const ruleId = path.split("/").at(-2);
    const enabled = url.searchParams.get("enabled") === "true";
    const rule = ALERT_RULES_RESPONSE.find(r => r.ruleId === ruleId) ?? ALERT_RULES_RESPONSE[0];
    res.writeHead(200);
    res.end(JSON.stringify({ ...rule, enabled }));
  } else if (/^\/api\/v1\/alerts\/\d+\/acknowledge$/.test(path) && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify({ ...ALERTS_RESPONSE.alerts[0], status: "ACKNOWLEDGED", acknowledgedAt: "2026-05-15T11:00:00Z" }));
  } else if (/^\/api\/v1\/alerts\/theme\/[^/]+$/.test(path) && req.method === "GET") {
    const themeId = path.split("/").at(-1).toUpperCase();
    const sharedHistory = [
      {
        id: 90,
        createdAt: "2026-06-01T09:00:00Z",
        categoryId: null,
        themeId: themeId,
        ruleId: "theme_composite_breakout",
        severity: "ACTION",
        message: `${themeId} composite crossed 65 threshold — breakout confirmed`,
        triggerSnapshot: null,
        status: "RESOLVED",
        resolvedAt: "2026-06-05T14:30:00Z",
        acknowledgedAt: null,
      },
      {
        id: 91,
        createdAt: "2026-05-28T11:15:00Z",
        categoryId: null,
        themeId: themeId,
        ruleId: "theme_5d_acceleration",
        severity: "WARNING",
        message: `${themeId} 5-day momentum decelerated`,
        triggerSnapshot: null,
        status: "ACKNOWLEDGED",
        resolvedAt: null,
        acknowledgedAt: "2026-05-28T12:00:00Z",
      },
    ];
    const saasHistory = themeId === "SAAS_AT_RISK" ? [
      {
        id: 92,
        createdAt: "2026-06-07T09:00:00Z",
        categoryId: null,
        themeId: "SAAS_AT_RISK",
        ruleId: "theme_phase_fading",
        severity: "WARNING",
        message: "SAAS_AT_RISK entered FADING phase (score dropped to 41, 5d trend -3.1pt/day)",
        triggerSnapshot: null,
        status: "RESOLVED",
        resolvedAt: "2026-06-10T09:00:00Z",
        acknowledgedAt: null,
      },
      {
        id: 93,
        createdAt: "2026-06-10T09:30:00Z",
        categoryId: null,
        themeId: "SAAS_AT_RISK",
        ruleId: "theme_recovery_signal",
        severity: "INFO",
        message: "SAAS_AT_RISK showing recovery: score 45, 5d trend +0.5pt/day (20d was negative 5 days ago) — early turn signal, watch for follow-through",
        triggerSnapshot: null,
        status: "RESOLVED",
        resolvedAt: "2026-06-13T08:00:00Z",
        acknowledgedAt: null,
      },
    ] : [];
    const themeHistory = [
      ...ALERTS_RESPONSE.alerts.filter(a => a.themeId === themeId),
      ...sharedHistory,
      ...saasHistory,
    ];
    res.writeHead(200);
    res.end(JSON.stringify(themeHistory));
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
