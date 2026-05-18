"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchPortfolio, savePortfolio, PortfolioResponse, PortfolioAllocationEntry,
  fetchHoldings, uploadHoldings, downloadHoldingsTemplate, refreshHoldingPrices,
  HoldingDto, HoldingsUploadResponse, updateHolding,
} from "@/lib/api";

const ALIGNMENT_CONFIG = {
  ALIGNED:    { label: "Aligned",    colorClass: "text-emerald-400", barClass: "bg-emerald-500" },
  PARTIAL:    { label: "Partial",    colorClass: "text-amber-400",   barClass: "bg-amber-500"   },
  MISALIGNED: { label: "Misaligned", colorClass: "text-red-400",     barClass: "bg-red-500"     },
} as const;

const ALIGNMENT_TOOLTIP =
  "Alignment score: how closely your current allocation percentages match the signal-optimal weights " +
  "(Spearman rank correlation, scaled 0–100). " +
  "100 = perfect match · 50 = random · 0 = fully inverted.\n" +
  "ALIGNED ≥ 70 · PARTIAL 40–69 · MISALIGNED < 40";

const COMPOSITE_OPTIMAL_TOOLTIP =
  "Composite-optimal target: if you invested 100% proportionally to each category's composite signal score, " +
  "this is the % each category would receive. It sums to 100% across all active categories.";

const COMPOSITE_SCORE_TOOLTIP =
  "Composite signal score (0–100): a weighted combination of relative-strength, momentum, " +
  "and macro-regime signals for this category. Higher = stronger current signal.";

type SortField = "ticker" | "categoryId" | "quantity" | "avgCostLocal" | "currentPriceLocal" | "marketValueEur";
type SortDir = "asc" | "desc";

function isStale(holding: HoldingDto): boolean {
  if (!holding.priceSource) return true;
  if (!holding.priceDate) return true;
  const priceAge = Date.now() - new Date(holding.priceDate).getTime();
  return priceAge > 3 * 24 * 60 * 60 * 1000; // older than 3 days
}

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
  const [editedAllocations, setEditedAllocations] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [holdings, setHoldings] = useState<HoldingDto[] | null>(null);
  const [uploadResult, setUploadResult] = useState<HoldingsUploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [sortField, setSortField] = useState<SortField>("marketValueEur");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [isSavingHolding, setIsSavingHolding] = useState(false);

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await fetchPortfolio();
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
  }, []);

  useEffect(() => {
    loadPortfolio();
    fetchHoldings().then(setHoldings).catch(() => setHoldings([]));
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
      const updated = await savePortfolio(entries);
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

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const result = await uploadHoldings(file);
      setUploadResult(result);
      setHoldings(result.holdings);
      // Reload portfolio allocations since holdings changed
      await loadPortfolio();
    } catch (error) {
      setUploadError(String(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefreshPrices = async () => {
    setIsRefreshingPrices(true);
    try {
      const updated = await refreshHoldingPrices();
      setHoldings(updated);
    } catch (error) {
      setUploadError(String(error));
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  const handleTemplateDownload = async () => {
    const res = await downloadHoldingsTemplate();
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holdings-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedHoldings = holdings ? [...holdings].sort((a, b) => {
    const aVal = a[sortField] ?? (sortDir === "asc" ? Infinity : -Infinity);
    const bVal = b[sortField] ?? (sortDir === "asc" ? Infinity : -Infinity);
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    return sortDir === "asc" ? aNum - bNum : bNum - aNum;
  }) : null;

  const startEdit = (h: HoldingDto) => {
    setEditingTicker(h.ticker);
    setEditQty(String(h.quantity));
    setEditPrice(h.avgCostLocal != null ? String(h.avgCostLocal) : "");
  };

  const cancelEdit = () => {
    setEditingTicker(null);
    setEditQty("");
    setEditPrice("");
  };

  const saveEdit = async (ticker: string) => {
    setIsSavingHolding(true);
    try {
      const updated = await updateHolding(ticker, {
        quantity: parseFloat(editQty),
        avgCostLocal: editPrice ? parseFloat(editPrice) : undefined,
      });
      setHoldings((prev) => prev ? prev.map((h) => h.ticker === ticker ? updated : h) : prev);
      setEditingTicker(null);
    } catch (error) {
      setUploadError(String(error));
    } finally {
      setIsSavingHolding(false);
    }
  };

  const isValidTotal = Math.abs(totalAllocation - 100) <= 0.5;
  const maxAllocationPct = portfolio
    ? Math.max(...portfolio.allocations.map((a) => Math.max(a.allocationPct, a.optimalAllocationPct ?? 0)), 1)
    : 100;

  const alignmentScorePercent = portfolio ? Math.round(portfolio.alignmentScore * 100) : 0;

  const totalEur = holdings
    ? holdings.reduce((sum, h) => sum + (h.marketValueEur ?? 0), 0)
    : null;

  const staleCount = holdings ? holdings.filter(isStale).length : 0;

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
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {loadError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load portfolio: {loadError}
          </div>
        )}

        {portfolio && (
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
                <span className="flex items-center gap-1" title={COMPOSITE_OPTIMAL_TOOLTIP}>
                  <div className="w-3 h-1.5 bg-emerald-500/70 rounded-sm" />
                  <span className="cursor-help">Composite-optimal target (?)</span>
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
              </div>

              <ul className="space-y-2">
                {portfolio.allocations.map((entry: PortfolioAllocationEntry) => (
                  <li key={entry.categoryId} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-mono text-slate-500 shrink-0">{entry.categoryId}</span>
                    <span className="w-32 text-xs text-slate-300 truncate shrink-0">{entry.categoryName}</span>
                    <AllocationBar
                      currentPct={parseFloat(editedAllocations[entry.categoryId] ?? "0") || 0}
                      optimalPct={entry.optimalAllocationPct}
                      maxPct={maxAllocationPct}
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
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-slate-200">Rebalance Suggestions</h2>
                <span
                  className="text-[10px] text-slate-600 cursor-help"
                  title="These suggestions show categories where your current allocation differs from the composite-optimal target by more than 0.5%. The optimal targets sum to 100% across all active categories."
                >
                  (?)
                </span>
              </div>
              <p className="text-[10px] text-slate-600 mb-3">
                Shows categories where |current − optimal| &gt; 0.5%. Optimal targets sum to 100% across all categories.
              </p>
              {portfolio.rebalanceSuggestions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {portfolio.alignmentLabel === "ALIGNED"
                    ? "Portfolio is well aligned — no changes needed."
                    : "No composite scores available to compute suggestions. Run signal computation first."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {portfolio.rebalanceSuggestions.map((suggestion) => {
                    const isIncrease = suggestion.action === "INCREASE";
                    return (
                      <li key={suggestion.categoryId} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-200">{suggestion.categoryName}</span>
                          <span className={`text-xs font-semibold ${isIncrease ? "text-emerald-400" : "text-red-400"}`}>
                            {isIncrease ? "↑" : "↓"} {isIncrease ? "+" : ""}{suggestion.deltaPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {suggestion.currentAllocationPct.toFixed(1)}% current → {suggestion.optimalAllocationPct.toFixed(1)}% optimal
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {!portfolio && !loadError && (
          <div className="text-slate-500 text-sm text-center py-16">
            Loading portfolio…
          </div>
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
            </div>
          </div>

          {uploadError && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {uploadError}
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
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("quantity")}>
                      Qty <SortIcon field="quantity" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("avgCostLocal")}>
                      Avg Cost <SortIcon field="avgCostLocal" sortField={sortField} sortDir={sortDir} />
                    </th>
                    <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("currentPriceLocal")}>
                      Price <SortIcon field="currentPriceLocal" sortField={sortField} sortDir={sortDir} />
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
                          {h.categoryId ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-900/50 text-blue-300 border border-blue-800/40">
                              {h.categoryId}
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[10px]">Unclassified</span>
                          )}
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
                              ? `${h.currency === "EUR" ? "€" : "$"}${Number(h.avgCostLocal).toFixed(2)}`
                              : "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {h.currentPriceLocal != null ? (
                            <span className="text-slate-200">
                              {h.currency === "EUR" ? "€" : "$"}{Number(h.currentPriceLocal).toFixed(2)}
                              {h.priceDate && (
                                <span className="text-slate-600 text-[10px] ml-1">{h.priceDate}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-amber-500 text-xs" title="No live price — click Edit to enter manually">n/a</span>
                          )}
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
                          ) : (
                            <button
                              onClick={() => startEdit(h)}
                              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
