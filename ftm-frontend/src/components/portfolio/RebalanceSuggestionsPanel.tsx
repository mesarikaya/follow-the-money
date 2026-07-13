"use client";

import {
  CategorySummary,
  PortfolioResponse,
  PriceLevelDto,
  RebalanceSuggestion,
  SignalWinRateDto,
} from "@/lib/api";
import { entryQuality, nearPeakWarning } from "@/lib/portfolio/portfolioRecommendations";
import { simulatedAlignmentPercent } from "@/lib/portfolio/portfolioMetrics";

/** What to buy and sell to get back to the target weights — and whether now is a good moment to. */

const SIGNAL_COLOR: Record<string, string> = {
  BUY: "text-green-400",
  WATCH: "text-cyan-400",
  HOLD: "text-slate-500",
  REDUCE: "text-red-400",
};

const euros = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 0 });

const SuggestionRow = ({
  suggestion,
  category,
  priceLevel,
  winRate,
  totalEur,
}: {
  suggestion: RebalanceSuggestion;
  category?: CategorySummary;
  priceLevel?: PriceLevelDto;
  winRate?: SignalWinRateDto;
  totalEur: number | null;
}) => {
  const isIncrease = suggestion.action === "INCREASE";
  const quality = entryQuality(priceLevel, isIncrease);
  const showWinRate =
    winRate?.winRate != null && isIncrease && suggestion.tradeSignal === "BUY";

  return (
    <li className={`flex flex-col gap-1 ${suggestion.signalAligned ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {suggestion.signalAligned && (
            <span
              className="text-amber-400 text-[10px]"
              title="Signal-confirmed: trade signal matches rebalance direction"
            >
              ★
            </span>
          )}
          <span className="text-xs font-medium text-slate-200 truncate">{suggestion.categoryName}</span>
          {category && (
            <span className="text-[9px] font-mono text-slate-500 shrink-0">{category.etfTicker}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {suggestion.tradeSignal && (
            <span
              className={`text-[9px] font-bold ${SIGNAL_COLOR[suggestion.tradeSignal] ?? "text-slate-500"}`}
            >
              {suggestion.tradeSignal}
            </span>
          )}
          {suggestion.compositeScorePct != null && (
            <span className="text-[9px] text-slate-600 font-mono">{suggestion.compositeScorePct}</span>
          )}
          <span className={`text-xs font-semibold ${isIncrease ? "text-emerald-400" : "text-red-400"}`}>
            {isIncrease ? "↑" : "↓"} {isIncrease ? "+" : ""}
            {suggestion.deltaPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">
          {suggestion.currentAllocationPct.toFixed(1)}% → {suggestion.optimalAllocationPct.toFixed(1)}%
        </span>
        {totalEur != null && totalEur > 0 && (
          <span
            className={`text-[9px] font-mono font-semibold ${isIncrease ? "text-emerald-400" : "text-red-400"}`}
            title={`Approx. trade size based on total portfolio value €${euros(totalEur)}`}
          >
            {isIncrease ? "+" : "−"}€
            {euros(Math.abs(Math.round((suggestion.deltaPct / 100) * totalEur)))}
          </span>
        )}
        {quality && (
          <span className={`text-[9px] px-1 py-0.5 rounded border ${quality.className}`} title={quality.title}>
            {quality.label}
          </span>
        )}
        {showWinRate && (
          <span
            className={`text-[9px] font-mono ${winRate!.winRate! >= 0.65 ? "text-green-400" : winRate!.winRate! >= 0.5 ? "text-yellow-400" : "text-slate-500"}`}
            title={`Historical win rate: ${Math.round(winRate!.winRate! * 100)}% over ${winRate!.signalCount} BUY signals (30-day forward return). Avg: ${winRate!.avgReturn30d != null ? (winRate!.avgReturn30d * 100).toFixed(1) : "n/a"}%`}
          >
            {Math.round(winRate!.winRate! * 100)}% win
          </span>
        )}
      </div>
    </li>
  );
};

export const RebalanceSuggestionsPanel = ({
  portfolio,
  priceLevelByCategory,
  winRateByCategory,
  categoryById,
  totalEur,
}: {
  portfolio: PortfolioResponse;
  priceLevelByCategory: Record<string, PriceLevelDto>;
  winRateByCategory: Record<string, SignalWinRateDto>;
  categoryById: Record<string, CategorySummary>;
  totalEur: number | null;
}) => {
  const simulatedAlignment = simulatedAlignmentPercent(portfolio);
  const warning = nearPeakWarning(portfolio.rebalanceSuggestions, priceLevelByCategory);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold text-slate-200">Rebalance Suggestions</h2>
        <span
          className="text-[10px] text-slate-600 cursor-help"
          title="Signal-confirmed suggestions: INCREASE backed by BUY signal, DECREASE backed by REDUCE. Others shown with lower confidence. Sorted by delta magnitude."
        >
          (?)
        </span>
        {simulatedAlignment !== null && (
          <span
            className="ml-auto text-[10px] text-slate-500"
            title="Approximate alignment score after implementing all suggestions (uses vol-adjusted optimal, may differ slightly from server-computed score)"
          >
            if applied:{" "}
            <span
              className={`font-semibold ${simulatedAlignment >= 70 ? "text-emerald-400" : simulatedAlignment >= 40 ? "text-amber-400" : "text-red-400"}`}
            >
              {simulatedAlignment}%
            </span>{" "}
            ~aligned
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-600 mb-3">
        ★ = signal-confirmed (BUY → INCREASE, REDUCE → DECREASE). Others are allocation-only.
      </p>

      {portfolio.rebalanceSuggestions.length === 0 ? (
        <p className="text-xs text-slate-500">
          {portfolio.alignmentLabel === "ALIGNED"
            ? "Portfolio is well aligned — no changes needed."
            : "No composite scores available to compute suggestions. Run signal computation first."}
        </p>
      ) : (
        <>
          {warning && (
            <div className="mb-3 px-2.5 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded text-[10px] text-amber-400">
              {warning.nearPeakCount} of {warning.buyCount} BUY signals near 52-week high — consider
              scaling in gradually
            </div>
          )}
          <ul className="space-y-3">
            {portfolio.rebalanceSuggestions.map(suggestion => (
              <SuggestionRow
                key={suggestion.categoryId}
                suggestion={suggestion}
                category={categoryById[suggestion.categoryId]}
                priceLevel={priceLevelByCategory[suggestion.categoryId]}
                winRate={winRateByCategory[suggestion.categoryId]}
                totalEur={totalEur}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
