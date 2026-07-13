import { CategorySummary, SeasonalReturn } from "@/lib/api";

/**
 * Pure helpers behind the capital-flows page: how categories are ranked, how breadth is trending,
 * which months are seasonally kind to a sector, and how a value maps to a heatmap colour.
 * No React — all deterministic and unit-testable.
 */

const DEFAULT_ANNUALIZED_VOLATILITY = 0.20;
const SHORT_TIMEFRAMES = ["DAY", "WEEK"];
const LONG_TIMEFRAMES = ["QUARTER", "YEAR"];

/** The relative-strength lookback the selected timeframe implies, in days. */
export const rsWindowDays = (timeframe: string): number => {
  if (SHORT_TIMEFRAMES.includes(timeframe)) return 20;
  if (LONG_TIMEFRAMES.includes(timeframe)) return 120;
  return 60;
};

/** Relative strength as a signed percentage, or an em dash when unknown. */
export const formatRs = (value: number | null): string => {
  if (value === null) return "—";
  const pct = (value * 100).toFixed(1);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
};

/** Categories with a relative-strength reading, strongest first. */
export const rankByRelativeStrength = (categories: CategorySummary[]): CategorySummary[] =>
  categories.filter(c => c.rs60 !== null).sort((a, b) => (b.rs60 ?? -999) - (a.rs60 ?? -999));

/** The bar scale for relative strength, in percentage points. Falls back to 10 when nothing moved. */
export const maxAbsRelativeStrengthPercent = (categories: CategorySummary[]): number =>
  categories.reduce((max, c) => Math.max(max, Math.abs(c.rs60 ?? 0) * 100), 0) || 10;

/** Categories with any flow or breadth reading, largest inflow first. */
export const rankByFlow = (categories: CategorySummary[]): CategorySummary[] =>
  categories
    .filter(c => c.flow20d !== null || c.persistence20d !== null)
    .sort((a, b) => (b.flow20d ?? 0) - (a.flow20d ?? 0));

/** The bar scale for flow z-scores. Falls back to 2σ when no category has any flow. */
export const maxAbsFlowZScore = (categories: CategorySummary[]): number =>
  categories.reduce((max, c) => Math.max(max, Math.abs(c.flow20d ?? 0)), 0) || 2;

export type RiskAdjustedCategory = CategorySummary & {
  volatility: number;
  isVolatilityKnown: boolean;
  sharpeProxy: number;
};

/**
 * Categories ranked by relative strength per unit of risk. Categories with no realized volatility
 * fall back to a 20% assumption rather than dropping out of the ranking.
 */
export const rankByRiskAdjustedStrength = (categories: CategorySummary[]): RiskAdjustedCategory[] =>
  categories
    .filter(c => c.rs60 != null)
    .map(c => {
      const volatility = c.realizedVol20d ?? DEFAULT_ANNUALIZED_VOLATILITY;
      return {
        ...c,
        volatility,
        isVolatilityKnown: c.realizedVol20d != null,
        sharpeProxy: (c.rs60! * 100) / (volatility * 100 || DEFAULT_ANNUALIZED_VOLATILITY * 100),
      };
    })
    .sort((a, b) => b.sharpeProxy - a.sharpeProxy);

/** The bar scale for the Sharpe proxy, taken from the extremes of the ranking. */
export const maxAbsSharpeProxy = (ranked: RiskAdjustedCategory[]): number =>
  Math.max(Math.abs(ranked[0].sharpeProxy), Math.abs(ranked[ranked.length - 1].sharpeProxy), 0.5);

export type BreadthVelocity = {
  recentRate: number;
  priorRate: number;
  changeInPercentagePoints: number;
};

const MIN_REPORTABLE_VELOCITY_POINTS = 5;

/**
 * How the last 5 days of breadth compare with the 15 before them. Null when either reading is
 * missing or the change is too small to be worth showing.
 */
export const computeBreadthVelocity = (
  persistence5d: number | null,
  persistence20d: number | null,
): BreadthVelocity | null => {
  if (persistence5d == null || persistence20d == null) return null;
  const recentRate = persistence5d / 5;
  const priorRate = (persistence20d - persistence5d) / 15;
  const changeInPercentagePoints = Math.round((recentRate - priorRate) * 100);
  if (Math.abs(changeInPercentagePoints) < MIN_REPORTABLE_VELOCITY_POINTS) return null;
  return { recentRate, priorRate, changeInPercentagePoints };
};

export type SeasonalEntry = { category: CategorySummary; seasonal: SeasonalReturn };
export type SeasonalWinds = { tailwinds: SeasonalEntry[]; headwinds: SeasonalEntry[] };

const SEASONAL_THRESHOLD = 0.005;
const MAX_TAILWINDS = 5;
const MAX_HEADWINDS = 4;

/** The categories this calendar month has historically helped, and those it has hurt. */
export const selectSeasonalWinds = (
  seasonalReturns: SeasonalReturn[],
  categories: CategorySummary[],
  month: number,
): SeasonalWinds => {
  const categoriesById = new Map(categories.map(c => [c.id, c]));
  const entries = seasonalReturns
    .filter(seasonal => seasonal.month === month)
    .map(seasonal => ({ category: categoriesById.get(seasonal.categoryId), seasonal }))
    .filter((entry): entry is SeasonalEntry => entry.category != null)
    .sort((a, b) => b.seasonal.avgReturn - a.seasonal.avgReturn);

  return {
    tailwinds: entries.filter(e => e.seasonal.avgReturn > SEASONAL_THRESHOLD).slice(0, MAX_TAILWINDS),
    headwinds: entries.filter(e => e.seasonal.avgReturn < -SEASONAL_THRESHOLD).slice(0, MAX_HEADWINDS),
  };
};

/** Heatmap colour for a composite score: green when strong, amber mid, red when weak. */
export const scoreToColor = (score: number | null | undefined): string => {
  if (score == null) return "#1e293b";
  if (score >= 0.7) return "#15803d";
  if (score >= 0.6) return "#16a34a";
  if (score >= 0.5) return "#22c55e";
  if (score >= 0.4) return "#ca8a04";
  if (score >= 0.3) return "#d97706";
  return "#b91c1c";
};

/** Heatmap colour for a return, its intensity scaled against the largest return on the map. */
export const returnToColor = (value: number, maxAbs: number): string => {
  if (maxAbs === 0) return "#1e293b";
  const intensity = Math.min(Math.abs(value) / maxAbs, 1);
  if (value > 0) {
    const green = Math.round(60 + intensity * 130);
    const blue = Math.round(40 + intensity * 40);
    return `rgb(20,${green},${blue})`;
  }
  const red = Math.round(80 + intensity * 130);
  return `rgb(${red},20,20)`;
};
