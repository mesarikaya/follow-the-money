"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { runBacktest, runBacktestSweep, runBacktestFrequencySweep, fetchRecentBacktests, fetchCategories, fetchMacro, BacktestResult, CategorySummary, MacroResponse } from "@/lib/api";
import { computeMonthlyReturns, computeSortino } from "@/lib/backtest/metrics";
import { EquityCurveChart, RollingReturnChart, RollingSharpeChart, DrawdownChart, AnnualReturnsChart, ROLL_WINDOW } from "@/components/backtest/charts";
import { DrawdownAnalysisTable, RiskAttributionPanel, MonthlyReturnsTable, HoldingHeatmap, RebalanceTimeline, SweepTable, RegimeBreakdownTable, FrequencySweepTable } from "@/components/backtest/tables";
import { deriveTradeSignal } from "@/lib/signals";

const DATA_START         = "2019-05-16";
// Default to the full available history rather than an arbitrary hardcoded year. A fixed 2021
// start happened to land on the strategy's weakest window (mega-cap concentration era), which made
// the backtest look broken by default; using all data avoids cherry-picking a sub-period.
const DEFAULT_START_DATE = DATA_START;
const DEFAULT_END_DATE   = new Date().toISOString().split("T")[0];























function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color: string; tooltip?: string }) {
  return (
    <div className="space-y-0.5" title={tooltip}>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help text-slate-600">(?)</span>}
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}








/**
 * Short label for a saved run's selection signal, e.g. "Mom 12-1", "Comp", or "Comp ⤵inv" when the
 * signal was inverted. Older runs saved before the config was persisted show "—".
 */
function signalLabel(run: BacktestResult): string {
  if (!run.signalSource) return "—";
  const base = run.signalSource === "MOMENTUM_12_1" ? "Mom 12-1" : "Comp";
  return run.invertSignal ? `${base} ⤵inv` : base;
}

/** Compact category-scope label for a saved run, e.g. "Equity" / "All" / "—" for older runs. */
function scopeLabel(run: BacktestResult): string {
  if (!run.categoryScope) return "—";
  return run.categoryScope === "EQUITY_SECTOR" ? "Equity" : run.categoryScope === "ALL" ? "All" : run.categoryScope;
}

export default function BacktesterPage() {
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY">("MONTHLY");
  const [categoryScope, setCategoryScope] = useState<"ALL" | "EQUITY_SECTORS_ONLY" | "TOP_LEVEL_ONLY">("TOP_LEVEL_ONLY");
  const [topN, setTopN] = useState(5);
  const [signalSource, setSignalSource] = useState<"COMPOSITE" | "MOMENTUM_12_1">("COMPOSITE");
  const [signalThreshold, setSignalThreshold] = useState("");
  // Realistic default trading cost (10 bps ≈ round-trip commission + spread for liquid ETFs).
  const [transactionCostBps, setTransactionCostBps] = useState(10);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<BacktestResult[]>([]);
  const [sweepResults, setSweepResults] = useState<BacktestResult[] | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [freqSweepResults, setFreqSweepResults] = useState<BacktestResult[] | null>(null);
  const [isFreqSweeping, setIsFreqSweeping] = useState(false);
  const [liveCategories, setLiveCategories] = useState<CategorySummary[]>([]);
  const [liveRegime, setLiveRegime] = useState<string | null>(null);
  const [regimeHistory, setRegimeHistory] = useState<MacroResponse["regimeHistory"]>([]);

  useEffect(() => {
    fetchRecentBacktests().then(setRecentRuns).catch(() => {});
    fetchCategories("MONTH").then(r => setLiveCategories(r.categories)).catch(() => {});
    fetchMacro().then(r => { setLiveRegime(r.regime); setRegimeHistory(r.regimeHistory ?? []); }).catch(() => {});
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const data = await runBacktest({
        startDate,
        endDate,
        rebalanceFrequency,
        topN,
        signalThreshold: signalThreshold ? parseFloat(signalThreshold) : undefined,
        categoryScope,
        transactionCostBps,
        signalSource,
      });
      setResult(data);
      setRecentRuns(prev => [data, ...prev.filter(r => r.runId !== data.runId).slice(0, 9)]);
    } catch (error) {
      setRunError(String(error));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSweep = async () => {
    setIsSweeping(true);
    setSweepResults(null);
    try {
      const data = await runBacktestSweep({
        startDate,
        endDate,
        rebalanceFrequency,
        signalThreshold: signalThreshold ? parseFloat(signalThreshold) : undefined,
        categoryScope,
        transactionCostBps,
        signalSource,
      });
      setSweepResults(data);
    } catch {} finally {
      setIsSweeping(false);
    }
  };

  const handleFrequencySweep = async () => {
    setIsFreqSweeping(true);
    setFreqSweepResults(null);
    try {
      const data = await runBacktestFrequencySweep({
        startDate,
        endDate,
        topN,
        signalThreshold: signalThreshold ? parseFloat(signalThreshold) : undefined,
        categoryScope,
        transactionCostBps,
        signalSource,
      });
      setFreqSweepResults(data);
    } catch {} finally {
      setIsFreqSweeping(false);
    }
  };

  const formatPct = (value: number | null | undefined) => {
    if (value == null) return "—";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const formatDecimal = (value: number | null | undefined) => value == null ? "—" : value.toFixed(2);

  const winColor  = "text-emerald-400";
  const lossColor = "text-red-400";
  const neutColor = "text-slate-300";

  const inputCls = "w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none";
  const labelCls = "text-xs text-slate-500 block mb-1";

  type LiveCat = CategorySummary & { signal: "BUY" | "WATCH" | "HOLD" | "REDUCE" | null };
  const withSignals: LiveCat[] = liveCategories.map(cat => ({
    ...cat,
    signal: (cat.tradeSignal as "BUY" | "WATCH" | "HOLD" | "REDUCE" | null) ?? deriveTradeSignal(cat),
  }));
  const buySignals = withSignals.filter(c => c.signal === "BUY").sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const watchSignals = withSignals.filter(c => c.signal === "WATCH").sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)).slice(0, 6);
  const reduceSignals = withSignals.filter(c => c.signal === "REDUCE").slice(0, 4);
  const topNLive = withSignals.filter(c => c.signal === "BUY" || c.signal === "WATCH").sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)).slice(0, topN);
  const hasLiveData = liveCategories.length > 0 && liveCategories.some(c => c.compositeScore != null);

  const REGIME_LABEL: Record<string, { label: string; color: string }> = {
    RISK_ON_GROWTH:    { label: "Risk-On Growth",     color: "text-green-400"  },
    RISK_ON_DEFENSIVE: { label: "Risk-On Defensive",  color: "text-cyan-400"   },
    RISK_OFF_FLIGHT:   { label: "Risk-Off / Flight",  color: "text-orange-400" },
    STAGFLATION:       { label: "Stagflation",        color: "text-red-400"    },
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <h1
          className="text-slate-100 font-bold"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
        >
          Backtester
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Historical rotation strategy vs SPY buy-and-hold. Rebalances into top-N sectors by composite score.
          <span className="ml-2 text-slate-600">Data available from {DATA_START}.</span>
        </p>
      </header>

      <main className="flex-1 overflow-auto p-6">

        {/* Live Recommendations Panel */}
        {hasLiveData && (
          <div className="mb-5 bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-semibold text-slate-200">Live Signal — What the Strategy Holds Today</span>
              </div>
              <div className="flex items-center gap-3">
                {liveRegime && (() => {
                  const rc = REGIME_LABEL[liveRegime];
                  return rc ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60">
                      Regime: <span className={`font-semibold ${rc.color}`}>{rc.label}</span>
                    </span>
                  ) : null;
                })()}
                <span className="text-[10px] text-slate-500">Based on current composite scores</span>
              </div>
            </div>
            <div className="p-4 space-y-3">

              {/* Top-N portfolio preview */}
              {topNLive.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>Top-{topN} Holdings (current strategy picks)</span>
                    <span className="text-slate-600">— equal-weighted if run today</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topNLive.map((cat, i) => {
                      const sig = cat.signal;
                      const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
                      const rrg = cat.rrgQuadrant;
                      const quadrantLabel = rrg === "4" ? "↗ Leading" : rrg === "3" ? "↖ Improving" : rrg === "2" ? "↘ Weakening" : rrg === "1" ? "↙ Lagging" : null;
                      const sigCls = sig === "BUY"
                        ? "bg-green-900/50 border-green-700/60 text-green-300"
                        : sig === "WATCH"
                        ? "bg-cyan-900/40 border-cyan-700/50 text-cyan-300"
                        : "bg-slate-700/50 border-slate-600/60 text-slate-400";
                      const hasDrilldown = !cat.id.includes("_") && !["GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH","FTRS"].includes(cat.id);
                      const Wrapper = hasDrilldown ? Link : "div" as unknown as typeof Link;
                      return (
                        <Wrapper key={cat.id} href={hasDrilldown ? `/sectors/${cat.id}` : "#"} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-opacity ${hasDrilldown ? "hover:opacity-80 cursor-pointer" : ""} ${sigCls}`}
                          title={`${cat.name} (${cat.etfTicker}) — Score: ${score ?? "??"}/100${quadrantLabel ? ` — RRG: ${quadrantLabel}` : ""}${cat.macroFit != null ? ` — Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""}${hasDrilldown ? " — click to open sector drilldown" : ""}`}>
                          <span className="text-[10px] text-slate-500 tabular-nums w-3 shrink-0">{i + 1}</span>
                          <span className="font-mono font-bold text-sm">{cat.etfTicker}</span>
                          <span className="text-[10px] text-slate-400 hidden md:inline">{cat.name}</span>
                          {score != null && (
                            <span className="text-[10px] tabular-nums opacity-70">{score}/100</span>
                          )}
                          {sig && (
                            <span className={`text-[9px] font-bold uppercase opacity-80`}>{sig}</span>
                          )}
                          {hasDrilldown && <span className="text-[9px] text-slate-600 ml-0.5">↗</span>}
                        </Wrapper>
                      );
                    })}
                    {topNLive.length < topN && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600/40 bg-slate-700/20 text-slate-600 text-[10px]">
                        {topN - topNLive.length}× CASH (BIL) — no qualifying signal
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BUY / WATCH / REDUCE breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/40">
                <div>
                  <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1.5 font-semibold">BUY ({buySignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {buySignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {buySignals.map(cat => (
                      <Link key={cat.id} href={`/sectors/${cat.id}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-800/50 hover:bg-green-900/70 transition-colors"
                        title={`${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${cat.macroFit != null ? `, Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""} — click to open drilldown`}>
                        {cat.etfTicker}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score ≥65 + RRG 3/4 + positive trend</div>
                </div>
                <div>
                  <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1.5 font-semibold">WATCH ({watchSignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {watchSignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {watchSignals.map(cat => {
                      const hasDrilldown = !cat.id.includes("_") && !["GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH","FTRS"].includes(cat.id);
                      const title = `${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${cat.macroFit != null ? `, Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""}${hasDrilldown ? " — click to open drilldown" : ""}`;
                      return hasDrilldown ? (
                        <Link key={cat.id} href={`/sectors/${cat.id}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40 hover:bg-cyan-900/60 transition-colors"
                          title={title}>
                          {cat.etfTicker}
                        </Link>
                      ) : (
                        <span key={cat.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40" title={title}>
                          {cat.etfTicker}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score ≥50 + improving RRG or trend</div>
                </div>
                <div>
                  <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 font-semibold">REDUCE ({reduceSignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {reduceSignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {reduceSignals.map(cat => {
                      const hasDrilldown = !cat.id.includes("_") && !["GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH","FTRS"].includes(cat.id);
                      const title = `${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${hasDrilldown ? " — click to open drilldown" : ""}`;
                      return hasDrilldown ? (
                        <Link key={cat.id} href={`/sectors/${cat.id}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-900/60 transition-colors"
                          title={title}>
                          {cat.etfTicker}
                        </Link>
                      ) : (
                        <span key={cat.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40" title={title}>
                          {cat.etfTicker}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score &lt;35 + lagging/weakening RRG</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-700/30">
                Live data — scores update after each market close. Hover any ticker for details. BUY = all three conditions aligned; WATCH = two conditions met; run a backtest below to see historical performance.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-5 min-h-0">

          {/* Left column: parameters */}
          <div className="col-span-1">

            {/* Quick Presets */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 mb-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Quick Presets</div>
              <div className="flex flex-col gap-1.5">
                {([
                  {
                    label: "Conservative Rotation",
                    desc: "Monthly rebalance, top 3 GICS sectors, no threshold",
                    apply: () => { setRebalanceFrequency("MONTHLY"); setTopN(3); setCategoryScope("EQUITY_SECTORS_ONLY"); setSignalThreshold(""); },
                  },
                  {
                    label: "Balanced All-Asset",
                    desc: "Monthly, top 5 including Gold & Bonds as defensive",
                    apply: () => { setRebalanceFrequency("MONTHLY"); setTopN(5); setCategoryScope("TOP_LEVEL_ONLY"); setSignalThreshold(""); },
                  },
                  {
                    label: "Aggressive Momentum",
                    desc: "Weekly, top 3, min score 0.50 — only strong signals",
                    apply: () => { setRebalanceFrequency("WEEKLY"); setTopN(3); setCategoryScope("EQUITY_SECTORS_ONLY"); setSignalThreshold("0.50"); },
                  },
                  {
                    label: "Quality Filter",
                    desc: "Quarterly rebalance, top 5, min score 0.60",
                    apply: () => { setRebalanceFrequency("QUARTERLY"); setTopN(5); setCategoryScope("TOP_LEVEL_ONLY"); setSignalThreshold("0.60"); },
                  },
                ] as const).map(preset => (
                  <button
                    key={preset.label}
                    onClick={preset.apply}
                    className="text-left px-2.5 py-2 rounded-lg bg-slate-700/40 border border-slate-600/40 hover:bg-slate-700/70 hover:border-slate-500/60 transition-colors group"
                  >
                    <div className="text-[11px] font-semibold text-slate-300 group-hover:text-slate-100">{preset.label}</div>
                    <div className="text-[9px] text-slate-600 group-hover:text-slate-500 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 sticky top-0">
              <h2 className="text-sm font-semibold text-slate-200 mb-4">Strategy Parameters</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Rebalance Frequency</label>
                  <select
                    value={rebalanceFrequency}
                    onChange={(e) => setRebalanceFrequency(e.target.value as "WEEKLY" | "MONTHLY" | "QUARTERLY")}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Universe
                    <span className="text-slate-600 ml-1 cursor-help" title="Which categories compete for allocation. 'Equity Sectors Only' forces TECH/HLTH/FINL etc. to compete against each other — use for pure sector rotation (this is what the live portfolio recommendations use). 'All Top-Level' adds Gold, Metals (Silver/Miners), Bonds, and Cash as defensive alternatives — use this to test dual-momentum rotation into metals & bonds. 'All' also includes sub-sectors and factor ETFs.">(?)</span>
                  </label>
                  <select
                    value={categoryScope}
                    onChange={(e) => setCategoryScope(e.target.value as "ALL" | "EQUITY_SECTORS_ONLY" | "TOP_LEVEL_ONLY")}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="EQUITY_SECTORS_ONLY">Equity Sectors Only (GICS)</option>
                    <option value="TOP_LEVEL_ONLY">All Top-Level (+ Gold, Metals, Bonds)</option>
                    <option value="ALL">All (incl. Sub-Sectors)</option>
                  </select>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {categoryScope === "EQUITY_SECTORS_ONLY" && "Tech vs Financials vs Energy etc. — pure GICS rotation (live-recommendation universe)"}
                    {categoryScope === "TOP_LEVEL_ONLY" && "Adds Gold/Silver/Miners/TLT/BIL — test dual-momentum rotation in risk-off regimes"}
                    {categoryScope === "ALL" && "Broadest universe — sub-sectors may dilute signals"}
                  </p>
                </div>
                <div>
                  <label className={labelCls}>
                    Signal Source
                    <span className="text-slate-600 ml-1 cursor-help" title="Which score ranks the categories. 'Composite' is the multi-factor theory model. '12-1 Momentum' is the classic trailing-12-month return that skips the most recent month (Jegadeesh-Titman) — validated as the stronger sector-selection signal, especially in rotational regimes. Needs ~1 year of price history before it produces a signal.">(?)</span>
                  </label>
                  <select
                    value={signalSource}
                    onChange={(e) => setSignalSource(e.target.value as "COMPOSITE" | "MOMENTUM_12_1")}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="COMPOSITE">Composite (theory model)</option>
                    <option value="MOMENTUM_12_1">12-1 Momentum (skip-month)</option>
                  </select>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {signalSource === "COMPOSITE" && "Multi-factor blend (RS, persistence, RRG). Rank-1 has historically underperformed."}
                    {signalSource === "MOMENTUM_12_1" && "Trailing 12m return, skipping last month. Stronger selection signal; needs ~1yr history."}
                  </p>
                </div>
                <div>
                  <label className={labelCls}>
                    Top-N Categories
                    <span className="text-slate-600 ml-1 cursor-help" title="Hold this many categories with the highest composite scores. Equal weight applied.">(?)</span>
                  </label>
                  <input type="number" min="1" max="19" value={topN} onChange={(e) => setTopN(parseInt(e.target.value) || 5)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    Min Composite Score (0–1)
                    <span className="text-slate-600 ml-1 cursor-help" title="Categories below this score are skipped and replaced with cash (BIL). Range 0–1.">(?)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    placeholder="e.g. 0.50"
                    value={signalThreshold}
                    onChange={(e) => setSignalThreshold(e.target.value)}
                    className={`${inputCls} placeholder-slate-600`}
                  />
                  <p className="text-[10px] text-slate-600 mt-1">Categories below threshold → cash instead</p>
                </div>
                <div>
                  <label className={labelCls}>
                    Transaction Cost (bps)
                    <span className="text-slate-600 ml-1 cursor-help" title="Trading cost charged on turnover at each rebalance (1 bp = 0.01%). ~10 bps is realistic for liquid ETFs; set 0 for a frictionless comparison.">(?)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={transactionCostBps}
                    onChange={(e) => setTransactionCostBps(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate-600 mt-1">Charged on turnover per rebalance · 0 = frictionless</p>
                </div>
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="w-full text-sm py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isRunning ? "Running…" : "▶ Run Backtest"}
                </button>
                <button
                  onClick={handleSweep}
                  disabled={isSweeping || isRunning}
                  className="w-full text-xs py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-600"
                  title="Run the backtest for all topN values (1–12) and compare performance. Takes ~15s."
                >
                  {isSweeping ? "Sweeping…" : "⚡ Sweep topN 1–12"}
                </button>
                <button
                  onClick={handleFrequencySweep}
                  disabled={isFreqSweeping || isRunning}
                  className="w-full text-xs py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-600"
                  title="Compare weekly, monthly, and quarterly rebalance frequencies. Takes ~5s."
                >
                  {isFreqSweeping ? "Sweeping…" : "⚡ Sweep W/M/Q freq"}
                </button>
              </div>
            </div>
          </div>

          {/* Right 3 columns: results */}
          <div className="col-span-3 flex flex-col gap-5">
            {runError && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm space-y-1">
                <div className="font-semibold">Backtest failed</div>
                <div className="text-red-400/80 text-[11px]">{runError}</div>
                {(runError.includes("price data") || runError.includes("benchmark")) && (
                  <div className="text-red-400/60 text-[11px] mt-1">
                    Tip: the backtest needs historical ETF price data and SPY benchmark history for the
                    range. Try a more recent start date, or run the ingestion pipeline first.
                  </div>
                )}
                {runError.includes("composite scores") && (
                  <div className="text-red-400/60 text-[11px] mt-1">
                    Tip: signal computation hasn&apos;t produced scores for this range. Run signal
                    computation, or shorten the window to the period with available data.
                  </div>
                )}
              </div>
            )}

            {!result && !isRunning && !runError && (
              <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
                Configure strategy parameters and click Run Backtest.
              </div>
            )}

            {result && (
              <>
                {/* Equity Curve */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-200">Equity Curve</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 h-0.5 bg-blue-400" />
                        Strategy (Top-{topN} {rebalanceFrequency === "WEEKLY" ? "weekly" : rebalanceFrequency === "QUARTERLY" ? "quarterly" : "monthly"})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-t border-dashed border-slate-400 opacity-60" />
                        SPY Benchmark
                      </span>
                      <button
                        onClick={() => {
                          const p0 = result.equityCurve[0]?.portfolioValue || 1;
                          const s0 = result.equityCurve[0]?.spyValue || 1;
                          const header = "date,portfolio_value,spy_value,portfolio_pct,spy_pct";
                          const rows = result.equityCurve.map(pt =>
                            `${pt.date},${pt.portfolioValue.toFixed(4)},${pt.spyValue.toFixed(4)},${((pt.portfolioValue/p0-1)*100).toFixed(4)},${((pt.spyValue/s0-1)*100).toFixed(4)}`
                          );
                          const csv = [header, ...rows].join("\n");
                          const blob = new Blob([csv], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `backtest_equity_${result.startDate}_${result.endDate}_top${topN}_${rebalanceFrequency.toLowerCase()}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Download equity curve as CSV"
                      >
                        ↓ CSV
                      </button>
                    </div>
                  </div>
                  <EquityCurveChart curve={result.equityCurve} rebalanceDates={result.rebalanceHistory?.map(e => e.date)} />
                  <div className="mt-2 border-t border-slate-700/40 pt-2">
                    <DrawdownChart curve={result.equityCurve} />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1 text-center">
                    Hypothetical · Equal-weighted top-{topN} composite score categories · {transactionCostBps > 0 ? `${transactionCostBps} bps transaction cost on turnover` : "No transaction costs (0 bps)"} · Blue ticks = rebalance events · Lower panel = rolling drawdown from peak
                  </div>
                </div>

                {/* Alpha summary bar */}
                {(() => {
                  const excessReturn = result.totalReturnPct - result.spyTotalReturnPct;
                  const spyAnn = result.spyAnnualizedReturnPct ?? 0;
                  const annAlpha = result.annualizedReturnPct - spyAnn;
                  const sharpeDelta = (result.sharpeRatio ?? 0) - (result.spySharpeRatio ?? 0);
                  const sortinoDelta = result.sortinoRatio != null && result.spySortinoRatio != null
                    ? result.sortinoRatio - result.spySortinoRatio : null;
                  // Period win rate: % of calendar months where strategy beat SPY
                  const monthlyRows = result.equityCurve?.length > 2 ? computeMonthlyReturns(result.equityCurve) : [];
                  const beatMonths = monthlyRows.filter(r => r.port > r.spy).length;
                  const totalMonths = monthlyRows.length;
                  const winRatePct = totalMonths > 0 ? Math.round((beatMonths / totalMonths) * 100) : null;
                  const isWin = excessReturn >= 0;
                  const color = isWin ? "text-emerald-400" : "text-red-400";
                  const bg = isWin ? "bg-emerald-900/20 border-emerald-700/40" : "bg-red-900/20 border-red-700/40";
                  return (
                    <div className={`border rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap ${bg}`}>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">vs SPY Outcome</div>
                        <div className={`text-base font-bold ${color}`}>{isWin ? "Outperforms" : "Underperforms"}</div>
                      </div>
                      <div title={`Strategy total return (${result.totalReturnPct?.toFixed(2)}%) minus SPY total return (${result.spyTotalReturnPct?.toFixed(2)}%) over the same period`}>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Cumulative Alpha (vs SPY)</div>
                        <div className={`text-xl font-bold font-mono ${color}`}>{excessReturn >= 0 ? "+" : ""}{excessReturn.toFixed(2)}%</div>
                        <div className="text-[9px] text-slate-500">{result.totalReturnPct?.toFixed(1)}% − {result.spyTotalReturnPct?.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Ann. Alpha</div>
                        <div className={`text-xl font-bold font-mono ${annAlpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>{annAlpha >= 0 ? "+" : ""}{annAlpha.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Sharpe Delta</div>
                        <div className={`text-xl font-bold font-mono ${sharpeDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>{sharpeDelta >= 0 ? "+" : ""}{sharpeDelta.toFixed(2)}</div>
                      </div>
                      {sortinoDelta != null && (
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Sortino Delta</div>
                          <div className={`text-xl font-bold font-mono ${sortinoDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>{sortinoDelta >= 0 ? "+" : ""}{sortinoDelta.toFixed(2)}</div>
                        </div>
                      )}
                      {winRatePct != null && (
                        <div title={`Beat SPY in ${beatMonths} of ${totalMonths} calendar months`}>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Monthly Win Rate</div>
                          <div className={`text-xl font-bold font-mono ${winRatePct >= 55 ? "text-emerald-400" : winRatePct >= 45 ? "text-slate-300" : "text-red-400"}`}>
                            {winRatePct}%
                          </div>
                          <div className="text-[9px] text-slate-600">{beatMonths}/{totalMonths} months</div>
                        </div>
                      )}
                      <div className="ml-auto text-[10px] text-slate-600">
                        {result.rebalanceHistory?.length ?? 0} rebalances · {result.tradingDays} trading days
                      </div>
                    </div>
                  );
                })()}

                {/* Risk Attribution panel */}
                {result.equityCurve && result.equityCurve.length > 30 && (
                  <RiskAttributionPanel curve={result.equityCurve} />
                )}

                {/* Side-by-side metrics: Strategy | Equal-Weight | SPY */}
                <div className={`grid gap-4 ${result.equalWeightTotalReturnPct != null ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2"}`}>
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                      Strategy (Top-{topN})
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Total Return" value={formatPct(result.totalReturnPct)} color={result.totalReturnPct >= 0 ? winColor : lossColor} tooltip="Cumulative percentage gain from start to end of backtest, before fees." />
                      <MetricCard label="Ann. Return" value={formatPct(result.annualizedReturnPct)} color={result.annualizedReturnPct >= 0 ? winColor : lossColor} tooltip="CAGR: compound annual growth rate." />
                      <MetricCard label="Max Drawdown" value={`-${result.maxDrawdownPct?.toFixed(2)}%`} color={lossColor} tooltip="Largest peak-to-trough decline. Lower is better." />
                      <MetricCard label="Sharpe Ratio" value={formatDecimal(result.sharpeRatio)} color={(result.sharpeRatio ?? 0) >= 1 ? winColor : neutColor} tooltip="Ann. return / ann. volatility. >1.0 = good, >2.0 = excellent." />
                      {(() => {
                        const calmar = result.calmarRatio ?? (result.maxDrawdownPct > 0 ? result.annualizedReturnPct / result.maxDrawdownPct : null);
                        if (calmar == null) return null;
                        return <MetricCard label="Calmar Ratio" value={calmar.toFixed(2)} color={calmar >= 1.5 ? winColor : calmar >= 0.5 ? neutColor : lossColor} tooltip="Ann. return ÷ max drawdown. >1.5 = good; favored by trend-following funds." />;
                      })()}
                      {(() => {
                        const sortino = result.sortinoRatio ?? computeSortino(result.equityCurve, false);
                        if (sortino == null) return null;
                        return <MetricCard label="Sortino Ratio" value={sortino.toFixed(2)} color={sortino >= 1.5 ? winColor : sortino >= 0.7 ? neutColor : lossColor} tooltip="Ann. return / downside deviation (negative-return days only). Better than Sharpe for asymmetric return profiles. >1.5 = excellent." />;
                      })()}
                    </div>
                  </div>
                  {result.equalWeightTotalReturnPct != null && (
                  <div className="bg-slate-800/50 border border-amber-700/40 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                      Equal-Weight
                      <span
                        className="text-[10px] text-slate-600 cursor-help normal-case font-normal"
                        title="Holds every in-scope category equal-weighted on the same rebalance schedule (no cost). If the strategy can't beat this, the composite signal adds no value over naive diversification."
                      >(?)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Total Return" value={formatPct(result.equalWeightTotalReturnPct)} color={(result.equalWeightTotalReturnPct ?? 0) > result.totalReturnPct ? lossColor : "text-amber-200"} tooltip="Equal-weight benchmark cumulative return. Red if it beat the strategy." />
                      <MetricCard label="Ann. Return" value={formatPct(result.equalWeightAnnualizedReturnPct)} color="text-amber-200" tooltip="Equal-weight CAGR over the backtest period." />
                      <MetricCard label="Max Drawdown" value={result.equalWeightMaxDrawdownPct != null ? `-${result.equalWeightMaxDrawdownPct.toFixed(2)}%` : "—"} color="text-amber-200" tooltip="Largest peak-to-trough decline for the equal-weight benchmark." />
                      <MetricCard label="Sharpe Ratio" value={formatDecimal(result.equalWeightSharpeRatio)} color={(result.equalWeightSharpeRatio ?? 0) > (result.sharpeRatio ?? 0) ? lossColor : "text-amber-200"} tooltip="Equal-weight risk-adjusted return. Red if it beat the strategy's Sharpe." />
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500">
                      {(result.equalWeightTotalReturnPct ?? 0) > result.totalReturnPct
                        ? "⚠ Signal underperforms naive diversification"
                        : "Signal beats equal-weight"}
                    </div>
                  </div>
                  )}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-slate-500 inline-block" />
                      SPY Benchmark
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard label="Total Return" value={formatPct(result.spyTotalReturnPct)} color={result.spyTotalReturnPct >= 0 ? "text-slate-300" : lossColor} />
                      <MetricCard label="Ann. Return" value={formatPct(result.spyAnnualizedReturnPct)} color="text-slate-300" tooltip="SPY CAGR over the backtest period." />
                      <MetricCard label="Max Drawdown" value={result.spyMaxDrawdownPct != null ? `-${result.spyMaxDrawdownPct.toFixed(2)}%` : "—"} color="text-slate-300" tooltip="Largest peak-to-trough decline for SPY." />
                      <MetricCard label="Sharpe Ratio" value={formatDecimal(result.spySharpeRatio)} color="text-slate-300" />
                      {(() => {
                        const spyCalmar = result.spyCalmarRatio ?? (result.spyAnnualizedReturnPct != null && result.spyMaxDrawdownPct != null && result.spyMaxDrawdownPct > 0
                          ? result.spyAnnualizedReturnPct / result.spyMaxDrawdownPct : null);
                        if (spyCalmar == null) return null;
                        return <MetricCard label="Calmar Ratio" value={spyCalmar.toFixed(2)} color="text-slate-300" tooltip="SPY ann. return ÷ max drawdown." />;
                      })()}
                      {(() => {
                        const spySortino = result.spySortinoRatio ?? computeSortino(result.equityCurve, true);
                        if (spySortino == null) return null;
                        return <MetricCard label="Sortino Ratio" value={spySortino.toFixed(2)} color="text-slate-300" tooltip="SPY ann. return / downside deviation." />;
                      })()}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] font-mono text-slate-600">
                      {result.tradingDays} days · Run {result.runId.slice(0, 8)}
                    </div>
                  </div>
                </div>
                {/* Drawdown analysis */}
                {result.equityCurve && result.equityCurve.length > 30 && (
                  <DrawdownAnalysisTable curve={result.equityCurve} />
                )}

                {/* Monthly returns calendar */}
                {result.equityCurve && result.equityCurve.length > 2 && (
                  <MonthlyReturnsTable curve={result.equityCurve} />
                )}

                {/* Annual returns bar chart */}
                {result.equityCurve && result.equityCurve.length > 30 && (
                  <AnnualReturnsChart curve={result.equityCurve} />
                )}

                {/* Rolling 1-year return chart */}
                {result.equityCurve && result.equityCurve.length > ROLL_WINDOW && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-200">Rolling 1-Year Return</div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-blue-400" />Strategy</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t border-dashed border-slate-400 opacity-60" />SPY</span>
                        <span>Green = positive 1Y return · Red = drawdown period</span>
                      </div>
                    </div>
                    <RollingReturnChart curve={result.equityCurve} />
                    <div className="text-[10px] text-slate-600 mt-1 text-center">
                      Each point = trailing 252-day (1-year) return at that date. Shows consistency of strategy edge vs SPY over time.
                    </div>
                  </div>
                )}

                {/* Rolling Sharpe ratio chart */}
                {result.equityCurve && result.equityCurve.length > ROLL_WINDOW + 5 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-200">Rolling 1-Year Sharpe</div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-violet-400" />Sharpe (vs SPY)</span>
                        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t border-dashed border-blue-600" />Target: 1.0</span>
                      </div>
                    </div>
                    <RollingSharpeChart curve={result.equityCurve} />
                    <div className="text-[10px] text-slate-600 mt-1 text-center">
                      Rolling 252-day Sharpe ratio of excess returns vs SPY. Above 0 = outperforming risk-adjusted · Above 1 = strong edge
                    </div>
                  </div>
                )}

                {/* Regime breakdown table */}
                {result.equityCurve && result.equityCurve.length > 0 && regimeHistory.length > 0 && (
                  <RegimeBreakdownTable curve={result.equityCurve} history={regimeHistory} />
                )}

                {/* Rotation Heatmap */}
                {result.rebalanceHistory && result.rebalanceHistory.length >= 2 && result.equityCurve && (
                  <HoldingHeatmap events={result.rebalanceHistory} curve={result.equityCurve} />
                )}

                {/* Rebalance Timeline */}
                {result.rebalanceHistory && result.rebalanceHistory.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-slate-200">Rebalance Timeline</div>
                      <span className="text-xs text-slate-500">{result.rebalanceHistory.length} rebalances · $10,000 start</span>
                    </div>
                    <RebalanceTimeline events={result.rebalanceHistory} />
                  </div>
                )}
              </>
            )}

            {/* Sweep results — shown when sweep completes */}
            {sweepResults && sweepResults.length > 0 && (
              <SweepTable rows={sweepResults} currentTopN={topN} />
            )}

            {/* Frequency sweep results */}
            {freqSweepResults && freqSweepResults.length > 0 && (
              <FrequencySweepTable rows={freqSweepResults} currentFrequency={rebalanceFrequency} />
            )}

            {/* Recent Runs — always visible */}
            {recentRuns.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-200 mb-3">Recent Runs</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-500 text-left">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium">Range</th>
                        <th className="pb-2 pr-3 font-medium">Freq</th>
                        <th className="pb-2 pr-3 font-medium">N</th>
                        <th className="pb-2 pr-3 font-medium">Signal</th>
                        <th className="pb-2 pr-3 font-medium">Scope</th>
                        <th className="pb-2 pr-3 font-medium text-right">Strategy</th>
                        <th className="pb-2 pr-3 font-medium text-right">SPY</th>
                        <th className="pb-2 pr-3 font-medium text-right">Excess</th>
                        <th className="pb-2 pr-3 font-medium text-right">DD</th>
                        <th className="pb-2 pr-3 font-medium text-right">Sharpe</th>
                        <th className="pb-2 pr-3 font-medium text-right">Sortino</th>
                        <th className="pb-2 font-medium text-right">Calmar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {recentRuns.map((run) => {
                        const excess = run.totalReturnPct - run.spyTotalReturnPct;
                        const isActive = result?.runId === run.runId;
                        return (
                          <tr key={run.runId} className={`transition-colors cursor-pointer ${isActive ? "bg-blue-900/20" : "hover:bg-slate-800/40"}`} onClick={() => setResult(run)} title="Click to load this run">
                            <td className="py-1.5 pr-3 font-mono text-slate-400 tabular-nums">
                              {run.runAt?.slice(0, 10) ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-400 tabular-nums">
                              {run.startDate?.slice(0, 7)} – {run.endDate?.slice(0, 7)}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-500">{run.rebalanceFrequency === "WEEKLY" ? "W" : run.rebalanceFrequency === "QUARTERLY" ? "Q" : "M"}</td>
                            <td className="py-1.5 pr-3 text-slate-500 tabular-nums">{run.topN}</td>
                            <td className={`py-1.5 pr-3 whitespace-nowrap ${run.signalSource === "MOMENTUM_12_1" ? "text-sky-300" : "text-slate-400"}`}>{signalLabel(run)}</td>
                            <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{scopeLabel(run)}</td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${run.totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {run.totalReturnPct >= 0 ? "+" : ""}{run.totalReturnPct?.toFixed(1)}%
                            </td>
                            <td className="py-1.5 pr-3 font-mono tabular-nums text-slate-400 text-right">
                              {run.spyTotalReturnPct >= 0 ? "+" : ""}{run.spyTotalReturnPct?.toFixed(1)}%
                            </td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${excess >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {excess >= 0 ? "+" : ""}{excess.toFixed(1)}%
                            </td>
                            <td className="py-1.5 pr-3 font-mono tabular-nums text-red-400 text-right">
                              -{run.maxDrawdownPct?.toFixed(1)}%
                            </td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(run.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.sharpeRatio?.toFixed(2)}
                            </td>
                            <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(run.sortinoRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.sortinoRatio != null ? run.sortinoRatio.toFixed(2) : "—"}
                            </td>
                            <td className={`py-1.5 font-mono tabular-nums text-right ${(run.calmarRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.calmarRatio != null ? run.calmarRatio.toFixed(2) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
