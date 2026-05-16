const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080";

export type CategorySummary = {
  id: string;
  name: string;
  type: string;
  etfTicker: string;
  compositeScore: number | null;
  compositeTrend20d: number | null;
  rrgQuadrant: string | null;
  rs60: number | null;
  flow20d: number | null;
  persistence20d: number | null;
  rank: number;
  latestClose: number | null;
  priceDate: string | null;
};

export type CategoriesResponse = {
  asOfDate: string;
  timeframe: string;
  categories: CategorySummary[];
};

export type MacroIndicators = {
  yieldSpread10y2y: number | null;
  vix: number | null;
  usdIndex: number | null;
  breakevenInflation: number | null;
  fedFundsRate: number | null;
  tenYearYield: number | null;
  twoYearYield: number | null;
};

export type MacroResponse = {
  asOfDate: string | null;
  regime: string;
  indicators: MacroIndicators;
  regimeHistory: { date: string; regime: string }[];
};

export type RrgTrailPoint = {
  date: string;
  ratio: number;
  momentum: number;
};

export type RrgCategoryEntry = {
  id: string;
  name: string;
  color: string;
  quadrant: number;
  trail: RrgTrailPoint[];
};

export type RrgResponse = {
  date: string;
  categories: RrgCategoryEntry[];
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export type RotationLeaderEntry = {
  categoryId: string;
  categoryName: string;
  compositeScore: number | null;
  relativeStrength60Day: number | null;
  relativeRotationGraphQuadrant: number | null;
};

export type RotationEventEntry = {
  detectedDate: string;
  categoryId: string;
  categoryName: string;
  eventType: string;
  confidence: number;
  notes: string;
};

export type RotationResponse = {
  asOfDate: string;
  topLeaders: RotationLeaderEntry[];
  bottomLaggards: RotationLeaderEntry[];
  recentEvents: RotationEventEntry[];
};

export type PortfolioAllocationEntry = {
  categoryId: string;
  categoryName: string;
  allocationPct: number;
  compositeScore: number | null;
  optimalAllocationPct: number | null;
};

export type RebalanceSuggestion = {
  categoryId: string;
  categoryName: string;
  action: "INCREASE" | "DECREASE";
  currentAllocationPct: number;
  optimalAllocationPct: number;
  deltaPct: number;
};

export type PortfolioResponse = {
  allocations: PortfolioAllocationEntry[];
  alignmentScore: number;
  alignmentLabel: "ALIGNED" | "PARTIAL" | "MISALIGNED";
  rebalanceSuggestions: RebalanceSuggestion[];
};

export type PortfolioSaveRequest = {
  categoryId: string;
  allocationPct: number;
}[];

export const fetchCategories = (timeframe = "MONTH") =>
  get<CategoriesResponse>(`/api/v1/categories?timeframe=${timeframe}`);

export const fetchMacro = () => get<MacroResponse>("/api/v1/macro");

export const fetchRrg = () => get<RrgResponse>("/api/v1/rrg");

export const fetchRotation = () => get<RotationResponse>("/api/v1/rotation");

export type AlertDto = {
  id: number;
  createdAt: string;
  categoryId: string | null;
  ruleId: string;
  severity: "INFO" | "WARNING" | "ACTION";
  message: string;
  status: "ACTIVE" | "RESOLVED" | "ACKNOWLEDGED";
  resolvedAt: string | null;
  acknowledgedAt: string | null;
};

export type AlertsResponse = {
  activeCount: number;
  alerts: AlertDto[];
};

export const fetchPortfolio = () => get<PortfolioResponse>("/api/v1/portfolio");

export const savePortfolio = (entries: PortfolioSaveRequest) =>
  fetch(`${BACKEND}/api/v1/portfolio`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`PUT /api/v1/portfolio → ${res.status}`);
    return res.json() as Promise<PortfolioResponse>;
  });

export type EquityCurvePoint = {
  date: string;
  portfolioValue: number;
  spyValue: number;
};

export type BacktestResult = {
  runId: string;
  runAt: string;
  startDate: string;
  endDate: string;
  rebalanceFrequency: string;
  topN: number;
  signalThreshold: number | null;
  totalReturnPct: number;
  annualizedReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  spyTotalReturnPct: number;
  spySharpeRatio: number;
  tradingDays: number;
  equityCurve: EquityCurvePoint[];
};

export type BacktestRequest = {
  startDate: string;
  endDate: string;
  rebalanceFrequency: "WEEKLY" | "MONTHLY";
  topN: number;
  signalThreshold?: number;
};

export const runBacktest = (request: BacktestRequest) =>
  fetch(`${BACKEND}/api/v1/backtest/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `POST /api/v1/backtest/run → ${res.status}`);
    }
    return res.json() as Promise<BacktestResult>;
  });

export const fetchRecentBacktests = () => get<BacktestResult[]>("/api/v1/backtest/recent");

export const fetchAlerts = () => get<AlertsResponse>("/api/v1/alerts");

export const acknowledgeAlert = (alertId: number) =>
  fetch(`${BACKEND}/api/v1/alerts/${alertId}/acknowledge`, {
    method: "POST",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`POST /api/v1/alerts/${alertId}/acknowledge → ${res.status}`);
    return res.json() as Promise<AlertDto>;
  });
