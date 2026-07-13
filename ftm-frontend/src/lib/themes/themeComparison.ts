import { ThemeDetail, ThemeHistoryPoint } from "@/lib/api";

/**
 * Who wins each metric when two themes are put side by side. Twelve comparisons, some of which want
 * the higher number, some the lower, and some a position in an ordered scale. No React.
 */

export type WinnerSide = "A" | "B" | "tie";

/** The best signal a theme can be on, ranked. */
const SIGNAL_ORDER: Record<string, number> = { BUY: 4, WATCH: 3, HOLD: 2, REDUCE: 1 };

/** The theme lifecycle, from strongest phase to weakest. */
const PHASE_ORDER: Record<string, number> = {
  BREAKOUT: 8, MOMENTUM: 7, SETUP: 6, BUILDING: 5,
  HOLDING: 4, FADING: 3, DISTRIBUTE: 2, WEAK: 1,
};

/** Differences below this are noise, not a win. */
const TIE_TOLERANCE = 0.0001;

/** A missing reading always loses to a present one. */
const compareBy = (a: number | null, b: number | null, higherWins: boolean): WinnerSide => {
  if (a == null && b == null) return "tie";
  if (a == null) return "B";
  if (b == null) return "A";
  if (Math.abs(a - b) < TIE_TOLERANCE) return "tie";
  const aWins = higherWins ? a > b : a < b;
  return aWins ? "A" : "B";
};

export const compareHigher = (a: number | null, b: number | null): WinnerSide =>
  compareBy(a, b, true);

export const compareLower = (a: number | null, b: number | null): WinnerSide =>
  compareBy(a, b, false);

export const compareOrdered = (a: number, b: number): WinnerSide => {
  if (a === b) return "tie";
  return a > b ? "A" : "B";
};

const SCORE_DELTA_SESSIONS = 5;

/** How far the score has moved over the last five sessions, in points. Null without the history. */
export const scoreDeltaOver5Days = (history: ThemeHistoryPoint[]): number | null => {
  if (history.length < SCORE_DELTA_SESSIONS + 1) return null;
  const latest = history[history.length - 1].compositeScore;
  const earlier = history[history.length - 1 - SCORE_DELTA_SESSIONS].compositeScore;
  return Math.round((latest - earlier) * 100);
};

export type ComparisonMetric =
  | "score"
  | "signal"
  | "phase"
  | "scoreDelta5d"
  | "investmentQuality"
  | "persistence"
  | "confluence"
  | "rs60"
  | "flow"
  | "volatility"
  | "streak"
  | "alerts";

export type ThemeComparison = {
  winners: Record<ComparisonMetric, WinnerSide>;
  scoreDeltaA: number | null;
  scoreDeltaB: number | null;
  winsA: number;
  winsB: number;
  metricCount: number;
};

/**
 * Compares two themes across every metric the table shows. Volatility and alert count are the two
 * where less is better — everything else rewards the bigger number.
 */
export const compareThemes = (
  themeA: ThemeDetail,
  themeB: ThemeDetail,
  historyA: ThemeHistoryPoint[],
  historyB: ThemeHistoryPoint[],
): ThemeComparison => {
  const scoreDeltaA = scoreDeltaOver5Days(historyA);
  const scoreDeltaB = scoreDeltaOver5Days(historyB);

  const winners: Record<ComparisonMetric, WinnerSide> = {
    score: compareHigher(themeA.compositeScore, themeB.compositeScore),
    signal: compareOrdered(
      SIGNAL_ORDER[themeA.dominantSignal] ?? 0,
      SIGNAL_ORDER[themeB.dominantSignal] ?? 0,
    ),
    phase: compareOrdered(
      PHASE_ORDER[themeA.themePhase ?? ""] ?? 0,
      PHASE_ORDER[themeB.themePhase ?? ""] ?? 0,
    ),
    scoreDelta5d: compareHigher(scoreDeltaA, scoreDeltaB),
    investmentQuality: compareHigher(themeA.investmentQualityScore, themeB.investmentQualityScore),
    persistence: compareHigher(themeA.persistenceScore, themeB.persistenceScore),
    confluence: compareHigher(themeA.confluenceScore, themeB.confluenceScore),
    rs60: compareHigher(themeA.rs60, themeB.rs60),
    flow: compareHigher(themeA.flow20d, themeB.flow20d),
    volatility: compareLower(themeA.volatility30d, themeB.volatility30d),
    streak: compareHigher(themeA.signalStreakDays, themeB.signalStreakDays),
    alerts: compareLower(themeA.alertCount30d, themeB.alertCount30d),
  };

  const sides = Object.values(winners);
  return {
    winners,
    scoreDeltaA,
    scoreDeltaB,
    winsA: sides.filter(side => side === "A").length,
    winsB: sides.filter(side => side === "B").length,
    metricCount: sides.length,
  };
};
