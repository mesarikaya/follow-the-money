"use client";

import { useState } from "react";
import { runBacktest, BacktestResult, EquityCurvePoint } from "@/lib/api";

const DEFAULT_START_DATE = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
const DEFAULT_END_DATE   = new Date().toISOString().split("T")[0];

function EquityCurveChart({ curve }: { curve: EquityCurvePoint[] }) {
  if (curve.length < 2) return <p className="text-xs text-slate-500 text-center py-8">Insufficient data to draw chart.</p>;

  const CHART_WIDTH  = 600;
  const CHART_HEIGHT = 160;
  const PADDING      = 20;

  const portfolioValues = curve.map(p => p.portfolioValue);
  const spyValues       = curve.map(p => p.spyValue);
  const allValues       = [...portfolioValues, ...spyValues];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  const toX = (index: number) => PADDING + (index / (curve.length - 1)) * (CHART_WIDTH - 2 * PADDING);
  const toY = (value: number) => CHART_HEIGHT - PADDING - ((value - minValue) / valueRange) * (CHART_HEIGHT - 2 * PADDING);

  const portfolioPoints = curve.map((p, i) => `${toX(i).toFixed(1)},${toY(p.portfolioValue).toFixed(1)}`).join(" ");
  const spyPoints       = curve.map((p, i) => `${toX(i).toFixed(1)},${toY(p.spyValue).toFixed(1)}`).join(" ");

  const startLabel = curve[0]?.date ?? "";
  const endLabel   = curve[curve.length - 1]?.date ?? "";

  return (
    <div>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full">
        <polyline points={portfolioPoints} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinejoin="round" />
        <polyline points={spyPoints}       fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 3" />
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
        <span>{startLabel}</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Strategy</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-400 inline-block" style={{borderTop: "1px dashed"}} /> SPY</span>
        </div>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

export default function BacktesterPage() {
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [topN, setTopN] = useState(5);
  const [signalThreshold, setSignalThreshold] = useState("");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

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
      });
      setResult(data);
    } catch (error) {
      setRunError(String(error));
    } finally {
      setIsRunning(false);
    }
  };

  const formatPct = (value: number | null | undefined) => {
    if (value == null) return "—";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatDecimal = (value: number | null | undefined) => {
    if (value == null) return "—";
    return value.toFixed(2);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center px-6 py-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-slate-300">Backtester</h1>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Strategy Parameters</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rebalance Frequency</label>
              <select
                value={rebalanceFrequency}
                onChange={(e) => setRebalanceFrequency(e.target.value as "WEEKLY" | "MONTHLY")}
                className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Top-N Categories</label>
              <input
                type="number"
                min="1"
                max="19"
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value) || 5)}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Min Composite Score (optional)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                placeholder="0.50"
                value={signalThreshold}
                onChange={(e) => setSignalThreshold(e.target.value)}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none placeholder-slate-600"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="w-full text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? "Running…" : "Run Backtest"}
              </button>
            </div>
          </div>
        </div>

        {runError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            {runError}
          </div>
        )}

        {result && (
          <>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-4">Equity Curve</h2>
              <EquityCurveChart curve={result.equityCurve} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Strategy Total Return",   value: formatPct(result.totalReturnPct),        color: result.totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Annualized Return",        value: formatPct(result.annualizedReturnPct),   color: result.annualizedReturnPct >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Max Drawdown",             value: `-${result.maxDrawdownPct?.toFixed(2)}%`,color: "text-red-400" },
                { label: "Sharpe Ratio",             value: formatDecimal(result.sharpeRatio),       color: (result.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-300" },
                { label: "SPY Total Return",         value: formatPct(result.spyTotalReturnPct),     color: "text-slate-400" },
                { label: "SPY Sharpe Ratio",         value: formatDecimal(result.spySharpeRatio),    color: "text-slate-400" },
              ].map((metric) => (
                <div key={metric.label} className="bg-slate-800/40 border border-slate-700/50 rounded px-3 py-2">
                  <p className="text-xs text-slate-500">{metric.label}</p>
                  <p className={`text-lg font-bold font-mono ${metric.color}`}>{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-600 flex gap-4">
              <span>Trading days: {result.tradingDays}</span>
              <span>·</span>
              <span>Run ID: {result.runId}</span>
            </div>
          </>
        )}

        {!result && !isRunning && !runError && (
          <div className="text-slate-600 text-sm text-center py-12">
            Configure the strategy parameters and click Run Backtest.
          </div>
        )}
      </main>
    </div>
  );
}
