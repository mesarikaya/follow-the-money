import { BACKEND, get } from "./http";

/** Running a backtest and reading past runs. */

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
  signalSource: string | null;
  categoryScope: string | null;
  invertSignal: boolean | null;
  trendFilter: boolean | null;
  transactionCostBps: number | null;
  totalReturnPct: number;
  annualizedReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  spyTotalReturnPct: number;
  spyAnnualizedReturnPct: number | null;
  spyMaxDrawdownPct: number | null;
  spySharpeRatio: number;
  spySortinoRatio: number | null;
  spyCalmarRatio: number | null;
  equalWeightTotalReturnPct: number | null;
  equalWeightAnnualizedReturnPct: number | null;
  equalWeightMaxDrawdownPct: number | null;
  equalWeightSharpeRatio: number | null;
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
  transactionCostBps?: number;
  invertSignal?: boolean;
  trendFilter?: boolean;
  signalSource?: "COMPOSITE" | "MOMENTUM_12_1";
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

export const runBacktestSweep = (request: Omit<BacktestRequest, "topN">) =>
  fetch(`${BACKEND}/api/v1/backtest/sweep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, topN: 1 }),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `POST /api/v1/backtest/sweep → ${res.status}`);
    }
    return res.json() as Promise<BacktestResult[]>;
  });

export const runBacktestFrequencySweep = (request: Omit<BacktestRequest, "rebalanceFrequency">) =>
  fetch(`${BACKEND}/api/v1/backtest/frequency-sweep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, rebalanceFrequency: "MONTHLY" }),
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `POST /api/v1/backtest/frequency-sweep → ${res.status}`);
    }
    return res.json() as Promise<BacktestResult[]>;
  });
