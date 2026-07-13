import { ThemeHistoryPoint, ThemeSummary } from "@/lib/api";

/**
 * How the theme screener orders and ranks its rows, and which columns each view shows. No React.
 */

export type ViewPreset = "essential" | "standard" | "full";

export type ScreenerParams = {
  sort?: string;
  signal?: string;
  phase?: string;
  entry?: string;
  confidence?: string;
  view?: string;
};

export const ESSENTIAL_COLS = new Set([
  "rank", "rankDelta", "theme", "sector", "signal", "score",
  "trend5d", "phase", "iqs", "bullish", "alerts",
]);

export const STANDARD_COLS = new Set([
  ...ESSENTIAL_COLS,
  "rs60", "entry", "momentum", "trend", "persist", "conf",
]);

/** The "full" view shows everything; the narrower ones show a named subset. */
export const isVisible = (column: string, view: ViewPreset): boolean => {
  if (view === "full") return true;
  if (view === "standard") return STANDARD_COLS.has(column);
  return ESSENTIAL_COLS.has(column);
};

/** The screener's own URL with some params changed — empty values drop out of the query string. */
export const buildScreenerUrl = (
  current: ScreenerParams,
  overrides: Partial<ScreenerParams>,
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value != null && value !== "") params.set(key, value);
  }
  const query = params.toString();
  return `/themes${query ? `?${query}` : ""}`;
};

const SCORE_LOOKBACK_SESSIONS = 5;

/** A theme's score change over the last five sessions. −Infinity sorts a theme with no history last. */
const scoreDelta = (history: ThemeHistoryPoint[]): number => {
  if (history.length < SCORE_LOOKBACK_SESSIONS + 1) return -Infinity;
  const latest = history[history.length - 1].compositeScore;
  const earlier = history[history.length - 1 - SCORE_LOOKBACK_SESSIONS].compositeScore;
  return latest - earlier;
};

const acceleration = (theme: ThemeSummary): number =>
  theme.compositeTrend5d != null && theme.compositeTrend20d != null
    ? theme.compositeTrend5d - theme.compositeTrend20d
    : -Infinity;

const byScoreDescending = (a: ThemeSummary, b: ThemeSummary) =>
  (b.compositeScore ?? -1) - (a.compositeScore ?? -1);

/**
 * The themes in the requested order. Everything is highest-first except the percentile sort, where a
 * *low* percentile is the interesting one — a theme trading at the bottom of its own recent range.
 */
export const sortThemes = (
  themes: ThemeSummary[],
  sort: string,
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>,
  alertsByThemeId: Record<string, number>,
): ThemeSummary[] => {
  const sorted = [...themes];
  switch (sort) {
    case "delta5d":
      return sorted.sort(
        (a, b) =>
          scoreDelta(historiesByThemeId[b.id] ?? []) - scoreDelta(historiesByThemeId[a.id] ?? []),
      );
    case "alerts":
      return sorted.sort(
        (a, b) =>
          (alertsByThemeId[b.id] ?? 0) - (alertsByThemeId[a.id] ?? 0) || byScoreDescending(a, b),
      );
    case "rs60":
      return sorted.sort((a, b) => (b.rs60 ?? -Infinity) - (a.rs60 ?? -Infinity));
    case "velocity":
      return sorted.sort((a, b) => acceleration(b) - acceleration(a));
    case "percentile":
      return sorted.sort((a, b) => (a.scorePercentile30d ?? 1) - (b.scorePercentile30d ?? 1));
    case "confluence":
      return sorted.sort((a, b) => b.confluenceScore - a.confluenceScore);
    case "persistence":
      return sorted.sort((a, b) => b.persistenceScore - a.persistenceScore);
    case "iqs":
      return sorted.sort((a, b) => b.investmentQualityScore - a.investmentQualityScore);
    default:
      return sorted.sort(byScoreDescending);
  }
};

/**
 * Each theme's position by the score it had five sessions ago — the row's rank-change arrow is
 * today's rank against this one. Themes without that much history simply have no prior rank.
 */
export const priorScoreRanks = (
  themes: ThemeSummary[],
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>,
): Record<string, number> => {
  const priorScores = themes
    .map(theme => {
      const history = historiesByThemeId[theme.id] ?? [];
      const index = history.length - 1 - SCORE_LOOKBACK_SESSIONS;
      return { id: theme.id, score: index >= 0 ? history[index].compositeScore : null };
    })
    .filter((entry): entry is { id: string; score: number } => entry.score != null)
    .sort((a, b) => b.score - a.score);

  const ranks: Record<string, number> = {};
  priorScores.forEach((entry, index) => {
    ranks[entry.id] = index + 1;
  });
  return ranks;
};
