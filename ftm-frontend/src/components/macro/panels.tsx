import { CategorySummary, MacroResponse } from "@/lib/api";
import { REGIME_BAR_COLOR, REGIME_PLAYBOOK, REGIME_STYLES, SIGNAL_STYLES } from "@/components/macro/regimeConfig";

/** What the regime means: how long we have been in it, how to trade it, and who fits it. */

export function RegimeTimeline({ history }: { history: MacroResponse["regimeHistory"] }) {
  if (!history || history.length === 0) return null;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const segments = sorted.slice(-13);
  const first = segments[0]?.date ?? "";
  const last = segments[segments.length - 1]?.date ?? "";

  const currentRegime = segments[segments.length - 1]?.regime;
  const currentStyle = REGIME_STYLES[currentRegime ?? ""] ?? { label: currentRegime ?? "Unknown", color: "text-slate-400" };

  const currentRun = (() => {
    let count = 0;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].regime === currentRegime) count++;
      else break;
    }
    return count;
  })();

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">Regime History</h2>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Last {segments.length} {segments.length === 1 ? "week" : "weeks"}</span>
          <span className="text-xs text-slate-600">— each bar = one weekly observation</span>
          {segments.length < 4 && (
            <span className="text-[10px] text-slate-600 ml-1">· grows with each ingestion run</span>
          )}
        </div>

        <div className="flex items-end gap-1">
          {segments.map((entry, i) => {
            const barColor = REGIME_BAR_COLOR[entry.regime] ?? "bg-slate-600";
            const isLatest = i === segments.length - 1;
            const label = REGIME_STYLES[entry.regime]?.label ?? entry.regime;
            return (
              <div
                key={entry.date}
                className={`flex-1 h-6 rounded-sm opacity-80 ${barColor} ${isLatest ? "ring-2 ring-white opacity-90" : ""}`}
                title={`${entry.date} · ${label}`}
              />
            );
          })}
          <span className="ml-1 text-[10px] text-slate-500 whitespace-nowrap pb-0.5">← Now</span>
        </div>

        <div className="flex items-center text-[10px] text-slate-500">
          <span className="flex-1 text-left">{first}</span>
          <span className="flex-1 text-right">{last}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {(["RISK_ON_GROWTH", "RISK_ON_DEFENSIVE", "RISK_OFF_FLIGHT", "STAGFLATION"] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm inline-block ${REGIME_BAR_COLOR[key]}`} />
              {REGIME_STYLES[key]?.label ?? key}
            </span>
          ))}
          {currentRun > 0 && (
            <span className={`ml-auto text-[10px] ${currentStyle.color}`}>
              {currentRun}w in current {currentStyle.label} phase
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function RegimePlaybook({ regime }: { regime: string }) {
  const playbook = REGIME_PLAYBOOK[regime];
  if (!playbook) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">Regime Playbook</h2>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-400">{playbook.note}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-700">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Expected Leaders</span>
            </div>
            <ul className="space-y-1.5">
              {playbook.leaders.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="text-emerald-500 text-sm leading-none">↑</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Expected Laggards</span>
            </div>
            <ul className="space-y-1.5">
              {playbook.laggards.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="text-red-500 text-sm leading-none">↓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600">
          Historical sector rotation patterns during {REGIME_STYLES[regime]?.label ?? regime} regimes · Not financial advice
        </div>
      </div>
    </section>
  );
}

export function RegimeAlignmentTable({
  categories,
  regime,
}: {
  categories: CategorySummary[];
  regime: string;
}) {
  const regimeLabel = REGIME_STYLES[regime]?.label ?? regime;
  const withFit = categories
    .filter(c => c.macroFit != null && c.type !== "CASH")
    .sort((a, b) => (b.macroFit ?? 0) - (a.macroFit ?? 0));

  if (withFit.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">Regime Alignment</h2>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Historical RS win rate in{" "}
            <span className="text-slate-200 font-medium">{regimeLabel}</span>
            {" "}· sorted by fit (highest = historically strongest in this regime)
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2.5">Category</th>
              <th className="text-left px-4 py-2.5">ETF</th>
              <th className="text-center px-4 py-2.5">Score</th>
              <th className="text-center px-4 py-2.5">Signal</th>
              <th className="text-right px-4 py-2.5">Regime Fit</th>
              <th className="text-left px-4 py-2.5 w-36">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {withFit.map((cat) => {
              const fitPct = Math.round((cat.macroFit ?? 0) * 100);
              const scorePct = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
              const barColor = fitPct >= 60 ? "bg-violet-500" : fitPct >= 40 ? "bg-violet-400/60" : "bg-slate-600";
              const fitTextColor = fitPct >= 60 ? "text-violet-400" : fitPct >= 40 ? "text-violet-500" : "text-slate-600";
              const signal = cat.tradeSignal;
              const signalCls = signal ? (SIGNAL_STYLES[signal]?.className ?? "bg-slate-700/60 text-slate-400 border-slate-600/60") : null;
              const isAligned = fitPct >= 60 && (signal === "BUY" || signal === "WATCH");
              return (
                <tr
                  key={cat.id}
                  className={`hover:bg-slate-800/40 transition-colors ${isAligned ? "bg-violet-950/15" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <span className="text-slate-200 font-medium text-sm">{cat.name}</span>
                    {isAligned && (
                      <span className="ml-2 text-[9px] text-violet-400 font-semibold uppercase tracking-wider">aligned</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-blue-300 text-xs">{cat.etfTicker}</td>
                  <td className="px-4 py-2.5 text-center">
                    {scorePct != null ? (
                      <span className={`text-xs tabular-nums font-medium ${scorePct >= 65 ? "text-green-400" : scorePct >= 45 ? "text-slate-300" : "text-red-400"}`}
                        style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                        {scorePct}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {signalCls ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${signalCls}`}
                        style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.04em" }}>
                        {signal}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold text-sm ${fitTextColor}`}
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {fitPct}%
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${fitPct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600">
          &quot;aligned&quot; = regime fit ≥60% AND trade signal is BUY or WATCH · Regime fit computed from 5yr OHLCV history
        </div>
      </div>
    </section>
  );
}
