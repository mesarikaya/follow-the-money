import { get } from "./http";

/** The macro regime and the indicators behind it. */

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

export type MacroSeriesPoint = { date: string; value: number };
export type MacroHistoryResponse = Record<string, MacroSeriesPoint[]>;

export const fetchMacro = () => get<MacroResponse>("/api/v1/macro");

export const fetchMacroHistory = (days = 365) =>
  get<MacroHistoryResponse>(`/api/v1/macro/history?days=${days}`);
