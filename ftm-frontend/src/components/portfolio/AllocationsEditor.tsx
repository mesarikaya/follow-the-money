"use client";

import { PortfolioAllocationEntry, PortfolioResponse } from "@/lib/api";
import { SIGNAL_CONFIG } from "@/components/portfolio/signalStyles";
import { TradeSignal, deriveTradeSignal } from "@/lib/signals";
import { maxAllocationPct } from "@/lib/portfolio/portfolioMetrics";

/** The editable target weights, each shown against the momentum-optimal target beneath it. */

const COMPOSITE_OPTIMAL_TOOLTIP =
  "Composite-optimal target: if you invested 100% proportionally to each category's composite signal score, " +
  "this is the % each category would receive. It sums to 100% across all active categories.";

const COMPOSITE_SCORE_TOOLTIP =
  "Composite signal score (0–100): a weighted combination of relative-strength, momentum, " +
  "and macro-regime signals for this category. Higher = stronger current signal.";

const MOMENTUM_TOOLTIP =
  "12-1 momentum: trailing 12-month return skipping the last month. This is what drives the BUY/HOLD/REDUCE signal and the optimal target.";

const OPTIMAL_TARGET_TOOLTIP =
  "Momentum-optimal target: the top momentum categories (positive only; none positive → cash), rank-weighted so the strongest gets the largest slice (a mild linear tilt — e.g. 50/33/17 for three). The rank tilt beat a flat equal split in backtesting (Sharpe ~0.87 vs 0.81, robust across sub-periods, no extra drawdown). Note: disciplined rules-based rotation, not a market-beating guarantee.";

const AllocationBar = ({
  currentPct,
  optimalPct,
  maxPct,
}: {
  currentPct: number;
  optimalPct: number | null;
  maxPct: number;
}) => {
  const widthOf = (pct: number) => (maxPct > 0 ? (pct / maxPct) * 100 : 0);
  return (
    <div
      className="flex flex-col gap-0.5 flex-1"
      title="Blue = your current allocation · Green = composite-optimal target"
    >
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${widthOf(currentPct)}%` }} />
      </div>
      {optimalPct != null && (
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden" title={COMPOSITE_OPTIMAL_TOOLTIP}>
          <div
            className="h-full bg-emerald-500/70 rounded-full"
            style={{ width: `${widthOf(optimalPct)}%` }}
          />
        </div>
      )}
    </div>
  );
};

const SignalChip = ({ entry }: { entry: PortfolioAllocationEntry }) => {
  const signal =
    (entry.tradeSignal as TradeSignal | null) ??
    deriveTradeSignal({
      compositeScore: entry.compositeScore,
      rrgQuadrant: null,
      compositeTrend20d: null,
    });
  if (!signal) return <span className="w-14 shrink-0" />;
  return (
    <span
      className={`w-14 shrink-0 text-center text-[9px] font-bold px-1.5 py-0.5 rounded ${SIGNAL_CONFIG[signal].className}`}
    >
      {signal}
    </span>
  );
};

export const AllocationsEditor = ({
  portfolio,
  editedAllocations,
  totalAllocation,
  isValidTotal,
  isDirty,
  isSaving,
  saveError,
  onChange,
  onSave,
  onReset,
}: {
  portfolio: PortfolioResponse;
  editedAllocations: Record<string, string>;
  totalAllocation: number;
  isValidTotal: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  onChange: (categoryId: string, value: string) => void;
  onSave: () => void;
  onReset: () => void;
}) => {
  const maxBarPct = maxAllocationPct(portfolio.allocations);

  return (
    <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-200">Allocations</h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${isValidTotal ? "text-emerald-400" : "text-red-400"}`}>
            Total: {totalAllocation.toFixed(2)}%{!isValidTotal && " (must be 100%)"}
          </span>
          {isDirty && (
            <div className="flex gap-2">
              <button
                onClick={onReset}
                className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={onSave}
                disabled={isSaving || !isValidTotal}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mb-3 text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {saveError}
        </div>
      )}

      <div className="text-xs text-slate-600 flex gap-4 mb-2">
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 bg-blue-500 rounded-sm" /> Current allocation
        </span>
        <span className="flex items-center gap-1" title={OPTIMAL_TARGET_TOOLTIP}>
          <div className="w-3 h-1.5 bg-emerald-500/70 rounded-sm" />
          <span className="cursor-help">Momentum-optimal target (?)</span>
        </span>
      </div>

      <div className="flex items-center gap-3 px-0 mb-1">
        <span className="w-10 shrink-0" />
        <span className="w-32 shrink-0" />
        <span className="flex-1" />
        <span className="w-16 shrink-0" />
        <span
          className="text-[10px] text-slate-600 w-6 text-right shrink-0 cursor-help"
          title={COMPOSITE_SCORE_TOOLTIP}
        >
          CS
        </span>
        <span
          className="text-[10px] text-slate-600 w-10 text-right shrink-0 cursor-help"
          title={MOMENTUM_TOOLTIP}
        >
          Mom
        </span>
        <span className="text-[10px] text-slate-600 w-14 text-center shrink-0">Signal</span>
      </div>

      <ul className="space-y-2">
        {portfolio.allocations.map((entry: PortfolioAllocationEntry) => (
          <li key={entry.categoryId} className="flex items-center gap-3">
            <span className="w-10 text-xs font-mono text-slate-500 shrink-0">{entry.categoryId}</span>
            <span className="w-32 text-xs text-slate-300 truncate shrink-0">{entry.categoryName}</span>
            <AllocationBar
              currentPct={parseFloat(editedAllocations[entry.categoryId] ?? "0") || 0}
              optimalPct={entry.optimalAllocationPct}
              maxPct={maxBarPct}
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={editedAllocations[entry.categoryId] ?? "0"}
                onChange={event => onChange(entry.categoryId, event.target.value)}
                className="w-16 text-xs font-mono text-right bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">%</span>
            </div>
            <span
              className="w-6 text-xs font-mono text-slate-500 text-right shrink-0 cursor-help"
              title={
                entry.compositeScore != null
                  ? COMPOSITE_SCORE_TOOLTIP
                  : "No composite score available yet — run signal computation first"
              }
            >
              {entry.compositeScore != null ? Math.round(entry.compositeScore * 100) : "—"}
            </span>
            <span
              className={`w-10 text-xs font-mono text-right shrink-0 ${
                entry.momentumPct == null
                  ? "text-slate-600"
                  : entry.momentumPct >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
              title={MOMENTUM_TOOLTIP}
            >
              {entry.momentumPct == null
                ? "—"
                : `${entry.momentumPct >= 0 ? "+" : ""}${entry.momentumPct}%`}
            </span>
            <SignalChip entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
};
