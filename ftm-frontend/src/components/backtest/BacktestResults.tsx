"use client";

import { UseBacktestResult } from "@/app/backtest/useBacktest";
import { computeMonthlyReturns, computeSortino } from "@/lib/backtest/metrics";
import {
  AnnualReturnsChart,
  DrawdownChart,
  EquityCurveChart,
  ROLL_WINDOW,
  RollingReturnChart,
  RollingSharpeChart,
} from "@/components/backtest/charts";
import {
  DrawdownAnalysisTable,
  FrequencySweepTable,
  HoldingHeatmap,
  MonthlyReturnsTable,
  RebalanceTimeline,
  RegimeBreakdownTable,
  RiskAttributionPanel,
  SweepTable,
} from "@/components/backtest/tables";
import { MetricCard } from "@/components/backtest/MetricCard";
import { scopeLabel, signalLabel } from "@/components/backtest/runLabels";

/** Everything a completed run has to say: the headline metrics, the curves, and the breakdowns. */

const formatPct = (value: number | null | undefined) =>
  value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const formatDecimal = (value: number | null | undefined) =>
  value == null ? "—" : value.toFixed(2);

const winColor = "text-emerald-400";
const lossColor = "text-red-400";
const neutColor = "text-slate-300";

export function BacktestResults({ backtest }: { backtest: UseBacktestResult }) {
  const {
    result,
    sweepResults,
    freqSweepResults,
    regimeHistory,
    isRunning,
    runError,
    topN,
    rebalanceFrequency,
    transactionCostBps,
    recentRuns,
    setResult,
  } = backtest;

  return (
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
  );
}
