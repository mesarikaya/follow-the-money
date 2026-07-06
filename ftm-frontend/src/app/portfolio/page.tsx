"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchPortfolio, savePortfolio, PortfolioResponse, PortfolioAllocationEntry, PortfolioSelectionUniverse,
  HoldingDto,
  fetchPriceLevels, PriceLevelDto, fetchWinRates, SignalWinRateDto,
  fetchCategories, CategorySummary, fetchPortfolioSnapshots, PortfolioSnapshot,
  fetchPortfolioActions, HoldingActionDto,
} from "@/lib/api";
import { useHoldings, SortField, SortDir } from "./useHoldings";
import PortfolioValueChart from "@/components/PortfolioValueChart";
import AllocationDonutChart from "@/components/AllocationDonutChart";
import PortfolioOverview from "@/components/PortfolioOverview";
import CollapsibleSection from "@/components/CollapsibleSection";
import SectorExposureSection from "@/components/portfolio/SectorExposureSection";
import { SIGNAL_CONFIG } from "@/components/portfolio/signalStyles";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import { getParentSectorId } from "@/lib/sectors";
import {
  currencySymbol, isStale, unrealizedPnl, maxAllocationPct, weightedMomentumPct,
  simulatedAlignmentPercent, topRebalanceActions, computeHoldingsPnl, findConcentrationRisk,
  sectorExposureRows,
} from "@/lib/portfolio/portfolioMetrics";

const ALIGNMENT_CONFIG = {
  ALIGNED:    { label: "Aligned",    colorClass: "text-emerald-400", barClass: "bg-emerald-500" },
  PARTIAL:    { label: "Partial",    colorClass: "text-amber-400",   barClass: "bg-amber-500"   },
  MISALIGNED: { label: "Misaligned", colorClass: "text-red-400",     barClass: "bg-red-500"     },
} as const;

const ALIGNMENT_TOOLTIP =
  "Alignment score: fraction of your portfolio that is correctly placed relative to signal-optimal weights. " +
  "Formula: Σ min(actual%, optimal%) / 100 across all signal-tracked categories. " +
  "Cash and untracked positions contribute 0 — they reduce your score proportionally.\n" +
  "100 = fully invested matching signal proportions exactly · ALIGNED ≥ 70 · PARTIAL 40–69 · MISALIGNED < 40";

const COMPOSITE_OPTIMAL_TOOLTIP =
  "Composite-optimal target: if you invested 100% proportionally to each category's composite signal score, " +
  "this is the % each category would receive. It sums to 100% across all active categories.";

const COMPOSITE_SCORE_TOOLTIP =
  "Composite signal score (0–100): a weighted combination of relative-strength, momentum, " +
  "and macro-regime signals for this category. Higher = stronger current signal.";


function AllocationBar({ currentPct, optimalPct, maxPct }: { currentPct: number; optimalPct: number | null; maxPct: number }) {
  const currentWidth = maxPct > 0 ? (currentPct / maxPct) * 100 : 0;
  const optimalWidth = maxPct > 0 && optimalPct != null ? (optimalPct / maxPct) * 100 : 0;

  return (
    <div className="flex flex-col gap-0.5 flex-1" title="Blue = your current allocation · Green = composite-optimal target">
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${currentWidth}%` }} />
      </div>
      {optimalPct != null && (
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden" title={COMPOSITE_OPTIMAL_TOOLTIP}>
          <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${optimalWidth}%` }} />
        </div>
      )}
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="text-slate-600 ml-1">↕</span>;
  return <span className="text-blue-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [selectionUniverse, setSelectionUniverse] = useState<PortfolioSelectionUniverse>("EQUITY_SECTORS");
  const [priceLevelByCategory, setPriceLevelByCategory] = useState<Record<string, PriceLevelDto>>({});
  const [winRateByCategory, setWinRateByCategory] = useState<Record<string, SignalWinRateDto>>({});
  const [categoryById, setCategoryById] = useState<Record<string, CategorySummary>>({});
  const [editedAllocations, setEditedAllocations] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[] | null>(null);
  const [portfolioActions, setPortfolioActions] = useState<HoldingActionDto[] | null>(null);

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await fetchPortfolio(selectionUniverse);
      setPortfolio(data);
      const initialAllocations: Record<string, string> = {};
      data.allocations.forEach((entry) => {
        initialAllocations[entry.categoryId] = entry.allocationPct.toFixed(2);
      });
      setEditedAllocations(initialAllocations);
      setIsDirty(false);
      setLoadError(null);
    } catch (error) {
      setLoadError(String(error));
    }
  }, [selectionUniverse]);

  // After any holdings change, refresh the portfolio-level data that depends on them (allocations
  // and Recommended Actions). Holdings themselves are owned and reloaded by useHoldings.
  const reloadPortfolioAndActions = useCallback(async () => {
    await Promise.all([
      loadPortfolio(),
      fetchPortfolioActions().then(setPortfolioActions).catch(() => {}),
    ]);
  }, [loadPortfolio]);

  const {
    holdings, sortedHoldings, sortField, sortDir, handleSort,
    uploadResult, isUploading, uploadError, handleUpload, handleTemplateDownload,
    isRefreshingPrices, handleRefreshPrices,
    editingTicker, editQty, setEditQty, editPrice, setEditPrice, editManualPrice, setEditManualPrice,
    isSavingHolding, editError, setEditError, startEdit, saveEdit, cancelEdit,
    deletingTicker, confirmDeleteTicker, setConfirmDeleteTicker, handleDelete,
    showAddForm, setShowAddForm, addTicker, setAddTicker, addCurrency, setAddCurrency,
    addQty, setAddQty, addAvgCost, setAddAvgCost, isAdding, addError, setAddError, handleAddHolding,
  } = useHoldings(reloadPortfolioAndActions);

  useEffect(() => {
    loadPortfolio();
    fetchPriceLevels().then(levels => {
      const map: Record<string, PriceLevelDto> = {};
      levels.forEach(pl => { map[pl.categoryId] = pl; });
      setPriceLevelByCategory(map);
    }).catch(() => {});
    fetchWinRates(365).then(rates => {
      const map: Record<string, SignalWinRateDto> = {};
      rates.forEach(wr => { map[wr.categoryId] = wr; });
      setWinRateByCategory(map);
    }).catch(() => {});
    fetchCategories("MONTH").then(r => {
      const map: Record<string, CategorySummary> = {};
      r.categories.forEach(c => { map[c.id] = c; });
      setCategoryById(map);
    }).catch(() => {});
    fetchPortfolioSnapshots(90).then(setPortfolioSnapshots).catch(() => {});
    fetchPortfolioActions().then(setPortfolioActions).catch(() => {});
  }, [loadPortfolio]);

  const handleAllocationChange = (categoryId: string, value: string) => {
    setEditedAllocations((prev) => ({ ...prev, [categoryId]: value }));
    setIsDirty(true);
    setSaveError(null);
  };

  const totalAllocation = Object.values(editedAllocations).reduce((sum, value) => {
    const parsed = parseFloat(value) || 0;
    return sum + parsed;
  }, 0);

  const handleSave = async () => {
    const entries = Object.entries(editedAllocations).map(([categoryId, value]) => ({
      categoryId,
      allocationPct: parseFloat(value) || 0,
    }));

    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await savePortfolio(entries, selectionUniverse);
      setPortfolio(updated);
      setIsDirty(false);
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!portfolio) return;
    const resetAllocations: Record<string, string> = {};
    portfolio.allocations.forEach((entry) => {
      resetAllocations[entry.categoryId] = entry.allocationPct.toFixed(2);
    });
    setEditedAllocations(resetAllocations);
    setIsDirty(false);
    setSaveError(null);
  };

  const isValidTotal = Math.abs(totalAllocation - 100) <= 0.5;
  const maxBarPct = portfolio ? maxAllocationPct(portfolio.allocations) : 100;

  const alignmentScorePercent = portfolio ? Math.round(portfolio.alignmentScore * 100) : 0;
  const simulatedAlignment = portfolio ? simulatedAlignmentPercent(portfolio) : null;

  // Allocation-weighted 12-1 momentum of the current vs the optimal (momentum-driven) portfolio.
  const portfolioMomentumPct = portfolio
    ? weightedMomentumPct(portfolio.allocations, (entry) => parseFloat(editedAllocations[entry.categoryId] ?? "0") || 0)
    : null;
  const optimalMomentumPct = portfolio
    ? weightedMomentumPct(portfolio.allocations, (entry) => entry.optimalAllocationPct ?? 0)
    : null;

  const totalEur = holdings
    ? holdings.reduce((sum, h) => sum + (h.marketValueEur ?? 0), 0)
    : null;

  // Overview header inputs: cash vs invested split and the highest-conviction rebalance actions.
  const cashPct = portfolio
    ? portfolio.allocations.find((a) => a.categoryId === "CASH")?.allocationPct ?? 0
    : 0;
  const investedPct = 100 - cashPct;
  const topActions = portfolio ? topRebalanceActions(portfolio) : [];

  const staleCount = holdings ? holdings.filter(isStale).length : 0;
  const holdingsSummary = holdings ? computeHoldingsPnl(holdings) : null;

  const radarSignals = (() => {
    if (!holdings) return [] as (typeof categoryById)[string][];
    const ownedCategoryIds = new Set(holdings.map(h => h.categoryId).filter(Boolean) as string[]);
    return Object.values(categoryById)
      .filter(c => ((c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c)) === "BUY")
      .filter(c => !ownedCategoryIds.has(c.id))
      .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
      .slice(0, 5);
  })();

  const concentrationRisk =
    holdings && totalEur != null ? findConcentrationRisk(holdings, categoryById, totalEur) : null;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <h1
          className="text-slate-100 font-bold"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
        >
          Portfolio
        </h1>
        {portfolio && (
          <div className="flex items-center gap-6">
            {portfolioMomentumPct !== null && (
              <div
                className="flex items-center gap-2"
                title={`Portfolio Momentum: allocation-weighted 12-1 momentum of your current holdings.\nFormula: Σ(allocationPct × category 12-1 momentum) / 100.\nMomentum-optimal target: ${optimalMomentumPct}% (if allocated per the recommendation).`}
              >
                <span className="text-[10px] text-slate-500 uppercase tracking-widest" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600 }}>
                  Momentum
                </span>
                <span
                  className={`text-sm font-mono font-semibold ${portfolioMomentumPct > 0 ? "text-emerald-400" : portfolioMomentumPct < 0 ? "text-red-400" : "text-yellow-400"}`}
                >
                  {portfolioMomentumPct > 0 ? "+" : ""}{portfolioMomentumPct}%
                </span>
                {optimalMomentumPct !== null && (
                  <span className="text-[10px] text-slate-600">
                    / <span className="text-slate-500">{optimalMomentumPct > 0 ? "+" : ""}{optimalMomentumPct}% opt</span>
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-4" title={ALIGNMENT_TOOLTIP}>
              <span className={`text-sm font-semibold ${ALIGNMENT_CONFIG[portfolio.alignmentLabel].colorClass}`}>
                {ALIGNMENT_CONFIG[portfolio.alignmentLabel].label}
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ALIGNMENT_CONFIG[portfolio.alignmentLabel].barClass}`}
                    style={{ width: `${alignmentScorePercent}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-300">
                  {alignmentScorePercent}<span className="text-slate-600">/100</span>
                </span>
                <span className="text-[10px] text-slate-600 cursor-help" title={ALIGNMENT_TOOLTIP}>(?)</span>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {loadError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load portfolio: {loadError}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Recommendation universe</span>
          <div className="inline-flex rounded-md border border-slate-700 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setSelectionUniverse("EQUITY_SECTORS")}
              className={`px-3 py-1.5 transition-colors ${selectionUniverse === "EQUITY_SECTORS" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
              title="Top-3 equity sectors by 12-1 momentum — the strongest, most robust validated config (Sharpe ~0.96). Rotates to cash in a broad equity selloff."
            >
              Equity sectors · top-3
            </button>
            <button
              onClick={() => setSelectionUniverse("ALL_TOP_LEVEL")}
              className={`px-3 py-1.5 border-l border-slate-700 transition-colors ${selectionUniverse === "ALL_TOP_LEVEL" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
              title="Top-5 across all top-level categories incl. gold, metals & bonds — dual-momentum rotation. Weaker out-of-sample evidence (Sharpe ~0.46) and can chase parabolic moves like silver."
            >
              + Metals &amp; Bonds · top-5
            </button>
          </div>
          <span className="text-[10px] text-slate-600">
            {selectionUniverse === "EQUITY_SECTORS"
              ? "Validated config — rotates among equity sectors, to cash in broad selloffs."
              : "Dual-momentum — can rotate into gold / metals / bonds; weaker evidence, higher whipsaw risk."}
          </span>
        </div>

        {portfolio && (
          <PortfolioOverview
            totalValueLabel={
              totalEur != null
                ? `€${totalEur.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`
                : "—"
            }
            alignmentScore={portfolio.alignmentScore}
            alignmentLabel={portfolio.alignmentLabel}
            cashPct={cashPct}
            investedPct={investedPct}
            actions={topActions}
          />
        )}

        {portfolio && (
          <CollapsibleSection
            title="Allocations & Rebalancing"
            subtitle="edit target weights · optimal-mix donut · rebalance suggestions · radar"
            defaultOpen={false}
          >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                        onClick={handleReset}
                        className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleSave}
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
                <span className="flex items-center gap-1" title="Momentum-optimal target: the top momentum categories (positive only; none positive → cash), rank-weighted so the strongest gets the largest slice (a mild linear tilt — e.g. 50/33/17 for three). The rank tilt beat a flat equal split in backtesting (Sharpe ~0.87 vs 0.81, robust across sub-periods, no extra drawdown). Note: disciplined rules-based rotation, not a market-beating guarantee.">
                  <div className="w-3 h-1.5 bg-emerald-500/70 rounded-sm" />
                  <span className="cursor-help">Momentum-optimal target (?)</span>
                </span>
              </div>

              <div className="flex items-center gap-3 px-0 mb-1">
                <span className="w-10 shrink-0" />
                <span className="w-32 shrink-0" />
                <span className="flex-1" />
                <span className="w-16 shrink-0" />
                <span className="text-[10px] text-slate-600 w-6 text-right shrink-0 cursor-help" title={COMPOSITE_SCORE_TOOLTIP}>
                  CS
                </span>
                <span className="text-[10px] text-slate-600 w-10 text-right shrink-0 cursor-help" title="12-1 momentum: trailing 12-month return skipping the last month. This is what drives the BUY/HOLD/REDUCE signal and the optimal target.">
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
                        onChange={(e) => handleAllocationChange(entry.categoryId, e.target.value)}
                        className="w-16 text-xs font-mono text-right bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                    <span
                      className="w-6 text-xs font-mono text-slate-500 text-right shrink-0 cursor-help"
                      title={entry.compositeScore != null ? COMPOSITE_SCORE_TOOLTIP : "No composite score available yet — run signal computation first"}
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
                      title="12-1 momentum (trailing 12m return, skipping the last month) — the signal driving the recommendation"
                    >
                      {entry.momentumPct == null ? "—" : `${entry.momentumPct >= 0 ? "+" : ""}${entry.momentumPct}%`}
                    </span>
                    {(() => {
                      const sig = (entry.tradeSignal as TradeSignal | null) ?? deriveTradeSignal({ compositeScore: entry.compositeScore, rrgQuadrant: null, compositeTrend20d: null });
                      if (!sig) return <span className="w-14 shrink-0" />;
                      const cfg = SIGNAL_CONFIG[sig];
                      return (
                        <span className={`w-14 shrink-0 text-center text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.className}`}>
                          {sig}
                        </span>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex flex-col items-center">
                <h2 className="text-sm font-semibold text-slate-200 w-full mb-3">Allocation Overview</h2>
                <AllocationDonutChart
                  allocations={portfolio.allocations}
                  alignmentScore={portfolio.alignmentScore}
                  alignmentLabel={portfolio.alignmentLabel}
                />
              </div>

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
                    if applied: <span className={`font-semibold ${simulatedAlignment >= 70 ? "text-emerald-400" : simulatedAlignment >= 40 ? "text-amber-400" : "text-red-400"}`}>{simulatedAlignment}%</span> ~aligned
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
                  {/* Near-peak warning: highlight if BUY increases are mostly at 52w highs */}
                  {(() => {
                    const increaseSignals = portfolio.rebalanceSuggestions.filter(s => s.action === "INCREASE" && s.signalAligned);
                    const nearPeak = increaseSignals.filter(s => {
                      const pl = priceLevelByCategory[s.categoryId];
                      return pl != null && pl.drawdownFromHigh != null && pl.drawdownFromHigh >= -0.05;
                    });
                    if (nearPeak.length >= 2) {
                      return (
                        <div className="mb-3 px-2.5 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded text-[10px] text-amber-400">
                          {nearPeak.length} of {increaseSignals.length} BUY signals near 52-week high — consider scaling in gradually
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <ul className="space-y-3">
                    {portfolio.rebalanceSuggestions.map((suggestion) => {
                      const isIncrease = suggestion.action === "INCREASE";
                      const confirmed = suggestion.signalAligned;
                      const pl = priceLevelByCategory[suggestion.categoryId];
                      const wr = winRateByCategory[suggestion.categoryId];
                      const signalColor: Record<string, string> = {
                        BUY:    "text-green-400",
                        WATCH:  "text-cyan-400",
                        HOLD:   "text-slate-500",
                        REDUCE: "text-red-400",
                      };
                      const entryQuality: { label: string; className: string; title: string } | null = (() => {
                        if (!pl || !isIncrease) return null;
                        if (pl.drawdownFromHigh != null && pl.drawdownFromHigh >= -0.05) return { label: "near peak", className: "text-amber-400 bg-amber-900/20 border-amber-700/30", title: `${(pl.drawdownFromHigh * 100).toFixed(1)}% from 52w high — elevated entry risk` };
                        if (pl.drawdownFromHigh != null && pl.drawdownFromHigh <= -0.15) return { label: `${(pl.drawdownFromHigh * 100).toFixed(0)}% pullback`, className: "text-cyan-400 bg-cyan-900/20 border-cyan-700/30", title: `${(pl.drawdownFromHigh * 100).toFixed(1)}% from 52w high — potential value entry` };
                        if (pl.drawdownFromHigh != null) return { label: `${(pl.drawdownFromHigh * 100).toFixed(0)}% off high`, className: "text-slate-400 bg-slate-800 border-slate-700/50", title: `${(pl.drawdownFromHigh * 100).toFixed(1)}% from 52w high — moderate pullback` };
                        return null;
                      })();
                      return (
                        <li key={suggestion.categoryId} className={`flex flex-col gap-1 ${confirmed ? "" : "opacity-60"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {confirmed && (
                                <span className="text-amber-400 text-[10px]" title="Signal-confirmed: trade signal matches rebalance direction">★</span>
                              )}
                              <span className="text-xs font-medium text-slate-200 truncate">{suggestion.categoryName}</span>
                              {(() => {
                                const cat = categoryById[suggestion.categoryId];
                                return cat ? (
                                  <span className="text-[9px] font-mono text-slate-500 shrink-0">{cat.etfTicker}</span>
                                ) : null;
                              })()}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {suggestion.tradeSignal && (
                                <span className={`text-[9px] font-bold ${signalColor[suggestion.tradeSignal] ?? "text-slate-500"}`}>
                                  {suggestion.tradeSignal}
                                </span>
                              )}
                              {suggestion.compositeScorePct != null && (
                                <span className="text-[9px] text-slate-600 font-mono">{suggestion.compositeScorePct}</span>
                              )}
                              <span className={`text-xs font-semibold ${isIncrease ? "text-emerald-400" : "text-red-400"}`}>
                                {isIncrease ? "↑" : "↓"} {isIncrease ? "+" : ""}{suggestion.deltaPct.toFixed(1)}%
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
                                title={`Approx. trade size based on total portfolio value €${totalEur.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`}
                              >
                                {isIncrease ? "+" : "−"}€{Math.abs(Math.round(suggestion.deltaPct / 100 * totalEur)).toLocaleString("de-DE")}
                              </span>
                            )}
                            {entryQuality && (
                              <span className={`text-[9px] px-1 py-0.5 rounded border ${entryQuality.className}`} title={entryQuality.title}>
                                {entryQuality.label}
                              </span>
                            )}
                            {wr != null && wr.winRate != null && isIncrease && suggestion.tradeSignal === "BUY" && (
                              <span
                                className={`text-[9px] font-mono ${wr.winRate >= 0.65 ? "text-green-400" : wr.winRate >= 0.50 ? "text-yellow-400" : "text-slate-500"}`}
                                title={`Historical win rate: ${Math.round(wr.winRate * 100)}% over ${wr.signalCount} BUY signals (30-day forward return). Avg: ${wr.avgReturn30d != null ? (wr.avgReturn30d * 100).toFixed(1) : "n/a"}%`}
                              >
                                {Math.round(wr.winRate * 100)}% win
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              </div>

              {radarSignals.length > 0 && (
                <div className="bg-slate-800/50 border border-emerald-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-sm font-semibold text-emerald-300">Radar · Unowned BUY Signals</h2>
                    <span
                      className="text-[10px] text-slate-600 cursor-help"
                      title="BUY-signal sectors not currently in your portfolio."
                    >ⓘ</span>
                  </div>
                  <ul className="space-y-2">
                    {radarSignals.map(cat => (
                      <li key={cat.id} className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-500 w-16 shrink-0">{cat.id}</span>
                        <span className="text-xs text-slate-300 flex-1 truncate">{cat.name}</span>
                        <span className="text-[9px] font-mono text-emerald-400 shrink-0">
                          {cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "—"}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40 shrink-0">
                          BUY
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-600 mt-3">
                    These sectors have active BUY signals · Add via + Add Holding
                  </p>
                </div>
              )}
            </div>
          </div>
          </CollapsibleSection>
        )}

        {!portfolio && !loadError && (
          <div className="text-slate-500 text-sm text-center py-16">
            Loading portfolio…
          </div>
        )}

        {/* Portfolio Value History */}
        {portfolioSnapshots !== null && portfolioSnapshots.length > 0 && (
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <PortfolioValueChart snapshots={portfolioSnapshots} />
          </section>
        )}
        {portfolioSnapshots !== null && portfolioSnapshots.length === 0 && (
          <section className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Portfolio Value History</span>
              <span className="text-[10px] text-slate-600">No snapshots yet</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Click <strong className="text-slate-500">Refresh Prices</strong> to capture today&apos;s portfolio value. History builds daily — come back tomorrow to see your first chart.
            </p>
          </section>
        )}

        {/* Sector Exposure Rollup */}
        {holdings && holdings.length > 0 && portfolio && totalEur != null && totalEur > 0 && (() => {
          const { rows, unclassifiedEur } = sectorExposureRows(holdings, portfolio, categoryById, totalEur);
          return <SectorExposureSection rows={rows} unclassifiedEur={unclassifiedEur} totalEur={totalEur} />;
        })()}

        {concentrationRisk && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-700/40 text-sm">
            <span className="text-amber-400 text-base shrink-0">⚠</span>
            <div>
              <span className="font-semibold text-amber-300">Concentration Risk</span>
              <span className="text-amber-200/70 ml-2">
                {concentrationRisk.name} is {concentrationRisk.pct.toFixed(0)}% of your portfolio — consider diversifying across more sectors.
              </span>
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {portfolioActions && portfolioActions.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Recommended Actions</h2>
              <span
                className="text-[10px] text-slate-600 cursor-help"
                title="Signal-driven recommendations for each holding. EXIT = REDUCE signal + position >5% of portfolio. TRIM = REDUCE signal, smaller position. WATCH = WATCH signal. HOLD = BUY or neutral signal. UNCLASSIFIED = no FTM sector mapping. Sorted by urgency."
              >(?)
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-700/60">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Sector</th>
                    <th className="px-3 py-2 text-center">Signal</th>
                    <th className="px-3 py-2 text-center">Conv.</th>
                    <th className="px-3 py-2 text-right">Weight</th>
                    <th className="px-3 py-2">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {portfolioActions.map((a) => {
                    const actionConfig: Record<string, { label: string; className: string }> = {
                      EXIT:         { label: "EXIT",         className: "bg-red-500/20 text-red-300 border border-red-500/40" },
                      TRIM:         { label: "TRIM",         className: "bg-orange-500/15 text-orange-300 border border-orange-500/30" },
                      WATCH:        { label: "WATCH",        className: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" },
                      HOLD:         { label: "HOLD",         className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
                      UNCLASSIFIED: { label: "?",            className: "bg-slate-700/30 text-slate-400 border border-slate-600/30" },
                    };
                    const cfg = actionConfig[a.action] ?? actionConfig.UNCLASSIFIED;
                    const signalColor: Record<string, string> = {
                      BUY:    "text-green-400",
                      WATCH:  "text-cyan-400",
                      HOLD:   "text-slate-500",
                      REDUCE: "text-red-400",
                    };
                    return (
                      <tr key={a.ticker} className={`hover:bg-slate-800/30 transition-colors ${a.action === "EXIT" ? "bg-red-950/10" : a.action === "TRIM" ? "bg-orange-950/10" : ""}`}>
                        <td className="px-3 py-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-200">{a.ticker}</td>
                        <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">{a.categoryName ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {a.signal ? (
                            <span className={`text-[9px] font-bold ${signalColor[a.signal] ?? "text-slate-500"}`}>{a.signal}</span>
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-400">
                          {a.convictionScore != null ? a.convictionScore : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-300">
                          {a.portfolioPct != null ? `${Number(a.portfolioPct).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-[10px] max-w-[240px]">{a.rationale}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Holdings
                {holdings && holdings.length > 0 && (
                  <span className="text-slate-500 font-normal ml-2">({holdings.length})</span>
                )}
              </h2>
              {totalEur != null && totalEur > 0 && (
                <span className="text-sm font-mono text-emerald-400">
                  €{totalEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
              {staleCount > 0 && (
                <span className="text-xs text-amber-400" title={`${staleCount} holding(s) have no live price — click refresh or edit manually`}>
                  ⚠ {staleCount} stale
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {holdings && holdings.length > 0 && (
                <button
                  onClick={handleRefreshPrices}
                  disabled={isRefreshingPrices}
                  className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
                  title="Fetch latest prices from Yahoo Finance for all holdings"
                >
                  {isRefreshingPrices ? "Refreshing…" : "↻ Refresh Prices"}
                </button>
              )}
              <button
                onClick={handleTemplateDownload}
                className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors"
                title="Download CSV template to fill in your holdings"
              >
                ↓ Template
              </button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
                />
                <span className={`text-xs px-3 py-1 rounded border transition-colors ${
                  isUploading
                    ? "bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed"
                    : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                }`}>
                  {isUploading ? "Uploading…" : "↑ Upload CSV"}
                </span>
              </label>
              <button
                onClick={() => { setShowAddForm((v) => !v); setAddError(null); }}
                className="text-xs px-3 py-1 border border-emerald-700 text-emerald-400 rounded hover:bg-emerald-900/30 hover:text-emerald-300 transition-colors"
              >
                + Add Holding
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {uploadError}
            </div>
          )}

          {editError && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2 flex items-center justify-between">
              <span>Failed to save: {editError}</span>
              <button onClick={() => setEditError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
            </div>
          )}

          {showAddForm && (
            <div className="bg-slate-800/60 border border-emerald-800/50 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-200 mb-3">Add New Holding</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Ticker *</label>
                  <input
                    type="text"
                    placeholder="e.g. AAPL"
                    value={addTicker}
                    onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
                    className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Currency *</label>
                  <select
                    value={addCurrency}
                    onChange={(e) => setAddCurrency(e.target.value)}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="GBX">GBX — Pence Sterling (LSE, e.g. BA.L)</option>
                    <option value="SEK">SEK — Swedish Krona (e.g. SAAB-B.ST)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10.00"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Avg Cost (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 195.00"
                    value={addAvgCost}
                    onChange={(e) => setAddAvgCost(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              {addError && (
                <p className="text-xs text-red-400 mt-2">{addError}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleAddHolding}
                  disabled={isAdding || !addTicker.trim() || !addQty}
                  className="text-xs px-4 py-1.5 bg-emerald-700 text-white rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isAdding ? "Adding…" : "Add"}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null); }}
                  className="text-xs px-3 py-1.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <span className="text-[10px] text-slate-600 ml-1">
                  Name and category are auto-detected from Yahoo Finance and ticker mappings.
                </span>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800 rounded px-3 py-2 flex items-center justify-between">
              <span>
                Uploaded {uploadResult.totalAccepted} holdings
                {uploadResult.totalMarketValueEur != null && ` · Total: €${Number(uploadResult.totalMarketValueEur).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                {uploadResult.usdPerEurRateUsed != null && ` (rate: ${Number(uploadResult.usdPerEurRateUsed).toFixed(4)})`}
              </span>
              {uploadResult.unclassifiedTickers.length > 0 && (
                <span className="text-amber-400 ml-2" title="These tickers were not mapped to a category">
                  ⚠ Unclassified: {uploadResult.unclassifiedTickers.join(", ")}
                </span>
              )}
            </div>
          )}

          {sortedHoldings && sortedHoldings.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("ticker")}>
                      Ticker <SortIcon field="ticker" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("categoryId")}>
                      Segment <SortIcon field="categoryId" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-center" title="Sector rotation signal for this holding's category">Signal</th>
                    <th className="px-4 py-2 text-right" title="This holding as % of total portfolio value (EUR)">Wt%</th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("quantity")}>
                      Qty <SortIcon field="quantity" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("avgCostLocal")}>
                      Avg Cost <SortIcon field="avgCostLocal" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("currentPriceLocal")}>
                      Price <SortIcon field="currentPriceLocal" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("unrealizedPnlPct")} title="Unrealized P&L: (current price − avg cost) / avg cost">
                      P&amp;L <SortIcon field="unrealizedPnlPct" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("marketValueEur")}>
                      Value (€) <SortIcon field="marketValueEur" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sortedHoldings.map((h) => {
                    const stale = isStale(h);
                    const isEditing = editingTicker === h.ticker;
                    return (
                      <tr
                        key={h.ticker}
                        className={`hover:bg-slate-800/50 transition-colors ${stale ? "bg-amber-950/10" : ""}`}
                      >
                        <td className="px-4 py-2 font-mono text-blue-300 font-medium">
                          {h.ticker}
                          {stale && (
                            <span className="ml-1 text-[10px] text-amber-500" title="Price not available or older than 3 days">●</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-400 text-xs">{h.name ?? "—"}</td>
                        <td className="px-4 py-2 text-xs">
                          {h.categoryId ? (() => {
                            const cat = categoryById[h.categoryId];
                            const parentId = cat?.parentId ?? null;
                            const parentCat = parentId ? categoryById[parentId] : null;
                            return (
                              <div className="flex items-center gap-1 flex-wrap">
                                {parentCat && (
                                  <>
                                    <span className="text-[9px] text-slate-500" title={parentCat.name}>{parentCat.name}</span>
                                    <span className="text-[9px] text-slate-700">›</span>
                                  </>
                                )}
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-900/50 text-blue-300 border border-blue-800/40"
                                  title={`${h.categoryId}${cat ? ` — ${cat.name}` : ""}`}
                                >
                                  {cat?.name ?? h.categoryId}
                                </span>
                              </div>
                            );
                          })() : (
                            <span className="text-amber-400 text-[10px]" title="No sector mapping for this ticker — assign one under Ticker Mappings, or re-upload">⚠ Unclassified</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {(() => {
                            const cat = h.categoryId ? categoryById[h.categoryId] : null;
                            if (!cat) return <span className="text-slate-700 text-[10px]">—</span>;
                            const sig = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal({ compositeScore: cat.compositeScore, rrgQuadrant: null, compositeTrend20d: null });
                            const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
                            if (!sig) return <span className="text-slate-700 text-[10px]">—</span>;
                            const cfg = SIGNAL_CONFIG[sig];
                            const trend5d = cat.compositeTrend5d ?? null;
                            const trendArrow = trend5d == null ? null : trend5d > 0 ? "↑" : trend5d < 0 ? "↓" : "→";
                            const trendColor = trend5d == null ? "" : trend5d > 0 ? "text-emerald-400" : trend5d < 0 ? "text-red-400" : "text-slate-500";
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.className}`}>{sig}</span>
                                <div className="flex items-center gap-1">
                                  {score != null && (
                                    <span className={`text-[9px] font-mono ${score >= 65 ? "text-green-400" : score >= 45 ? "text-yellow-400" : "text-red-400"}`}>{score}</span>
                                  )}
                                  {trendArrow && (
                                    <span className={`text-[9px] font-bold ${trendColor}`}>{trendArrow}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500 text-xs">
                          {totalEur != null && totalEur > 0 && h.marketValueEur != null
                            ? `${((h.marketValueEur / totalEur) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="w-20 text-xs font-mono text-right bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none"
                            />
                          ) : (
                            Number(h.quantity).toFixed(2)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-400">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="avg cost"
                              className="w-24 text-xs font-mono text-right bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none"
                            />
                          ) : (
                            h.avgCostLocal != null
                              ? `${currencySymbol(h.currency)}${Number(h.avgCostLocal).toFixed(2)}`
                              : "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editManualPrice}
                              onChange={(e) => setEditManualPrice(e.target.value)}
                              placeholder="price override"
                              className="w-28 text-xs font-mono text-right bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none"
                            />
                          ) : h.currentPriceLocal != null ? (
                            <span className="text-slate-200">
                              {currencySymbol(h.currency)}{Number(h.currentPriceLocal).toFixed(2)}
                              {h.priceDate && (
                                <span className="text-slate-600 text-[10px] ml-1">{h.priceDate}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-amber-500 text-xs" title="No live price — click Edit to enter manually">n/a</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {(() => {
                            const pnl = unrealizedPnl(h);
                            if (!pnl) return <span className="text-slate-600 text-xs">—</span>;
                            const pctStr = `${pnl.pct >= 0 ? "+" : ""}${(pnl.pct * 100).toFixed(1)}%`;
                            const absStr = `${pnl.absLocal >= 0 ? "+" : ""}${Math.abs(pnl.absLocal) < 1000
                              ? (currencySymbol(h.currency)) + Math.abs(pnl.absLocal).toFixed(0)
                              : (currencySymbol(h.currency)) + (Math.abs(pnl.absLocal) / 1000).toFixed(1) + "k"}`;
                            const color = pnl.pct >= 0 ? "text-emerald-400" : "text-red-400";
                            return (
                              <div className={`flex flex-col items-end ${color}`} title={`Unrealized: ${pnl.pct >= 0 ? "+" : ""}${(pnl.pct * 100).toFixed(2)}% · ${absStr} in local currency`}>
                                <span className="text-xs font-semibold">{pctStr}</span>
                                <span className="text-[10px] opacity-70">{pnl.absLocal >= 0 ? "+" : ""}{currencySymbol(h.currency)}{Math.abs(pnl.absLocal).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          {h.marketValueEur != null ? (
                            <span className="text-emerald-400">
                              €{Number(h.marketValueEur).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => saveEdit(h.ticker)}
                                disabled={isSavingHolding}
                                className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isSavingHolding ? "…" : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-[10px] px-2 py-0.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : confirmDeleteTicker === h.ticker ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-red-400">Delete?</span>
                              <button
                                onClick={() => handleDelete(h.ticker)}
                                disabled={deletingTicker === h.ticker}
                                className="text-[10px] px-2 py-0.5 bg-red-700 text-white rounded hover:bg-red-600 disabled:opacity-50"
                              >
                                {deletingTicker === h.ticker ? "…" : "Yes"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteTicker(null)}
                                className="text-[10px] px-2 py-0.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => startEdit(h)}
                                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteTicker(h.ticker)}
                                className="text-[10px] text-red-700 hover:text-red-400 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {holdingsSummary && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/40 text-xs">
                  <span className="text-slate-400 font-medium">Portfolio Summary</span>
                  <div className="flex items-center gap-6">
                    {totalEur != null && totalEur > 0 && (
                      <span className="text-slate-300 font-mono">
                        <span className="text-slate-500 mr-1">Total value</span>
                        <span className="font-semibold text-emerald-400">
                          €{totalEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </span>
                    )}
                    {holdingsSummary.totalPnlPct != null && (
                      <span className="font-mono flex items-center gap-1">
                        <span className="text-slate-500">Unrealized P&L</span>
                        <span className={`font-semibold ${holdingsSummary.totalPnlEur >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {holdingsSummary.totalPnlEur >= 0 ? "+" : ""}€{Math.abs(holdingsSummary.totalPnlEur).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span className={`text-[10px] ${holdingsSummary.totalPnlEur >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          ({holdingsSummary.totalPnlPct >= 0 ? "+" : ""}{(holdingsSummary.totalPnlPct * 100).toFixed(1)}%)
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : holdings !== null && holdings.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8">
              No holdings uploaded yet. Download the template, fill it in, and upload your CSV.
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
