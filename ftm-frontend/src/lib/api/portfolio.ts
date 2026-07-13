import { BACKEND, get } from "./http";

/** The target allocation, the holdings behind it, and the actions they imply. */

export type PortfolioAllocationEntry = {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  allocationPct: number;
  compositeScore: number | null;
  momentumPct: number | null;
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
  tradeSignal: string | null;
  compositeScorePct: number | null;
  momentumPct: number | null;
  signalAligned: boolean;
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

export type PortfolioSelectionUniverse = "EQUITY_SECTORS" | "ALL_TOP_LEVEL";

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

export type PortfolioSnapshot = {
  snapshotDate: string;
  totalValueEur: number;
  totalCostEur: number | null;
  holdingCount: number;
};

export type HoldingActionDto = {
  ticker: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  signal: string | null;
  convictionScore: number | null;
  action: "EXIT" | "TRIM" | "WATCH" | "HOLD" | "UNCLASSIFIED";
  rationale: string;
  portfolioPct: number | null;
  urgency: number;
};

export const fetchPortfolio = (selectionUniverse: PortfolioSelectionUniverse = "EQUITY_SECTORS") =>
  get<PortfolioResponse>(`/api/v1/portfolio?selectionUniverse=${selectionUniverse}`);

export const savePortfolio = (
  entries: PortfolioSaveRequest,
  selectionUniverse: PortfolioSelectionUniverse = "EQUITY_SECTORS",
) =>
  fetch(`${BACKEND}/api/v1/portfolio?selectionUniverse=${selectionUniverse}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`PUT /api/v1/portfolio → ${res.status}`);
    return res.json() as Promise<PortfolioResponse>;
  });

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

export const fetchPortfolioSnapshots = (days = 90): Promise<PortfolioSnapshot[]> =>
  fetch(`${BACKEND}/api/v1/portfolio/holdings/snapshots?days=${days}`, {
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`GET /portfolio/holdings/snapshots → ${res.status}`);
    return res.json() as Promise<PortfolioSnapshot[]>;
  });

export const fetchPortfolioActions = (timeframe = "60d") =>
  get<HoldingActionDto[]>(`/api/v1/portfolio/actions?timeframe=${timeframe}`);
