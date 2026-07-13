"use client";

import { UseBacktestResult } from "@/app/backtest/useBacktest";

/** The strategy configuration: what to hold, how often to rebalance, and what it costs to trade. */

const inputCls =
  "w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none";
const labelCls = "text-xs text-slate-500 block mb-1";

export function BacktestForm({ backtest }: { backtest: UseBacktestResult }) {
  const {
    startDate, setStartDate,
    endDate, setEndDate,
    rebalanceFrequency, setRebalanceFrequency,
    categoryScope, setCategoryScope,
    topN, setTopN,
    signalSource, setSignalSource,
    signalThreshold, setSignalThreshold,
    transactionCostBps, setTransactionCostBps,
    isRunning,
    isSweeping, isFreqSweeping,
    handleRun, handleSweep, handleFrequencySweep,
  } = backtest;

  return (
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
  );
}
