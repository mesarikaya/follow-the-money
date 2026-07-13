import { ThemeDetail, ThemeHistoryPoint } from "@/lib/api";
import { phaseFromHistory } from "@/lib/themes/themeMetrics";

/**
 * Pure helpers behind the theme detail page: which history window is shown, whether the trade looks
 * crowded, what the user should watch next, and how the phase history collapses into a timeline.
 * No React — all deterministic and unit-testable.
 */

export const HISTORY_PERIODS = [30, 60, 90, 120, 180] as const;

type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** The history window from the `?days=` query param, falling back to 30 for anything unsupported. */
export const resolveHistoryDays = (daysParam: string | undefined): number =>
  HISTORY_PERIODS.includes(Number(daysParam) as HistoryPeriod) ? Number(daysParam) : 30;

/** All bullish signals agreeing at once — a strong theme everyone has already found. */
export const isCrowdedTrade = (theme: ThemeDetail): boolean =>
  theme.dominantSignal === "BUY" &&
  (theme.compositeScore ?? 0) >= 0.65 &&
  (theme.flow20d ?? 0) >= 1.5 &&
  (theme.divergenceFromParentSectors ?? 0) >= 0.08;

/** Plain-language "what to watch next", written for the theme's current lifecycle phase. */
export const computeWatchGuidance = (theme: ThemeDetail): string | null => {
  const score = theme.compositeScore;
  const phase = theme.themePhase;
  if (!score || !phase) return null;

  const buyDistance = score < 0.65 ? Math.round((0.65 - score) * 100) : null;
  const acceleration =
    theme.compositeTrend5d != null && theme.compositeTrend20d != null
      ? ((theme.compositeTrend5d - theme.compositeTrend20d) * 100).toFixed(1)
      : null;
  const flow = theme.flow20d != null ? `${theme.flow20d.toFixed(1)}σ` : "—";
  const divergence =
    theme.divergenceFromParentSectors != null
      ? `${(theme.divergenceFromParentSectors * 100).toFixed(0)}pt`
      : "—";

  switch (phase) {
    case "BREAKOUT":
      return `In BREAKOUT — accelerating above BUY threshold. Watch for score to hold above 65 on any pullback. Flow of ${flow} must stay positive to confirm regime.`;
    case "MOMENTUM":
      return `In sustained MOMENTUM. Watch divergence from sectors (currently ${divergence}) — a drop below 0 may signal rotation out.`;
    case "SETUP":
      return `SETUP phase — ${buyDistance}pt from BUY trigger at 65. 5d is accelerating vs 20d (${acceleration ? "+" + acceleration + "pt/day" : "—"}). Watch for score to break through 65 with sustained flow.`;
    case "BUILDING":
      return buyDistance != null
        ? `Building conviction — ${buyDistance}pt from BUY trigger. Needs flow surge or catalyst to break through.`
        : `Building toward next level. Monitor for flow and trend direction change.`;
    case "HOLDING":
      return `Holding BUY territory but momentum is flat. Watch for re-acceleration (5d > 20d) or a flow increase before adding exposure.`;
    case "DISTRIBUTE":
      return `Potentially topping — score in BUY but flow is turning negative. Consider trimming or tightening stops. Distribution phase often precedes a pullback to 50-60.`;
    case "FADING":
      return `Momentum is fading. Watch the 50 level — if score breaks below, signal may downgrade to HOLD or REDUCE. Avoid new entries until trend stabilizes.`;
    case "WEAK":
      return `Weak conviction zone (below 35). Avoid new exposure. Watch for a score base above 35 before reconsidering.`;
    default:
      return null;
  }
};

export type PhaseSegment = {
  phase: string;
  start: number;
  end: number;
  date: string;
};

export type PhaseTimeline = {
  segments: PhaseSegment[];
  totalDays: number;
};

/** Trends the backend did not supply, derived from the score 5 and 20 days back. */
const derivePhases = (history: ThemeHistoryPoint[]): string[] =>
  history.map((point, index) => {
    if (index < 20) return "NEUTRAL";
    const trend5d = point.trend5d ?? (point.compositeScore - history[index - 5].compositeScore) / 5;
    const trend20d = point.trend20d ?? (point.compositeScore - history[index - 20].compositeScore) / 20;
    return phaseFromHistory(point.compositeScore, trend5d, trend20d);
  });

/** Consecutive equal phases collapsed into one segment each. */
const collapseIntoSegments = (
  phases: string[],
  history: ThemeHistoryPoint[],
  startIndex: number,
): PhaseSegment[] => {
  const segments: PhaseSegment[] = [];
  let current: PhaseSegment = {
    phase: phases[startIndex],
    start: startIndex,
    end: startIndex,
    date: history[startIndex]?.date ?? "",
  };
  for (let i = startIndex + 1; i < phases.length; i++) {
    if (phases[i] === current.phase) {
      current.end = i;
    } else {
      segments.push({ ...current });
      current = { phase: phases[i], start: i, end: i, date: history[i]?.date ?? "" };
    }
  }
  segments.push({ ...current });
  return segments;
};

/**
 * The theme's phase history as contiguous segments. Prefers the phases the backend computed; falls
 * back to deriving them from the score history, which needs a 20-day warm-up before the first phase
 * is meaningful. Returns null when there is too little history to say anything.
 */
export const buildPhaseTimeline = (
  history: ThemeHistoryPoint[],
  backendPhases?: string[],
): PhaseTimeline | null => {
  const useBackendPhases =
    backendPhases != null && backendPhases.length >= history.length && history.length >= 3;
  if (!useBackendPhases && history.length < 22) return null;

  const phases = useBackendPhases ? backendPhases : derivePhases(history);
  const startIndex = useBackendPhases ? 0 : 20;

  return {
    segments: collapseIntoSegments(phases, history, startIndex),
    totalDays: phases.length - startIndex,
  };
};
