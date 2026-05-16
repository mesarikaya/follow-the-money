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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchCategories = (timeframe = "MONTH") =>
  get<CategoriesResponse>(`/categories?timeframe=${timeframe}`);

export const fetchMacro = () => get<MacroResponse>("/macro");
