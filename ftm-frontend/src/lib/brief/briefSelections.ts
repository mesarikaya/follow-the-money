import { AlertDto, CategorySummary, PortfolioSnapshot } from "@/lib/api";

/**
 * What the daily brief picks out of everything the app knows: what to buy, what to leave, what is
 * moving fastest, and how the portfolio did overnight. No React.
 */

const MAX_BUYS = 5;
const MAX_EXITS = 5;
const MAX_WATCHES = 4;
const MAX_MOVERS = 3;

/** A HOLD this weak is really an exit candidate, whatever the signal says. */
const WEAK_HOLD_SCORE = 0.35;

/** The 5-day move a category has to have made before it counts as "moving fast". */
const MOVER_THRESHOLD = 0.01;

const byScoreDescending = (a: CategorySummary, b: CategorySummary) =>
  (b.compositeScore ?? 0) - (a.compositeScore ?? 0);

const byScoreAscending = (a: CategorySummary, b: CategorySummary) =>
  (a.compositeScore ?? 1) - (b.compositeScore ?? 1);

/** The strongest BUY-signal categories — the shortlist to act on. */
export const topBuys = (categories: CategorySummary[]): CategorySummary[] =>
  categories
    .filter(category => category.tradeSignal === "BUY" && category.compositeScore != null)
    .sort(byScoreDescending)
    .slice(0, MAX_BUYS);

/** REDUCE signals, plus the HOLDs that have decayed far enough to be one in all but name. */
export const topExits = (categories: CategorySummary[]): CategorySummary[] =>
  categories
    .filter(category => {
      if (category.compositeScore == null) return false;
      if (category.tradeSignal === "REDUCE") return true;
      return category.tradeSignal === "HOLD" && category.compositeScore < WEAK_HOLD_SCORE;
    })
    .sort(byScoreAscending)
    .slice(0, MAX_EXITS);

export const topWatches = (categories: CategorySummary[]): CategorySummary[] =>
  categories
    .filter(category => category.tradeSignal === "WATCH" && category.compositeScore != null)
    .sort(byScoreDescending)
    .slice(0, MAX_WATCHES);

export type Mover = { cat: CategorySummary; delta: number };

const moversBy = (
  categories: CategorySummary[],
  compare: (a: CategorySummary, b: CategorySummary) => number,
  keep: (delta: number) => boolean,
): Mover[] =>
  categories
    .filter(category => category.compositeTrend5d != null && category.compositeScore != null)
    .sort(compare)
    .slice(0, MAX_MOVERS)
    // The stored trend is per-day, so five days of it is the move the brief talks about.
    .map(category => ({ cat: category, delta: (category.compositeTrend5d ?? 0) * 5 }))
    .filter(mover => keep(mover.delta));

export const risingFast = (categories: CategorySummary[]): Mover[] =>
  moversBy(
    categories,
    (a, b) => (b.compositeTrend5d ?? 0) - (a.compositeTrend5d ?? 0),
    delta => delta > MOVER_THRESHOLD,
  );

export const fallingFast = (categories: CategorySummary[]): Mover[] =>
  moversBy(
    categories,
    (a, b) => (a.compositeTrend5d ?? 0) - (b.compositeTrend5d ?? 0),
    delta => delta < -MOVER_THRESHOLD,
  );

/** How the portfolio moved since the previous snapshot, as a percentage. Null without two of them. */
export const portfolioDayChangePct = (snapshots: PortfolioSnapshot[]): number | null => {
  if (snapshots.length < 2) return null;
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];
  if (previous.totalValueEur === 0) return null;
  return ((latest.totalValueEur - previous.totalValueEur) / previous.totalValueEur) * 100;
};

export type AlertCounts = { action: number; warning: number; info: number };

/** URGENT alerts are counted as ACTION — both mean "do something today". */
export const countAlerts = (alerts: AlertDto[]): AlertCounts => ({
  action: alerts.filter(a => a.severity === "ACTION" || a.severity === "URGENT").length,
  warning: alerts.filter(a => a.severity === "WARNING").length,
  info: alerts.filter(a => a.severity === "INFO").length,
});
