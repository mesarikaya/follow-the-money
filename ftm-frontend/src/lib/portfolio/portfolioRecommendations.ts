import { CategorySummary, HoldingDto, PriceLevelDto, RebalanceSuggestion } from "@/lib/api";
import { TradeSignal, deriveTradeSignal } from "@/lib/signals";

/**
 * The judgement calls behind the rebalance panel: is this a good moment to buy more of something,
 * and what is worth buying that we do not already own.
 */

/** Within 5% of the 52-week high is "near peak"; more than 15% below it is a real pullback. */
const NEAR_PEAK_DRAWDOWN = -0.05;
const DEEP_PULLBACK_DRAWDOWN = -0.15;

export type EntryQuality = { label: string; className: string; title: string };

const percent = (drawdown: number) => (drawdown * 100).toFixed(1);

/**
 * How good an entry point a category is at right now, judged by where it sits against its own
 * 52-week high. Only meaningful when we are about to buy — null for a decrease, or with no prices.
 */
export const entryQuality = (
  priceLevel: PriceLevelDto | undefined,
  isIncrease: boolean,
): EntryQuality | null => {
  if (!priceLevel || !isIncrease || priceLevel.drawdownFromHigh == null) return null;
  const drawdown = priceLevel.drawdownFromHigh;

  if (drawdown >= NEAR_PEAK_DRAWDOWN) {
    return {
      label: "near peak",
      className: "text-amber-400 bg-amber-900/20 border-amber-700/30",
      title: `${percent(drawdown)}% from 52w high — elevated entry risk`,
    };
  }
  if (drawdown <= DEEP_PULLBACK_DRAWDOWN) {
    return {
      label: `${(drawdown * 100).toFixed(0)}% pullback`,
      className: "text-cyan-400 bg-cyan-900/20 border-cyan-700/30",
      title: `${percent(drawdown)}% from 52w high — potential value entry`,
    };
  }
  return {
    label: `${(drawdown * 100).toFixed(0)}% off high`,
    className: "text-slate-400 bg-slate-800 border-slate-700/50",
    title: `${percent(drawdown)}% from 52w high — moderate pullback`,
  };
};

export type NearPeakWarning = { nearPeakCount: number; buyCount: number };

const MIN_NEAR_PEAK_FOR_WARNING = 2;

/**
 * Warns when the signal-confirmed BUYs are mostly chasing things already at their highs — worth
 * knowing before acting on all of them at once. Null unless at least two are.
 */
export const nearPeakWarning = (
  suggestions: RebalanceSuggestion[],
  priceLevelByCategory: Record<string, PriceLevelDto>,
): NearPeakWarning | null => {
  const confirmedBuys = suggestions.filter(
    suggestion => suggestion.action === "INCREASE" && suggestion.signalAligned,
  );
  const nearPeak = confirmedBuys.filter(suggestion => {
    const priceLevel = priceLevelByCategory[suggestion.categoryId];
    return priceLevel?.drawdownFromHigh != null && priceLevel.drawdownFromHigh >= NEAR_PEAK_DRAWDOWN;
  });

  if (nearPeak.length < MIN_NEAR_PEAK_FOR_WARNING) return null;
  return { nearPeakCount: nearPeak.length, buyCount: confirmedBuys.length };
};

const RADAR_LIMIT = 5;

/** The strongest BUY-signal categories the portfolio does not hold — what to look at next. */
export const unownedBuySignals = (
  categoryById: Record<string, CategorySummary>,
  holdings: HoldingDto[],
): CategorySummary[] => {
  const ownedCategoryIds = new Set(
    holdings.map(holding => holding.categoryId).filter(Boolean) as string[],
  );

  return Object.values(categoryById)
    .filter(
      category =>
        ((category.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(category)) === "BUY",
    )
    .filter(category => !ownedCategoryIds.has(category.id))
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, RADAR_LIMIT);
};
