import { MacroIndicators, MacroSeriesPoint } from "@/lib/api";

/**
 * Pure helpers behind the macro page: how stressed the market is, what shape the yield curve is in,
 * and what the real yield has done. No React.
 */

export type MacroHistory = Record<string, MacroSeriesPoint[]>;

/** FRED series ids, the names the history is keyed by. */
const VIX = "VIXCLS";
const USD_INDEX = "DTWEXBGS";
const TEN_YEAR_YIELD = "DGS10";
const BREAKEVEN_INFLATION = "T10YIE";

const MIN_POINTS_FOR_ZSCORE = 20;

/** How far today's reading sits from its own year, in standard deviations. */
const zScore = (points: MacroSeriesPoint[], current: number | null): number => {
  if (!current || points.length < MIN_POINTS_FOR_ZSCORE) return 0;
  const values = points.map(point => point.value);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation =
    Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1;
  return (current - mean) / deviation;
};

const clampToScore = (value: number): number => Math.max(0, Math.min(100, value));

export type MacroStress = {
  score: number;
  components: { label: string; score: number; weight: number }[];
};

/**
 * A 0–100 read on how stressed the macro backdrop is: mostly fear (VIX) and the yield curve, with
 * the dollar and inflation as lesser contributors.
 */
export const computeMacroStress = (
  history: MacroHistory,
  indicators: MacroIndicators,
): MacroStress => {
  const vixStress = clampToScore(50 + zScore(history[VIX] ?? [], indicators.vix) * 20);

  // Only an inverted curve is stressful; a normal one contributes nothing.
  const spread = indicators.yieldSpread10y2y ?? 0;
  const spreadStress = clampToScore(spread < 0 ? Math.min(-spread / 1.5, 1) * 100 : 0);

  // Only a strengthening dollar is stressful.
  const usdZScore = zScore(history[USD_INDEX] ?? [], indicators.usdIndex);
  const usdStress = clampToScore(Math.max(0, usdZScore) * 20);

  // Stress is the distance from target inflation in either direction.
  const inflation = indicators.breakevenInflation ?? 2;
  const inflationStress = clampToScore((Math.abs(inflation - 2.2) / 1.5) * 60);

  const components = [
    { label: "VIX", score: Math.round(vixStress), weight: 40 },
    { label: "Yield Curve", score: Math.round(spreadStress), weight: 35 },
    { label: "USD Strength", score: Math.round(usdStress), weight: 15 },
    { label: "Inflation", score: Math.round(inflationStress), weight: 10 },
  ];

  const weightedScore =
    0.4 * vixStress + 0.35 * spreadStress + 0.15 * usdStress + 0.1 * inflationStress;

  return { score: Math.round(weightedScore), components };
};

export type YieldCurveShape = "Inverted" | "Flat" | "Normal";

/** The curve is inverted when the long end pays less than the short end — a recession signal. */
export const yieldCurveShape = (indicators: MacroIndicators): YieldCurveShape => {
  const spread = (indicators.tenYearYield ?? 0) - (indicators.twoYearYield ?? 0);
  const fedFundsToTenYear = (indicators.tenYearYield ?? 0) - (indicators.fedFundsRate ?? 0);
  if (spread < -0.1 || fedFundsToTenYear < -0.1) return "Inverted";
  return Math.abs(spread) < 0.25 ? "Flat" : "Normal";
};

/** The 10-year yield after inflation expectations are taken out. */
export const realYield = (indicators: MacroIndicators): number | null => {
  const { tenYearYield, breakevenInflation } = indicators;
  if (tenYearYield == null || breakevenInflation == null) return null;
  return tenYearYield - breakevenInflation;
};

const REAL_YIELD_HISTORY_DAYS = 60;

/** The real yield over time, from the days where both series have a reading. */
export const realYieldHistory = (history: MacroHistory): number[] => {
  const nominalByDate = new Map((history[TEN_YEAR_YIELD] ?? []).map(p => [p.date, p.value]));
  return (history[BREAKEVEN_INFLATION] ?? [])
    .filter(point => nominalByDate.has(point.date))
    .map(point => nominalByDate.get(point.date)! - point.value)
    .slice(-REAL_YIELD_HISTORY_DAYS);
};
