import { CategorySummary } from "@/lib/api";
import { TradeSignal, deriveTradeSignal } from "@/lib/signals";

/**
 * What the strategy would hold if it ran today: the live signal read of every category, and the
 * subset the top-N rule would actually buy. No React.
 */

export type LiveCategory = CategorySummary & { signal: TradeSignal | null };

/** Categories that have no sector drilldown page — sub-sectors, and the non-equity instruments. */
const NO_DRILLDOWN_IDS = [
  "GOLD", "SLVR", "GDMN", "TLTD", "TINT", "CORP", "HIYLD", "CASH", "FTRS",
];

export const hasSectorDrilldown = (categoryId: string): boolean =>
  !categoryId.includes("_") && !NO_DRILLDOWN_IDS.includes(categoryId);

const MAX_WATCH = 6;
const MAX_REDUCE = 4;

const byScoreDescending = (a: LiveCategory, b: LiveCategory) =>
  (b.compositeScore ?? 0) - (a.compositeScore ?? 0);

export type LiveSignals = {
  buy: LiveCategory[];
  watch: LiveCategory[];
  reduce: LiveCategory[];
  /** What the strategy would hold today: the strongest BUY/WATCH names, up to topN. */
  topPicks: LiveCategory[];
  hasData: boolean;
};

export const readLiveSignals = (categories: CategorySummary[], topN: number): LiveSignals => {
  const withSignals: LiveCategory[] = categories.map(category => ({
    ...category,
    signal: (category.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(category),
  }));

  const of = (signal: TradeSignal) => withSignals.filter(category => category.signal === signal);

  return {
    buy: of("BUY").sort(byScoreDescending),
    watch: of("WATCH").sort(byScoreDescending).slice(0, MAX_WATCH),
    reduce: of("REDUCE").slice(0, MAX_REDUCE),
    topPicks: withSignals
      .filter(category => category.signal === "BUY" || category.signal === "WATCH")
      .sort(byScoreDescending)
      .slice(0, topN),
    hasData:
      categories.length > 0 && categories.some(category => category.compositeScore != null),
  };
};
