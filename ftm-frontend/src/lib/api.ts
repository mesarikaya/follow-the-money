const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.BACKEND_URL ??
  "http://localhost:8080";

export type CategorySummary = {
  id: string;
  name: string;
  type: string;
  etfTicker: string;
  compositeScore: number | null;
  compositeTrend5d: number | null;
  compositeTrend10d: number | null;
  compositeTrend20d: number | null;
  rrgQuadrant: string | null;
  rs60: number | null;
  rs120: number | null;
  flow20d: number | null;
  persistence20d: number | null;
  rank: number;
  latestClose: number | null;
  priceDate: string | null;
  tradeSignal: string | null;
  macroFit: number | null;
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
  wtiCrudeOilPrice: number | null;
};

export type MacroResponse = {
  asOfDate: string | null;
  regime: string;
  indicators: MacroIndicators;
  previousIndicators: MacroIndicators | null;
  regimeHistory: { date: string; regime: string }[];
  macroFitByCategory: Record<string, number> | null;
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

export type SubSectorSummary = {
  id: string;
  name: string;
  parentId: string;
  etfTicker: string;
  rs20: number | null;
  rs60: number | null;
  rs120: number | null;
  momentum: number | null;
  rrgQuadrant: string | null;
  compositeScore: number | null;
  compositeTrend5d: number | null;
  compositeTrend20d: number | null;
  tradeSignal: string | null;
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
  categoryType: string;
  allocationPct: number;
  compositeScore: number | null;
  optimalAllocationPct: number | null;
  tradeSignal: string | null;
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

export const fetchCategoryScoreHistory = (days = 30) =>
  get<Record<string, number[]>>(`/api/v1/categories/score-history?days=${days}`);

export const fetchMacro = () => get<MacroResponse>("/api/v1/macro");

export const fetchRrg = () => get<RrgResponse>("/api/v1/rrg");

export const fetchRotation = () => get<RotationResponse>("/api/v1/rotation");

export type AlertDto = {
  id: number;
  createdAt: string;
  categoryId: string | null;
  ruleId: string;
  severity: "INFO" | "WARNING" | "ACTION" | "URGENT";
  message: string;
  triggerSnapshot: string | null;
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

export type RebalanceEvent = {
  date: string;
  categoryIds: string[];
  portfolioValue: number;
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
  spyAnnualizedReturnPct: number | null;
  spyMaxDrawdownPct: number | null;
  spySharpeRatio: number;
  tradingDays: number;
  equityCurve: EquityCurvePoint[];
  rebalanceHistory: RebalanceEvent[];
};

export type BacktestRequest = {
  startDate: string;
  endDate: string;
  rebalanceFrequency: "WEEKLY" | "MONTHLY" | "QUARTERLY";
  topN: number;
  signalThreshold?: number;
  categoryScope?: "ALL" | "EQUITY_SECTORS_ONLY" | "TOP_LEVEL_ONLY";
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

export type AlertRuleDto = {
  ruleId: string;
  enabled: boolean;
  severity: "INFO" | "WARNING" | "ACTION" | "URGENT";
  compositeThreshold: number | null;
  persistenceDays: number | null;
};

export const fetchAlertRules = () => get<AlertRuleDto[]>("/api/v1/alerts/rules");

export const setAlertRuleEnabled = (ruleId: string, enabled: boolean) =>
  fetch(`${BACKEND}/api/v1/alerts/rules/${encodeURIComponent(ruleId)}/enabled?enabled=${enabled}`, {
    method: "PUT",
  }).then(async res => {
    if (!res.ok) throw new Error(`PUT /api/v1/alerts/rules/${ruleId}/enabled → ${res.status}`);
    return res.json() as Promise<AlertRuleDto>;
  });

export type IngestStatusEntry = {
  runId: string;
  source: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  rowsInserted: number | null;
};

export const fetchLatestIngestStatus = () => get<IngestStatusEntry[]>("/api/v1/ingest/status/latest");

export type HoldingDto = {
  ticker: string;
  name: string | null;
  categoryId: string | null;
  currency: string;
  quantity: number;
  avgCostLocal: number | null;
  usdFxRate: number | null;
  marketValueUsd: number | null;
  currentPriceLocal: number | null;
  priceDate: string | null;
  priceSource: string | null;
  marketValueEur: number | null;
};

export type HoldingsUploadResponse = {
  totalAccepted: number;
  unclassifiedTickers: string[];
  totalMarketValueUsd: number | null;
  usdPerEurRateUsed: number | null;
  totalMarketValueEur: number | null;
  holdings: HoldingDto[];
};

export type HoldingUpdateRequest = {
  quantity: number;
  avgCostLocal?: number;
  currentPriceLocal?: number;
};

export type CreateHoldingRequest = {
  ticker: string;
  name?: string;
  categoryId?: string;
  currency: string;
  quantity: number;
  avgCostLocal?: number;
};

export const fetchHoldings = () => get<HoldingDto[]>("/api/v1/portfolio/holdings");

export const createHolding = (request: CreateHoldingRequest): Promise<HoldingDto> =>
  fetch(`${BACKEND}/api/v1/portfolio/holdings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? body.message ?? `POST /portfolio/holdings → ${res.status}`);
    }
    return res.json() as Promise<HoldingDto>;
  });

export const downloadHoldingsTemplate = () =>
  fetch(`${BACKEND}/api/v1/portfolio/holdings/template`, { cache: "no-store" });

export const uploadHoldings = (file: File): Promise<HoldingsUploadResponse> => {
  const form = new FormData();
  form.append("file", file);
  return fetch(`${BACKEND}/api/v1/portfolio/holdings/upload`, {
    method: "POST",
    body: form,
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<HoldingsUploadResponse>;
  });
};

export const refreshHoldingPrices = (): Promise<HoldingDto[]> =>
  fetch(`${BACKEND}/api/v1/portfolio/holdings/refresh-prices`, {
    method: "POST",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`POST /portfolio/holdings/refresh-prices → ${res.status}`);
    return res.json() as Promise<HoldingDto[]>;
  });

export const updateHolding = (ticker: string, request: HoldingUpdateRequest): Promise<HoldingDto> => {
  const encoded = encodeURIComponent(ticker);
  return fetch(`${BACKEND}/api/v1/portfolio/holdings/${encoded}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`PATCH /portfolio/holdings/${ticker} → ${res.status}`);
    return res.json() as Promise<HoldingDto>;
  });
};

export const deleteHolding = (ticker: string): Promise<void> => {
  const encoded = encodeURIComponent(ticker);
  return fetch(`${BACKEND}/api/v1/portfolio/holdings/${encoded}`, {
    method: "DELETE",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`DELETE /portfolio/holdings/${ticker} → ${res.status}`);
  });
};

export const acknowledgeAlert = (alertId: number) =>
  fetch(`${BACKEND}/api/v1/alerts/${alertId}/acknowledge`, {
    method: "POST",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`POST /api/v1/alerts/${alertId}/acknowledge → ${res.status}`);
    return res.json() as Promise<AlertDto>;
  });

export const fetchSubSectors = (parent = "TECH") =>
  get<SubSectorSummary[]>(`/api/v1/sub-sectors?parent=${parent}`);

export type TickerMappingDto = {
  ticker: string;
  categoryId: string;
  notes: string | null;
  updatedAt: string;
};

export type TickerMappingRequest = {
  ticker: string;
  categoryId: string;
  notes?: string;
};

export const fetchTickerMappings = () =>
  get<TickerMappingDto[]>("/api/v1/admin/ticker-mappings");

export const upsertTickerMapping = (request: TickerMappingRequest): Promise<TickerMappingDto> =>
  fetch(`${BACKEND}/api/v1/admin/ticker-mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `POST /api/v1/admin/ticker-mappings → ${res.status}`);
    }
    return res.json() as Promise<TickerMappingDto>;
  });

export const deleteTickerMapping = (ticker: string): Promise<void> =>
  fetch(`${BACKEND}/api/v1/admin/ticker-mappings/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`DELETE /api/v1/admin/ticker-mappings/${ticker} → ${res.status}`);
  });
