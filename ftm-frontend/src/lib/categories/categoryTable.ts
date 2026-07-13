import { CategorySummary, SignalWinRateDto } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { TradeSignal } from "@/lib/signals";

/**
 * Pure helpers behind the category table: filtering, sorting, peer ranking, the score tooltip and
 * the CSV export. No React and no DOM — the table component owns those.
 */

export type SortKey = "default" | "score" | "rs" | "signal" | "close" | "macroFit" | "conviction" | "winrate";
export type SortDir = "asc" | "desc";

const RS_LABELS: Record<string, string> = {
  DAY:     "20d",
  WEEK:    "20d",
  MONTH:   "60d",
  QUARTER: "120d",
  YEAR:    "120d",
};

/** The relative-strength window the selected timeframe shows, e.g. "60d". */
export const rsLabelFor = (timeframe: string): string => RS_LABELS[timeframe] ?? "60d";

/** Categories whose name or ticker contains the query. An empty query keeps everything. */
export const filterCategories = (categories: CategorySummary[], filterText: string): CategorySummary[] => {
  const query = filterText.trim().toLowerCase();
  if (!query) return categories;
  return categories.filter(
    category =>
      category.name.toLowerCase().includes(query) || category.etfTicker.toLowerCase().includes(query),
  );
};

const SIGNAL_ORDER: Record<string, number> = { BUY: 0, WATCH: 1, HOLD: 2, REDUCE: 3 };

const compareBy = (
  key: Exclude<SortKey, "default">,
  a: CategorySummary,
  b: CategorySummary,
  deriveSignal: (category: CategorySummary) => TradeSignal | null,
  winRates: Record<string, SignalWinRateDto>,
): number => {
  switch (key) {
    case "score":
      return (a.compositeScore ?? -1) - (b.compositeScore ?? -1);
    case "rs":
      return (a.rs60 ?? -Infinity) - (b.rs60 ?? -Infinity);
    case "signal": {
      const signalA = deriveSignal(a) ?? "HOLD";
      const signalB = deriveSignal(b) ?? "HOLD";
      return (SIGNAL_ORDER[signalA] ?? 99) - (SIGNAL_ORDER[signalB] ?? 99);
    }
    case "close":
      return (a.latestClose ?? -1) - (b.latestClose ?? -1);
    case "macroFit":
      return (a.macroFit ?? -1) - (b.macroFit ?? -1);
    case "conviction":
      return (a.convictionScore ?? -1) - (b.convictionScore ?? -1);
    case "winrate":
      return (winRates[a.id]?.winRate ?? -1) - (winRates[b.id]?.winRate ?? -1);
  }
};

/** Categories in the requested order. The "default" key keeps the backend's own ranking. */
export const sortCategories = (
  categories: CategorySummary[],
  key: SortKey,
  direction: SortDir,
  deriveSignal: (category: CategorySummary) => TradeSignal | null,
  winRates: Record<string, SignalWinRateDto> = {},
): CategorySummary[] => {
  if (key === "default") return categories;
  return [...categories].sort((a, b) => {
    const delta = compareBy(key, a, b, deriveSignal, winRates);
    return direction === "desc" ? -delta : delta;
  });
};

/** Each GICS sector's relative-strength percentile among the other ten. */
export const buildRsRankPercentiles = (categories: CategorySummary[]): Map<string, number> => {
  const peers = categories
    .filter(category => SECTOR_DRILLDOWN_IDS.has(category.id) && category.rs60 != null)
    .sort((a, b) => (a.rs60 ?? 0) - (b.rs60 ?? 0));
  return new Map(peers.map((peer, index) => [peer.id, Math.round(((index + 1) / peers.length) * 100)]));
};

/** How many consecutive sessions the score has moved the same way (negative when falling). */
export const computeStreak = (history: number[]): number => {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  const previous = history[history.length - 2];
  const direction = last > previous ? 1 : last < previous ? -1 : 0;
  if (direction === 0) return 0;
  let count = 1;
  for (let i = history.length - 2; i > 0; i--) {
    const isContinuing = direction === 1 ? history[i] > history[i - 1] : history[i] < history[i - 1];
    if (!isContinuing) break;
    count++;
  }
  return direction * count;
};

export type ScoreExtreme = { percentile: number; isHigh: boolean; isFromBackend: boolean };

const HIGH_PERCENTILE = 85;
const LOW_PERCENTILE = 15;

/**
 * Whether the score sits at an extreme of its own history — near 12-month highs (late-entry risk)
 * or lows (potential value). Prefers the backend's 252-day percentile and falls back to the
 * 30-day history the sparkline already has. Null when the score is unremarkable.
 */
export const findScoreExtreme = (category: CategorySummary, history: number[]): ScoreExtreme | null => {
  if (category.scorePercentile252d != null) {
    const percentile = Math.round(category.scorePercentile252d * 100);
    if (percentile < HIGH_PERCENTILE && percentile > LOW_PERCENTILE) return null;
    return { percentile, isHigh: percentile >= HIGH_PERCENTILE, isFromBackend: true };
  }
  if (history.length < 5 || category.compositeScore == null) return null;
  const belowCount = history.filter(score => score < category.compositeScore!).length;
  const percentile = Math.round((belowCount / history.length) * 100);
  if (percentile >= LOW_PERCENTILE && percentile <= HIGH_PERCENTILE) return null;
  return { percentile, isHigh: percentile > HIGH_PERCENTILE, isFromBackend: false };
};

const formatPercent = (value: number | null): string =>
  value != null ? `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%` : "—";

const RRG_TOOLTIP_LABELS: Record<string, string> = {
  "4": "Leading ↗",
  "3": "Improving ↖",
  "2": "Weakening ↘",
  "1": "Lagging ↙",
};

const breadthVelocityLine = (category: CategorySummary): string => {
  const { persistence5d, persistence20d } = category;
  if (persistence5d == null || persistence20d == null) return "";
  const recentRate = Math.round((persistence5d / 5) * 100);
  const priorRate = Math.round(((persistence20d - persistence5d) / 15) * 100);
  const delta = recentRate - priorRate;
  const trend = delta > 4 ? "accelerating ⚡" : delta < -4 ? "decelerating ⬇" : "neutral";
  return `Breadth velocity: recent-5d ${recentRate}% vs prior-15d ${priorRate}% (${delta > 0 ? "+" : ""}${delta}pp — ${trend})`;
};

/** The full weight-by-weight explanation of a composite score, shown on hover. */
export const buildScoreTooltip = (category: CategorySummary, macroFit: number | null): string => {
  const scorePercent = category.compositeScore != null ? Math.round(category.compositeScore * 100) : null;
  const momentumPoints = category.momentum != null ? Math.round(category.momentum * 100) : null;
  const momentumTrend =
    momentumPoints == null ? "n/a"
    : `${momentumPoints > 0 ? "+" : ""}${momentumPoints} pts (10d RS change — ${
        momentumPoints > 1 ? "accelerating ▲" : momentumPoints < -1 ? "decelerating ▼" : "flat →"
      })`;
  const trend5dPoints = category.compositeTrend5d != null ? Math.round(category.compositeTrend5d * 100) : null;
  const trend20dPoints = category.compositeTrend20d != null ? Math.round(category.compositeTrend20d * 100) : null;

  return [
    `Composite Score: ${scorePercent ?? "—"}/100`,
    ``,
    `RS-60 (25% weight): ${formatPercent(category.rs60)}`,
    `RS-120 (10% weight, confirmation): ${formatPercent(category.rs120)}`,
    `Persistence 20d (20% weight): ${
      category.persistence20d != null
        ? `${category.persistence20d}/20 days outperformed benchmark`
        : "n/a (computing)"
    }`,
    `Momentum (15% weight): ${momentumTrend}`,
    `Macro Fit (10% weight): ${macroFit != null ? `${Math.round(macroFit * 100)}% win rate in current regime` : "—"}`,
    `RRG (10% weight): ${category.rrgQuadrant ? RRG_TOOLTIP_LABELS[category.rrgQuadrant] ?? "—" : "—"}`,
    `Flow 20d (10% weight): 20-day dollar volume z-score — positive = inflows above average`,
    breadthVelocityLine(category),
    ``,
    trend5dPoints != null ? `5d score trend: ${trend5dPoints > 0 ? "+" : ""}${trend5dPoints} pts` : "",
    trend20dPoints != null ? `20d score trend: ${trend20dPoints > 0 ? "+" : ""}${trend20dPoints} pts` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

/** The visible table as CSV, in the order it is currently displayed. */
export const buildCategoriesCsv = (categories: CategorySummary[], rsLabel: string): string => {
  const headers = [
    "Rank", "ETF", "Name", "Type", "Price", "Score",
    `RS-${rsLabel}`, "MacroFit%", "RRG", "Signal", "Conviction", "DaysActive",
  ];
  const rows = categories.map((category, index) => [
    index + 1,
    category.etfTicker,
    `"${category.name.replace(/"/g, '""')}"`,
    category.type,
    category.latestClose != null ? Number(category.latestClose).toFixed(2) : "",
    category.compositeScore != null ? Math.round(category.compositeScore * 100) : "",
    category.rs60 != null ? (category.rs60 * 100).toFixed(1) : "",
    category.macroFit != null ? Math.round(category.macroFit * 100) : "",
    category.rrgQuadrant ?? "",
    category.tradeSignal ?? "",
    category.convictionScore ?? "",
    category.signalDaysActive ?? "",
  ]);
  return [headers, ...rows].map(row => row.join(",")).join("\n");
};
