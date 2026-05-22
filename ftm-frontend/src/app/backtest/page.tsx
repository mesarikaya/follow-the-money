"use client";

import { useState, useEffect } from "react";
import { runBacktest, fetchRecentBacktests, BacktestResult, EquityCurvePoint, RebalanceEvent } from "@/lib/api";

const DEFAULT_START_DATE = "2021-01-04";
const DEFAULT_END_DATE   = new Date().toISOString().split("T")[0];
const DATA_START         = "2019-05-16";

const CHART_W = 640;
const CHART_H = 200;
const PAD_L   = 48;
const PAD_R   = 16;
const PAD_T   = 16;
const PAD_B   = 28;

function EquityCurveChart({ curve, rebalanceDates }: { curve: EquityCurvePoint[]; rebalanceDates?: string[] }) {
  if (curve.length < 2) {
    return <p className="text-xs text-slate-500 text-center py-8">Insufficient data to draw chart.</p>;
  }

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  // Normalize to ratio starting at 1.0 so (val-1)*100 = % return
  const p0 = curve[0].portfolioValue || 1;
  const s0 = curve[0].spyValue || 1;
  const normalized = curve.map(p => ({
    date: p.date,
    portfolioValue: p.portfolioValue / p0,
    spyValue: p.spyValue / s0,
  }));

  const portfolioValues = normalized.map(p => p.portfolioValue);
  const spyValues       = normalized.map(p => p.spyValue);
  const allValues       = [...portfolioValues, ...spyValues];
  const minValue        = Math.min(...allValues);
  const maxValue        = Math.max(...allValues);
  const valueRange      = maxValue - minValue || 1;

  const toX = (i: number) => PAD_L + (i / (normalized.length - 1)) * innerW;
  const toY = (v: number) => PAD_T + (1 - (v - minValue) / valueRange) * innerH;

  const portfolioPoints = normalized.map((p, i) => `${toX(i).toFixed(1)},${toY(p.portfolioValue).toFixed(1)}`).join(" ");
  const spyPoints       = normalized.map((p, i) => `${toX(i).toFixed(1)},${toY(p.spyValue).toFixed(1)}`).join(" ");

  const fillPath = [
    `M ${toX(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)}`,
    ...normalized.map((p, i) => `L ${toX(i).toFixed(1)},${toY(p.portfolioValue).toFixed(1)}`),
    `L ${toX(normalized.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)}`,
    "Z",
  ].join(" ");

  // Y-axis grid lines: 5 horizontal lines — labels as % return from start
  const ySteps = 5;
  const yGridLines = Array.from({ length: ySteps }, (_, i) => {
    const frac = i / (ySteps - 1);
    const y    = PAD_T + frac * innerH;
    const val  = maxValue - frac * valueRange;
    const pct  = ((val - 1) * 100).toFixed(0);
    return { y, label: `${Number(pct) >= 0 ? "+" : ""}${pct}%` };
  });

  // X-axis labels: pick ~5 evenly spaced dates
  const xLabelIndices = [0, Math.floor(normalized.length * 0.25), Math.floor(normalized.length * 0.5), Math.floor(normalized.length * 0.75), normalized.length - 1];
  const xLabels = xLabelIndices.map(i => ({
    x: toX(i),
    label: normalized[i]?.date?.slice(0, 7) ?? "",
  }));

  // COVID annotation: check if Mar 2020 is in range
  const covidDate = "2020-03-01";
  const covidIdx  = normalized.findIndex(p => p.date >= covidDate);
  const showCovid = covidIdx > 0 && covidIdx < normalized.length - 1;
  const covidX    = showCovid ? toX(covidIdx) : null;

  const endPortfolioPct  = `${((normalized[normalized.length - 1].portfolioValue - 1) * 100).toFixed(1)}%`;
  const endSpyPct        = `${((normalized[normalized.length - 1].spyValue - 1) * 100).toFixed(1)}%`;
  const endStrategyY     = toY(normalized[normalized.length - 1].portfolioValue);
  const endSpyY          = toY(normalized[normalized.length - 1].spyValue);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full">
      {yGridLines.map(({ y, label }) => (
        <g key={y}>
          <line x1={PAD_L} y1={y.toFixed(1)} x2={CHART_W - PAD_R} y2={y.toFixed(1)} stroke="#334155" strokeWidth="0.5" />
          <text x={PAD_L - 4} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">{label}</text>
        </g>
      ))}

      {xLabels.map(({ x, label }) => (
        <text key={x} x={x.toFixed(1)} y={CHART_H - 6} fill="#64748b" fontSize="8" textAnchor="middle">{label}</text>
      ))}

      {showCovid && covidX && (
        <>
          <line x1={covidX.toFixed(1)} y1={PAD_T} x2={covidX.toFixed(1)} y2={PAD_T + innerH} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
          <text x={(covidX + 3).toFixed(1)} y={(PAD_T + 10).toFixed(1)} fill="#ef4444" fontSize="8" opacity="0.7">COVID</text>
        </>
      )}

      <path d={fillPath} fill="#3b82f6" fillOpacity="0.05" />
      <polyline points={spyPoints} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
      <polyline points={portfolioPoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx={(CHART_W - PAD_R).toFixed(1)} cy={endStrategyY.toFixed(1)} r="3" fill="#3b82f6" />
      <text x={(CHART_W - PAD_R - 5).toFixed(1)} y={(endStrategyY - 4).toFixed(1)} fill="#93c5fd" fontSize="8" textAnchor="end">{endPortfolioPct}</text>
      <circle cx={(CHART_W - PAD_R).toFixed(1)} cy={endSpyY.toFixed(1)} r="3" fill="#64748b" />
      <text x={(CHART_W - PAD_R - 5).toFixed(1)} y={(endSpyY - 4).toFixed(1)} fill="#94a3b8" fontSize="8" textAnchor="end">{endSpyPct}</text>

      {rebalanceDates && rebalanceDates.map((date) => {
        const idx = normalized.findIndex(p => p.date >= date);
        if (idx < 0) return null;
        const x = toX(idx);
        return (
          <line key={date} x1={x.toFixed(1)} y1={(PAD_T + innerH).toFixed(1)} x2={x.toFixed(1)} y2={(PAD_T + innerH + 5).toFixed(1)}
            stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
        );
      })}
    </svg>
  );
}

function RebalanceTimeline({ events }: { events: RebalanceEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-slate-500 py-4 text-center">No rebalance events recorded.</p>;
  }
  const initial = 10_000;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-slate-500 text-left">
            <th className="pb-2 pr-4 font-medium">#</th>
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 font-medium">Portfolio Value</th>
            <th className="pb-2 pr-4 font-medium">Return Since Start</th>
            <th className="pb-2 font-medium">Categories Held</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {events.map((ev, i) => {
            const returnPct = ((ev.portfolioValue - initial) / initial) * 100;
            return (
              <tr key={ev.date} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-1.5 pr-4 text-slate-600 tabular-nums">{i + 1}</td>
                <td className="py-1.5 pr-4 font-mono text-slate-300">{ev.date}</td>
                <td className="py-1.5 pr-4 font-mono tabular-nums text-slate-200">
                  ${ev.portfolioValue.toFixed(2)}
                </td>
                <td className={`py-1.5 pr-4 font-mono tabular-nums ${returnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                </td>
                <td className="py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {ev.categoryIds.map(id => (
                      <span key={id} className="px-1.5 py-0.5 text-[10px] font-mono bg-blue-900/40 text-blue-300 border border-blue-800/40 rounded">
                        {id}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color: string; tooltip?: string }) {
  return (
    <div className="space-y-0.5" title={tooltip}>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {label}
        {tooltip && <span className="cursor-help text-slate-600">(?)
</span>}
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
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
  const [recentRuns, setRecentRuns] = useState<BacktestResult[]>([]);

  useEffect(() => {
    fetchRecentBacktests().then(setRecentRuns).catch(() => {});
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
      });
      setResult(data);
      setRecentRuns(prev => [data, ...prev.filter(r => r.runId !== data.runId).slice(0, 9)]);
    } catch (error) {
      setRunError(String(error));
    } finally {
      setIsRunning(false);
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
        <div className="grid grid-cols-4 gap-5 min-h-0">

          {/* Left column: parameters */}
          <div className="col-span-1">
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
                    onChange={(e) => setRebalanceFrequency(e.target.value as "WEEKLY" | "MONTHLY")}
                    className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Top-N Categories
                    <span className="text-slate-600 ml-1 cursor-help" title="Hold this many categories with the highest composite scores. Equal weight applied.">(?)
</span>
                  </label>
                  <input type="number" min="1" max="19" value={topN} onChange={(e) => setTopN(parseInt(e.target.value) || 5)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    Min Composite Score (0–1)
                    <span className="text-slate-600 ml-1 cursor-help" title="Categories below this score are skipped and replaced with cash (BIL). Range 0–1.">(?)
</span>
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
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="w-full text-sm py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isRunning ? "Running…" : "▶ Run Backtest"}
                </button>
              </div>
            </div>
          </div>

          {/* Right 3 columns: results */}
          <div className="col-span-3 flex flex-col gap-5">
            {runError && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
                {runError}
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
                        Strategy (Top-{topN} {rebalanceFrequency === "WEEKLY" ? "weekly" : "monthly"})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-t border-dashed border-slate-400 opacity-60" />
                        SPY Benchmark
                      </span>
                    </div>
                  </div>
                  <EquityCurveChart curve={result.equityCurve} rebalanceDates={result.rebalanceHistory?.map(e => e.date)} />
                  <div className="text-[10px] text-slate-600 mt-1 text-center">
                    Hypothetical · Equal-weighted top-{topN} composite score categories · No transaction costs modeled · Blue ticks = rebalance events
                  </div>
                </div>

                {/* Alpha summary bar */}
                {(() => {
                  const excessReturn = result.totalReturnPct - result.spyTotalReturnPct;
                  const spyAnn = result.spyAnnualizedReturnPct ?? 0;
                  const annAlpha = result.annualizedReturnPct - spyAnn;
                  const sharpeDelta = (result.sharpeRatio ?? 0) - (result.spySharpeRatio ?? 0);
                  const isWin = excessReturn >= 0;
                  const color = isWin ? "text-emerald-400" : "text-red-400";
                  const bg = isWin ? "bg-emerald-900/20 border-emerald-700/40" : "bg-red-900/20 border-red-700/40";
                  return (
                    <div className={`border rounded-xl px-5 py-3 flex items-center gap-8 ${bg}`}>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">vs SPY Outcome</div>
                        <div className={`text-base font-bold ${color}`}>{isWin ? "Outperforms" : "Underperforms"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Excess Return</div>
                        <div className={`text-xl font-bold font-mono ${color}`}>{excessReturn >= 0 ? "+" : ""}{excessReturn.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Ann. Alpha</div>
                        <div className={`text-xl font-bold font-mono ${annAlpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>{annAlpha >= 0 ? "+" : ""}{annAlpha.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Sharpe Delta</div>
                        <div className={`text-xl font-bold font-mono ${sharpeDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>{sharpeDelta >= 0 ? "+" : ""}{sharpeDelta.toFixed(2)}</div>
                      </div>
                      <div className="ml-auto text-[10px] text-slate-600">
                        {result.rebalanceHistory?.length ?? 0} rebalances · {result.tradingDays} trading days
                      </div>
                    </div>
                  );
                })()}

                {/* Side-by-side metrics: Strategy | SPY */}
                <div className="grid grid-cols-2 gap-4">
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
                    </div>
                  </div>
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
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] font-mono text-slate-600">
                      {result.tradingDays} days · Run {result.runId.slice(0, 8)}
                    </div>
                  </div>
                </div>
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
                        <th className="pb-2 pr-3 font-medium text-right">Strategy</th>
                        <th className="pb-2 pr-3 font-medium text-right">SPY</th>
                        <th className="pb-2 pr-3 font-medium text-right">Excess</th>
                        <th className="pb-2 pr-3 font-medium text-right">DD</th>
                        <th className="pb-2 font-medium text-right">Sharpe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {recentRuns.map((run) => {
                        const excess = run.totalReturnPct - run.spyTotalReturnPct;
                        const isActive = result?.runId === run.runId;
                        return (
                          <tr key={run.runId} className={`transition-colors ${isActive ? "bg-blue-900/20" : "hover:bg-slate-800/40"}`}>
                            <td className="py-1.5 pr-3 font-mono text-slate-400 tabular-nums">
                              {run.runAt?.slice(0, 10) ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-400 tabular-nums">
                              {run.startDate?.slice(0, 7)} – {run.endDate?.slice(0, 7)}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-500">{run.rebalanceFrequency === "WEEKLY" ? "W" : "M"}</td>
                            <td className="py-1.5 pr-3 text-slate-500 tabular-nums">{run.topN}</td>
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
                            <td className={`py-1.5 font-mono tabular-nums text-right ${(run.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                              {run.sharpeRatio?.toFixed(2)}
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
