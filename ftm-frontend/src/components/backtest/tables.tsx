"use client";

import { BacktestResult, EquityCurvePoint, RebalanceEvent } from "@/lib/api";
import { CATEGORY_ETF_MAP } from "@/lib/sectors";
import { computeDrawdownPeriods, computeRiskAttribution, computeMonthlyReturns, computeRegimeBreakdown } from "@/lib/backtest/metrics";


export const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const REGIME_COLORS: Record<string, { label: string; dot: string; textClass: string }> = {
  RISK_ON_GROWTH:    { label: "Risk-On Growth",    dot: "bg-emerald-500", textClass: "text-emerald-400" },
  RISK_ON_DEFENSIVE: { label: "Risk-On Defensive", dot: "bg-blue-500",    textClass: "text-blue-400"   },
  RISK_OFF_FLIGHT:   { label: "Risk-Off / Flight", dot: "bg-red-500",     textClass: "text-red-400"    },
  STAGFLATION:       { label: "Stagflation",        dot: "bg-amber-500",   textClass: "text-amber-400"  },
};

export const FREQ_LABELS: Record<string, { label: string; shortLabel: string; colorClass: string }> = {
  WEEKLY:    { label: "Weekly",    shortLabel: "W", colorClass: "text-purple-400" },
  MONTHLY:   { label: "Monthly",   shortLabel: "M", colorClass: "text-blue-400"   },
  QUARTERLY: { label: "Quarterly", shortLabel: "Q", colorClass: "text-cyan-400"   },
};

export const cellBg = (excess: number): string => {
  if (excess >= 0.03)  return "bg-emerald-800/80 text-emerald-200";
  if (excess >= 0.01)  return "bg-emerald-900/60 text-emerald-300";
  if (excess >= 0.003) return "bg-emerald-900/30 text-emerald-400";
  if (excess >= -0.003) return "bg-slate-700/40 text-slate-400";
  if (excess >= -0.01) return "bg-red-900/30 text-red-400";
  if (excess >= -0.03) return "bg-red-900/60 text-red-300";
  return "bg-red-800/80 text-red-200";
}

export const DrawdownAnalysisTable = ({ curve }: { curve: EquityCurvePoint[] }) => {
  const stratPeriods = computeDrawdownPeriods(curve, false);
  if (stratPeriods.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-200 mb-3">Worst Drawdowns</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-4 font-medium">#</th>
              <th className="pb-2 pr-4 font-medium">Peak → Trough</th>
              <th className="pb-2 pr-4 font-medium text-right">Depth</th>
              <th className="pb-2 pr-4 font-medium text-right">Duration</th>
              <th className="pb-2 pr-4 font-medium text-right">Recovery</th>
              <th className="pb-2 font-medium text-right">Recovered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {stratPeriods.map((dd, i) => (
              <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                <td className="py-1.5 pr-4 text-slate-600 tabular-nums font-mono">{i + 1}</td>
                <td className="py-1.5 pr-4 text-slate-400 font-mono tabular-nums">
                  {dd.startDate} → {dd.troughDate}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                  <span className={`font-semibold ${dd.depthPct >= 20 ? "text-red-400" : dd.depthPct >= 10 ? "text-amber-400" : "text-slate-300"}`}>
                    -{dd.depthPct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-slate-400">
                  {dd.durationDays}d
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                  {dd.recoveryDays != null
                    ? <span className={dd.recoveryDays < 60 ? "text-emerald-400" : dd.recoveryDays < 252 ? "text-amber-400" : "text-red-400"}>{dd.recoveryDays}d</span>
                    : <span className="text-red-400">ongoing</span>
                  }
                </td>
                <td className="py-1.5 text-right">
                  {dd.endDate != null
                    ? <span className="text-emerald-400">✓ {dd.endDate}</span>
                    : <span className="text-red-400">✗ not yet</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Top 5 drawdowns ≥2% · Duration = peak to trough · Recovery = trough to new high · Ongoing = not yet recovered at end of period
      </div>
    </div>
  );
}

export const RiskAttributionPanel = ({ curve }: { curve: EquityCurvePoint[] }) => {
  const ra = computeRiskAttribution(curve);
  if (!ra) return null;

  type Cell = { label: string; value: string; sub?: string; color?: string; tooltip: string };
  const cells: Cell[] = [
    {
      label: "Beta",
      value: ra.beta != null ? ra.beta.toFixed(2) : "—",
      color: ra.beta != null ? (ra.beta < 0.8 ? "text-emerald-400" : ra.beta < 1.1 ? "text-slate-300" : "text-amber-400") : undefined,
      tooltip: "Sensitivity to SPY daily moves. β<1 = less market exposure than index; β>1 = amplified market risk.",
    },
    {
      label: "Correlation",
      value: ra.correlation != null ? ra.correlation.toFixed(3) : "—",
      color: ra.correlation != null ? (ra.correlation < 0.7 ? "text-emerald-400" : ra.correlation < 0.85 ? "text-slate-300" : "text-amber-400") : undefined,
      tooltip: "Pearson r of daily returns vs SPY. Lower = more independent return stream; ideal rotation strategy < 0.75.",
    },
    {
      label: "CAPM α (ann.)",
      value: ra.capmAlphaDailyAnn != null ? `${ra.capmAlphaDailyAnn >= 0 ? "+" : ""}${ra.capmAlphaDailyAnn.toFixed(2)}%` : "—",
      color: ra.capmAlphaDailyAnn != null ? (ra.capmAlphaDailyAnn > 0 ? "text-emerald-400" : "text-red-400") : undefined,
      tooltip: "Annualized Jensen's alpha — return unexplained by market beta. Positive = genuine skill after adjusting for market exposure.",
    },
    {
      label: "Tracking Error",
      value: ra.trackingError != null ? `${ra.trackingError.toFixed(2)}%` : "—",
      color: "text-slate-300",
      sub: "annualized",
      tooltip: "Annualized std dev of (strategy − SPY) daily returns. Measures how much the strategy deviates from the index.",
    },
    {
      label: "Info Ratio",
      value: ra.informationRatio != null ? ra.informationRatio.toFixed(2) : "—",
      color: ra.informationRatio != null ? (ra.informationRatio > 0.5 ? "text-emerald-400" : ra.informationRatio > 0 ? "text-slate-300" : "text-red-400") : undefined,
      tooltip: "Annualized alpha / tracking error. Measures consistency of excess return. >0.5 = good active management.",
    },
    {
      label: "Up Capture",
      value: ra.upCapture != null ? `${ra.upCapture.toFixed(1)}%` : "—",
      color: ra.upCapture != null ? (ra.upCapture > 100 ? "text-emerald-400" : ra.upCapture > 80 ? "text-blue-300" : "text-amber-400") : undefined,
      sub: "of SPY up moves",
      tooltip: "On days when SPY rises, what % of SPY's gain does the strategy capture? >100% = amplified upside.",
    },
    {
      label: "Down Capture",
      value: ra.downCapture != null ? `${ra.downCapture.toFixed(1)}%` : "—",
      color: ra.downCapture != null ? (ra.downCapture < 70 ? "text-emerald-400" : ra.downCapture < 90 ? "text-blue-300" : "text-amber-400") : undefined,
      sub: "of SPY down moves",
      tooltip: "On days when SPY falls, what % of SPY's loss does the strategy incur? <70% = strong downside protection.",
    },
  ];

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-200 mb-3">Risk Attribution vs SPY</div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {cells.map(cell => (
          <div key={cell.label} className="space-y-0.5" title={cell.tooltip}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{cell.label}</div>
            <div className={`text-lg font-bold font-mono tabular-nums ${cell.color ?? "text-slate-300"}`}>{cell.value}</div>
            {cell.sub && <div className="text-[9px] text-slate-600">{cell.sub}</div>}
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-slate-700/40 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[10px] text-slate-500">
        <span><span className="text-slate-400">Ideal rotation signal:</span> β≈0.7–0.9 · r&lt;0.8 · α&gt;2% · Up≥85% · Down≤75%</span>
        <span><span className="text-slate-400">Computed from:</span> {curve.length - 1} daily return pairs · no annualization of individual metrics except where noted</span>
      </div>
    </div>
  );
}

export const MonthlyReturnsTable = ({ curve }: { curve: EquityCurvePoint[] }) => {
  const rows = computeMonthlyReturns(curve);
  if (rows.length === 0) return null;

  const years = Array.from(new Set(rows.map(r => r.year))).sort();
  const byYM = new Map(rows.map(r => [r.ym, r]));

  // Annual returns: first value of year / last value of prev year
  const monthEnd = new Map<string, { portfolio: number; spy: number }>();
  for (const pt of curve) monthEnd.set(pt.date.slice(0, 7), { portfolio: pt.portfolioValue, spy: pt.spyValue });

  const annualReturns = years.map(yr => {
    const yrMonths = Array.from(monthEnd.keys()).filter(ym => ym.startsWith(String(yr))).sort();
    const prevYrMonths = Array.from(monthEnd.keys()).filter(ym => ym.startsWith(String(yr - 1))).sort();
    const start = prevYrMonths.length > 0 ? monthEnd.get(prevYrMonths[prevYrMonths.length - 1])! : monthEnd.get(yrMonths[0])!;
    const end = monthEnd.get(yrMonths[yrMonths.length - 1])!;
    return {
      yr,
      port: end.portfolio / start.portfolio - 1,
      spy: end.spy / start.spy - 1,
    };
  });

  const months = [1,2,3,4,5,6,7,8,9,10,11,12];
  const beatCount = rows.filter(r => r.port > r.spy).length;
  const winRate = Math.round((beatCount / rows.length) * 100);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Monthly Returns vs SPY</div>
        <div className="text-[10px] text-slate-500 flex items-center gap-3">
          <span>Beat SPY in <span className="text-emerald-400 font-semibold">{beatCount}/{rows.length}</span> months ({winRate}%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-800/80 inline-block"/>outperform</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-800/80 inline-block"/>underperform</span>
          <button
            onClick={() => {
              const header = "year_month,strategy_pct,spy_pct,excess_pct";
              const csvRows = rows.map(r =>
                `${r.ym},${(r.port*100).toFixed(4)},${(r.spy*100).toFixed(4)},${((r.port-r.spy)*100).toFixed(4)}`
              );
              const csv = [header, ...csvRows].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "monthly_returns.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60 hover:bg-slate-600/60 text-slate-400 hover:text-slate-200 transition-colors"
            title="Download monthly returns as CSV"
          >
            ↓ CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 pr-3 pb-1.5 font-medium w-12">Year</th>
              {months.map(m => (
                <th key={m} className="text-center text-slate-500 pb-1.5 font-medium px-1 w-[calc(100%/14)]">
                  {MONTH_ABBR[m-1]}
                </th>
              ))}
              <th className="text-right text-slate-500 pb-1.5 font-medium pl-2 pr-1 w-16">Full Yr</th>
            </tr>
          </thead>
          <tbody>
            {years.map((yr, yi) => {
              const ann = annualReturns[yi];
              const annExcess = ann.port - ann.spy;
              return (
                <tr key={yr}>
                  <td className="text-slate-400 pr-3 py-0.5 font-mono font-medium">{yr}</td>
                  {months.map(mo => {
                    const ym = `${yr}-${String(mo).padStart(2, "0")}`;
                    const cell = byYM.get(ym);
                    if (!cell) return <td key={mo} className="px-0.5 py-0.5"><div className="text-center text-slate-700 text-[9px] rounded py-1">—</div></td>;
                    const excess = cell.port - cell.spy;
                    const bg = cellBg(excess);
                    const portPct = (cell.port * 100).toFixed(1);
                    const spyPct = (cell.spy * 100).toFixed(1);
                    const excessPct = (excess * 100).toFixed(1);
                    return (
                      <td key={mo} className="px-0.5 py-0.5" title={`${MONTH_ABBR[mo-1]} ${yr}\nStrategy: ${cell.port >= 0 ? "+" : ""}${portPct}%\nSPY: ${cell.spy >= 0 ? "+" : ""}${spyPct}%\nExcess: ${excess >= 0 ? "+" : ""}${excessPct}%`}>
                        <div className={`text-center rounded py-1 text-[9px] tabular-nums font-mono ${bg}`}>
                          {cell.port >= 0 ? "+" : ""}{portPct}%
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-0.5 py-0.5 pl-2">
                    <div className={`text-right rounded py-1 text-[10px] tabular-nums font-mono font-semibold ${cellBg(annExcess)}`}>
                      {ann.port >= 0 ? "+" : ""}{(ann.port * 100).toFixed(1)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Color intensity = excess return vs SPY that month. Hover cells for details. Annual column = full-year compounded return.
      </div>
    </div>
  );
}

export const HoldingHeatmap = ({ events, curve }: { events: RebalanceEvent[]; curve: EquityCurvePoint[] }) => {
  if (!events || events.length < 2) return null;

  // All unique categories that ever appeared, sorted by frequency (most held first)
  const freq: Record<string, number> = {};
  for (const ev of events) for (const id of ev.categoryIds) freq[id] = (freq[id] ?? 0) + 1;
  const categories = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
  if (categories.length === 0) return null;

  // Build portfolio value lookup from equity curve
  const valueByDate: Record<string, number> = {};
  for (const pt of curve) valueByDate[pt.date] = pt.portfolioValue;

  // Compute period return for each rebalance period
  const periods = events.map((ev, i) => {
    const nextDate = events[i + 1]?.date;
    const startVal = valueByDate[ev.date] ?? ev.portfolioValue;
    const endVal   = nextDate ? (valueByDate[nextDate] ?? events[i + 1].portfolioValue) : startVal;
    const returnPct = startVal > 0 ? (endVal - startVal) / startVal * 100 : 0;
    return { date: ev.date, heldIds: new Set(ev.categoryIds), returnPct };
  });

  // Show at most 30 most-recent periods to keep it readable
  const visiblePeriods = periods.slice(-30);

  const cellBgHeld = (returnPct: number) => {
    if (returnPct >= 3)  return "bg-emerald-700/80";
    if (returnPct >= 1)  return "bg-emerald-800/60";
    if (returnPct >= 0)  return "bg-emerald-900/50";
    if (returnPct >= -1) return "bg-red-900/50";
    if (returnPct >= -3) return "bg-red-800/60";
    return "bg-red-700/70";
  };

  const holdCount = (id: string) => periods.filter(p => p.heldIds.has(id)).length;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Rotation Heatmap</div>
        <div className="text-[10px] text-slate-500">
          {categories.length} sectors · {periods.length} periods · color = period return when held
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[9px] border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left text-slate-500 pr-2 pb-1 font-medium whitespace-nowrap w-14">Sector</th>
              {visiblePeriods.map(p => (
                <th key={p.date} className="pb-1 font-normal text-slate-600 px-px" style={{ minWidth: "18px" }}>
                  <div className="writing-mode-vertical" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", fontSize: "8px" }}>
                    {p.date.slice(5, 10)}
                  </div>
                </th>
              ))}
              <th className="pl-2 pb-1 text-right text-slate-500 font-medium whitespace-nowrap">Hold%</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(id => (
              <tr key={id}>
                <td className="pr-2 py-px">
                  <span className="font-mono text-slate-400">{CATEGORY_ETF_MAP[id] ?? id}</span>
                  <span className="text-slate-700 ml-1">({id.slice(0, 6)})</span>
                </td>
                {visiblePeriods.map(p => {
                  const held = p.heldIds.has(id);
                  return (
                    <td key={p.date} className="px-px py-px" title={`${p.date}: ${id} — ${held ? `held, period return: ${p.returnPct >= 0 ? "+" : ""}${p.returnPct.toFixed(1)}%` : "not held"}`}>
                      <div className={`w-4 h-4 rounded-sm ${held ? cellBgHeld(p.returnPct) : "bg-slate-800/30"}`} />
                    </td>
                  );
                })}
                <td className="pl-2 text-right font-mono text-slate-500">
                  {Math.round(holdCount(id) / periods.length * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[9px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-700/80 inline-block"/>+3%+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-900/50 inline-block"/>0–1%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-900/50 inline-block"/>0–(−1)%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-700/70 inline-block"/>−3%+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-800/30 inline-block"/>not held</span>
        <span className="ml-auto">Hold% = fraction of all periods this sector was in the portfolio</span>
      </div>
    </div>
  );
}

export const RebalanceTimeline = ({ events }: { events: RebalanceEvent[] }) => {
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
            <th className="pb-2 pr-4 font-medium">Value</th>
            <th className="pb-2 pr-4 font-medium">Return</th>
            <th className="pb-2 font-medium">Hold — ETF (sector) · Equal weight</th>
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
                    {ev.categoryIds.map(id => {
                      const ticker = CATEGORY_ETF_MAP[id] ?? id;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-blue-900/40 text-blue-300 border border-blue-800/40 rounded" title={`Category: ${id}`}>
                          <span className="text-cyan-300 font-bold">{ticker}</span>
                          <span className="text-blue-500">({id})</span>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-600">
        Hypothetical equal-weighted positions. Rotation strategy exits all positions and buys the top-N sectors by composite score on each rebalance date. Transaction costs are charged on turnover at each rebalance (configurable in Strategy Parameters); slippage and taxes are not modeled.
      </p>
    </div>
  );
}

export const SweepTable = ({ rows, currentTopN }: { rows: BacktestResult[]; currentTopN: number }) => {
  if (rows.length === 0) return null;
  const spy = rows[0]; // spy metrics are constant across rows
  const best = rows.reduce((best, r) => (r.sortinoRatio ?? 0) > (best.sortinoRatio ?? 0) ? r : best, rows[0]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Parameter Sensitivity — Top-N Sweep</div>
        <div className="text-[10px] text-slate-500">
          Best Sortino: <span className="text-emerald-400 font-semibold">Top-{best.topN} ({best.sortinoRatio?.toFixed(2)})</span>
          {" · "} SPY baseline: {spy.spyTotalReturnPct?.toFixed(1)}% total, Sharpe {spy.spySharpeRatio?.toFixed(2)}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-3 font-medium">N</th>
              <th className="pb-2 pr-3 font-medium text-right">Total Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">Ann. Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">vs SPY</th>
              <th className="pb-2 pr-3 font-medium text-right">Max DD</th>
              <th className="pb-2 pr-3 font-medium text-right">Sharpe</th>
              <th className="pb-2 pr-3 font-medium text-right">Sortino</th>
              <th className="pb-2 font-medium text-right">Calmar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const excess = (r.totalReturnPct ?? 0) - (r.spyTotalReturnPct ?? 0);
              const isCurrent = r.topN === currentTopN;
              const isBest = r.topN === best.topN;
              return (
                <tr key={r.topN} className={`${isCurrent ? "bg-blue-900/20" : ""} ${isBest ? "ring-1 ring-emerald-700/40" : ""} hover:bg-slate-800/40 transition-colors`}>
                  <td className={`py-1.5 pr-3 font-mono font-bold ${isBest ? "text-emerald-400" : isCurrent ? "text-blue-300" : "text-slate-400"}`}>
                    {r.topN}{isCurrent ? " ←" : ""}{isBest && !isCurrent ? " ★" : ""}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.totalReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.totalReturnPct != null ? `${r.totalReturnPct >= 0 ? "+" : ""}${r.totalReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.annualizedReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.annualizedReturnPct != null ? `${r.annualizedReturnPct >= 0 ? "+" : ""}${r.annualizedReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${excess >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {excess >= 0 ? "+" : ""}{excess.toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-3 font-mono tabular-nums text-red-400 text-right">
                    -{r.maxDrawdownPct?.toFixed(1)}%
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sharpeRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-1.5 pr-3 font-mono tabular-nums text-right ${(r.sortinoRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sortinoRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-1.5 font-mono tabular-nums text-right ${(r.calmarRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.calmarRatio?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        ★ = best Sortino · ← = current selection · all runs use same date range, frequency, and universe
      </div>
    </div>
  );
}

export const RegimeBreakdownTable = ({ curve, history }: { curve: EquityCurvePoint[]; history: { date: string; regime: string }[] }) => {
  const rows = computeRegimeBreakdown(curve, history);
  if (rows.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Performance by Macro Regime</div>
        <div className="text-[10px] text-slate-500">
          Compounded strategy return vs SPY in each regime · coverage from weekly macro signal
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-3 font-medium">Regime</th>
              <th className="pb-2 pr-3 font-medium text-right">Days</th>
              <th className="pb-2 pr-3 font-medium text-right">Strategy</th>
              <th className="pb-2 pr-3 font-medium text-right">SPY</th>
              <th className="pb-2 pr-3 font-medium text-right">Alpha</th>
              <th className="pb-2 font-medium text-right">Daily Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const alpha = r.portReturn - r.spyReturn;
              const rc = REGIME_COLORS[r.regime] ?? { label: r.regime, dot: "bg-slate-500", textClass: "text-slate-400" };
              const dailyAvg = r.days > 1 ? r.portReturn / r.days : 0;
              return (
                <tr key={r.regime} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rc.dot} inline-block shrink-0`} />
                      <span className={`font-medium ${rc.textClass}`}>{rc.label}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-right text-slate-400">{r.days}</td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${r.portReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.portReturn >= 0 ? "+" : ""}{r.portReturn.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${r.spyReturn >= 0 ? "text-slate-300" : "text-red-400"}`}>
                    {r.spyReturn >= 0 ? "+" : ""}{r.spyReturn.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right font-semibold ${alpha >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {alpha >= 0 ? "+" : ""}{alpha.toFixed(1)}%
                  </td>
                  <td className={`py-2 font-mono tabular-nums text-right text-[10px] ${dailyAvg >= 0 ? "text-slate-400" : "text-red-400/70"}`}>
                    {dailyAvg >= 0 ? "+" : ""}{dailyAvg.toFixed(3)}%/d
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Regime classification is weekly (FRED data lag). Days = trading days in this backtest where the regime applied. Alpha = strategy minus SPY for that regime period only.
      </div>
    </div>
  );
}

export const FrequencySweepTable = ({ rows, currentFrequency }: { rows: BacktestResult[]; currentFrequency: string }) => {
  if (rows.length === 0) return null;
  const spy = rows[0];
  const best = rows.reduce((b, r) => (r.sortinoRatio ?? 0) > (b.sortinoRatio ?? 0) ? r : b, rows[0]);
  const worstDD = rows.reduce((b, r) => (r.maxDrawdownPct ?? 0) > (b.maxDrawdownPct ?? 0) ? r : b, rows[0]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-200">Frequency Sensitivity — Weekly vs Monthly vs Quarterly</div>
        <div className="text-[10px] text-slate-500">
          Best Sortino: <span className="text-emerald-400 font-semibold">{FREQ_LABELS[best.rebalanceFrequency]?.label} ({best.sortinoRatio?.toFixed(2)})</span>
          {" · "} SPY baseline: {spy.spyTotalReturnPct?.toFixed(1)}% total
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-left">
              <th className="pb-2 pr-3 font-medium">Frequency</th>
              <th className="pb-2 pr-3 font-medium text-right">Rebalances</th>
              <th className="pb-2 pr-3 font-medium text-right">Total Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">Ann. Ret</th>
              <th className="pb-2 pr-3 font-medium text-right">vs SPY</th>
              <th className="pb-2 pr-3 font-medium text-right">Max DD</th>
              <th className="pb-2 pr-3 font-medium text-right">Sharpe</th>
              <th className="pb-2 pr-3 font-medium text-right">Sortino</th>
              <th className="pb-2 font-medium text-right">Calmar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(r => {
              const excess = (r.totalReturnPct ?? 0) - (r.spyTotalReturnPct ?? 0);
              const isCurrent = r.rebalanceFrequency === currentFrequency;
              const isBest = r.rebalanceFrequency === best.rebalanceFrequency;
              const isWorstDD = r.rebalanceFrequency === worstDD.rebalanceFrequency;
              const fc = FREQ_LABELS[r.rebalanceFrequency] ?? { label: r.rebalanceFrequency, shortLabel: r.rebalanceFrequency, colorClass: "text-slate-400" };
              return (
                <tr key={r.rebalanceFrequency} className={`${isCurrent ? "bg-blue-900/20" : ""} ${isBest ? "ring-1 ring-emerald-700/40" : ""} hover:bg-slate-800/40 transition-colors`}>
                  <td className={`py-2 pr-3 font-semibold ${fc.colorClass}`}>
                    {fc.label}{isCurrent ? " ←" : ""}{isBest && !isCurrent ? " ★" : ""}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-right text-slate-400">
                    {r.rebalanceFrequency === "WEEKLY" ? "~52/yr" : r.rebalanceFrequency === "MONTHLY" ? "~12/yr" : "~4/yr"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.totalReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.totalReturnPct != null ? `${r.totalReturnPct >= 0 ? "+" : ""}${r.totalReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.annualizedReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {r.annualizedReturnPct != null ? `${r.annualizedReturnPct >= 0 ? "+" : ""}${r.annualizedReturnPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${excess >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {excess >= 0 ? "+" : ""}{excess.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${isWorstDD ? "text-red-400 font-semibold" : "text-red-400/70"}`}>
                    -{r.maxDrawdownPct?.toFixed(1)}%
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.sharpeRatio ?? 0) >= 1 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sharpeRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-2 pr-3 font-mono tabular-nums text-right ${(r.sortinoRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.sortinoRatio?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`py-2 font-mono tabular-nums text-right ${(r.calmarRatio ?? 0) >= 1.5 ? "text-emerald-400" : "text-slate-400"}`}>
                    {r.calmarRatio?.toFixed(2) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        ★ = best Sortino · ← = current selection · all runs use same date range, topN, and universe · Weekly = higher turnover, higher transaction cost risk
      </div>
    </div>
  );
}

