import { fetchMacro } from "@/lib/api";
import type { MacroResponse, MacroIndicators } from "@/lib/api";

const REGIME_STYLES: Record<string, { label: string; color: string; ring: string; bg: string }> = {
  RISK_ON_GROWTH:    { label: "Risk On — Growth",    color: "text-emerald-300", ring: "border-emerald-600", bg: "bg-emerald-900/30" },
  RISK_ON_DEFENSIVE: { label: "Risk On — Defensive", color: "text-blue-300",    ring: "border-blue-600",    bg: "bg-blue-900/30"    },
  RISK_OFF_FLIGHT:   { label: "Risk Off — Flight",   color: "text-red-300",     ring: "border-red-600",     bg: "bg-red-900/30"     },
  STAGFLATION:       { label: "Stagflation",          color: "text-amber-300",   ring: "border-amber-600",   bg: "bg-amber-900/30"   },
};

const REGIME_DESCRIPTIONS: Record<string, string> = {
  RISK_ON_GROWTH:    "Spread positive, VIX low, inflation contained. Equities and cyclicals favored.",
  RISK_ON_DEFENSIVE: "Spread narrow or flat, VIX moderate. Rotate toward quality and dividend sectors.",
  RISK_OFF_FLIGHT:   "Spread deeply inverted, VIX spiking, USD surging. Gold and Treasuries lead.",
  STAGFLATION:       "Inflation above 3%, breakeven rising, growth slowing. Commodities and energy.",
};

const REGIME_PLAYBOOK: Record<string, { leaders: string[]; laggards: string[]; note: string }> = {
  RISK_ON_GROWTH: {
    leaders:  ["Technology (XLK)", "Consumer Discretionary (XLY)", "Industrials (XLI)", "Financials (XLF)", "Momentum (MTUM)"],
    laggards: ["Utilities (XLU)", "Consumer Staples (XLP)", "Gold (GLD)", "Long Bonds (TLT)", "Low Volatility (USMV)"],
    note: "Classic bull market rotation. Cyclicals and growth lead; defensives and safe-havens lag.",
  },
  RISK_ON_DEFENSIVE: {
    leaders:  ["Healthcare (XLV)", "Financials (XLF)", "Quality (QUAL)", "Consumer Staples (XLP)", "Dividend payers"],
    laggards: ["Speculative growth tech", "High-beta small caps", "Momentum (MTUM)", "Crypto proxies"],
    note: "Late-cycle risk-on: prefer quality over momentum. Watch for spread narrowing as a regime shift signal.",
  },
  RISK_OFF_FLIGHT: {
    leaders:  ["Gold (GLD)", "Long Treasuries (TLT)", "USD (UUP)", "Low Volatility (USMV)", "Utilities (XLU)"],
    laggards: ["All equities (broad)", "High-yield bonds (HYG)", "Emerging markets (EEM)", "Energy (XLE)", "Financials (XLF)"],
    note: "Crisis mode: VIX > 30, yield curve deeply inverted. Gold and short-duration Treasuries are the only safe harbors.",
  },
  STAGFLATION: {
    leaders:  ["Energy (XLE)", "Materials (XLB)", "Gold (GLD)", "Commodities (DJP)", "Value (VLUE)"],
    laggards: ["Growth tech (XLK)", "Consumer Discretionary (XLY)", "Long Bonds (TLT)", "REITs (XLRE)", "Momentum (MTUM)"],
    note: "Inflation > 3% with slowing growth. Real assets and commodity producers outperform; duration and growth suffer.",
  },
};

type IndicatorConfig = {
  label: string;
  series: string;
  format: (v: number | null) => string;
  tooltip: string;
  lowerIsBetter?: boolean;
};

const INDICATOR_LABELS: Record<keyof MacroIndicators, IndicatorConfig> = {
  vix:                { label: "VIX",                series: "VIXCLS",     format: v => v == null ? "—" : v.toFixed(2),        tooltip: "CBOE Volatility Index — market fear gauge. <20 = calm, >30 = stress", lowerIsBetter: true },
  tenYearYield:       { label: "10Y Yield",           series: "DGS10",      format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "US 10-year Treasury yield (FRED DGS10)" },
  twoYearYield:       { label: "2Y Yield",            series: "DGS2",       format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "US 2-year Treasury yield (FRED DGS2)" },
  yieldSpread10y2y:   { label: "10Y–2Y Spread",      series: "T10Y2Y",     format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "10Y minus 2Y Treasury spread. Negative = inverted yield curve = recession signal" },
  breakevenInflation: { label: "Breakeven Inflation", series: "T10YIE",     format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "10Y breakeven inflation rate (FRED T10YIE) — market's inflation expectation" },
  fedFundsRate:       { label: "Fed Funds Rate",      series: "FEDFUNDS",   format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "Effective Federal Funds Rate (FRED FEDFUNDS)" },
  usdIndex:           { label: "USD Index",           series: "DTWEXBGS",   format: v => v == null ? "—" : v.toFixed(2),        tooltip: "US Dollar Index — DXY proxy. Rising = USD strengthening" },
  wtiCrudeOilPrice:   { label: "WTI Crude Oil",       series: "DCOILWTICO", format: v => v == null ? "—" : `$${v.toFixed(2)}`, tooltip: "WTI crude oil price USD/barrel (FRED DCOILWTICO). Key cross-asset inflation signal" },
};

function IndicatorCard({
  indicatorKey,
  value,
  previousValue,
}: {
  indicatorKey: keyof MacroIndicators;
  value: number | null;
  previousValue: number | null;
}) {
  const config = INDICATOR_LABELS[indicatorKey];
  if (!config) return null;

  let trendEl: React.ReactNode = null;
  if (value != null && previousValue != null) {
    const delta = value - previousValue;
    const absDelta = Math.abs(delta);
    const threshold = Math.abs(previousValue) * 0.001;
    if (absDelta <= threshold) {
      trendEl = <span className="flex items-center gap-1 text-slate-500">→ Unchanged</span>;
    } else {
      const up = delta > 0;
      const arrow = up ? "↑" : "↓";
      const wasStr = config.format(previousValue);
      trendEl = (
        <span className="flex items-center gap-1 text-slate-400">
          <span>{arrow}</span>
          <span>was {wasStr}</span>
        </span>
      );
    }
  }

  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-1"
      title={config.tooltip}
    >
      <div className="text-xs text-slate-500">{config.label}</div>
      <div className="text-2xl font-semibold tabular-nums text-slate-100">{config.format(value)}</div>
      {trendEl && <div className="text-xs">{trendEl}</div>}
      <div className="text-[10px] text-slate-600">Series: {config.series} · Source: FRED</div>
    </div>
  );
}

const REGIME_BAR_COLOR: Record<string, string> = {
  RISK_ON_GROWTH:    "bg-green-600",
  RISK_ON_DEFENSIVE: "bg-blue-600",
  RISK_OFF_FLIGHT:   "bg-red-600",
  STAGFLATION:       "bg-amber-500",
};

function RegimeTimeline({ history }: { history: MacroResponse["regimeHistory"] }) {
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

function RegimePlaybook({ regime }: { regime: string }) {
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

function MacroFitTable({
  macroFitByCategory,
  regime,
}: {
  macroFitByCategory: Record<string, number>;
  regime: string;
}) {
  const regimeLabel = REGIME_STYLES[regime]?.label ?? regime;
  const sorted = Object.entries(macroFitByCategory).sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">MACRO_FIT Win Rate</h2>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-700 flex items-center gap-2">
          <span className="text-xs text-slate-400">
            % of historical days in <span className="text-slate-200 font-medium">{regimeLabel}</span> where RS_60 &gt; 0
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-right px-4 py-2">Win Rate</th>
              <th className="text-left px-4 py-2 w-48">Historical Fit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sorted.map(([categoryId, winRate]) => {
              const pct = Math.round(winRate * 100);
              const barColor =
                pct >= 60 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
              const textColor =
                pct >= 60 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400";
              return (
                <tr key={categoryId} className="hover:bg-slate-700/30">
                  <td className="px-4 py-2 font-mono text-slate-200">{categoryId}</td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold tabular-nums ${textColor}`}>
                    {pct}%
                  </td>
                  <td className="px-4 py-2">
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function MacroRegimePage() {
  let macro: MacroResponse | null = null;
  let error: string | null = null;

  try {
    macro = await fetchMacro();
  } catch (e) {
    error = String(e);
  }

  const regime = macro?.regime ?? "UNKNOWN";
  const style = REGIME_STYLES[regime] ?? { label: regime, color: "text-slate-400", ring: "border-slate-600", bg: "bg-slate-800/50" };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Macro Regime
          </h1>
          {macro && (
            <span className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-semibold ${style.ring} ${style.color} ${style.bg}`}>
              {style.label}
            </span>
          )}
        </div>
        {macro?.asOfDate && (
          <span className="text-xs text-slate-500">Data as of {macro.asOfDate}</span>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load macro data: {error}
          </div>
        )}

        {macro && (
          <>
            <section className="space-y-3">
              <div className={`flex items-start gap-4 px-4 py-4 rounded-xl border ${style.ring} ${style.bg}`}>
                <div className="flex-1">
                  <div className={`text-lg font-semibold ${style.color}`}>{style.label}</div>
                  <p className="text-sm text-slate-400 mt-1">
                    {REGIME_DESCRIPTIONS[regime] ?? "No description available for this regime."}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-300">Indicators</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(Object.keys(INDICATOR_LABELS) as (keyof MacroIndicators)[]).map((key) => (
                  <IndicatorCard
                    key={key}
                    indicatorKey={key}
                    value={macro!.indicators[key] ?? null}
                    previousValue={macro!.previousIndicators?.[key] ?? null}
                  />
                ))}
              </div>
            </section>

            <RegimeTimeline history={macro.regimeHistory} />

            <RegimePlaybook regime={regime} />

            {macro.macroFitByCategory && Object.keys(macro.macroFitByCategory).length > 0 && (
              <MacroFitTable
                macroFitByCategory={macro.macroFitByCategory as Record<string, number>}
                regime={regime}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
