import { fetchMacro } from "@/lib/api";
import type { MacroResponse } from "@/lib/api";

const REGIME_STYLES: Record<string, { label: string; color: string; ring: string; bg: string }> = {
  RISK_ON_GROWTH:     { label: "Risk On — Growth",     color: "text-emerald-300", ring: "border-emerald-600", bg: "bg-emerald-900/30" },
  RISK_ON_DEFENSIVE:  { label: "Risk On — Defensive",  color: "text-blue-300",    ring: "border-blue-600",    bg: "bg-blue-900/30"    },
  RISK_OFF_DEFENSIVE: { label: "Risk Off — Defensive", color: "text-orange-300",  ring: "border-orange-600",  bg: "bg-orange-900/30"  },
  RISK_OFF_FLIGHT:    { label: "Risk Off — Flight",    color: "text-red-300",     ring: "border-red-600",     bg: "bg-red-900/30"     },
  STAGFLATION:        { label: "Stagflation",           color: "text-amber-300",   ring: "border-amber-600",   bg: "bg-amber-900/30"   },
};

const REGIME_DESCRIPTIONS: Record<string, string> = {
  RISK_ON_GROWTH:     "Spread positive, VIX low, inflation contained. Equities and cyclicals favored.",
  RISK_ON_DEFENSIVE:  "Spread narrow or flat, VIX moderate. Rotate toward quality and dividend sectors.",
  RISK_OFF_DEFENSIVE: "Spread inverted, VIX elevated. Shift toward bonds, utilities, staples.",
  RISK_OFF_FLIGHT:    "Spread deeply inverted, VIX spiking, USD surging. Gold and Treasuries lead.",
  STAGFLATION:        "Inflation above 3%, breakeven rising, growth slowing. Commodities and energy.",
};

const INDICATOR_LABELS: Record<string, { label: string; format: (v: number | null) => string; tooltip: string }> = {
  vix:                { label: "VIX",               format: v => v == null ? "—" : v.toFixed(2),        tooltip: "CBOE Volatility Index — market fear gauge. <20 = calm, >30 = stress" },
  tenYearYield:       { label: "10Y Yield",          format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "US 10-year Treasury yield (FRED DGS10)" },
  twoYearYield:       { label: "2Y Yield",           format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "US 2-year Treasury yield (FRED DGS2)" },
  yieldSpread10y2y:   { label: "10Y–2Y Spread",     format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "10Y minus 2Y Treasury spread. Negative = inverted yield curve = recession signal" },
  breakevenInflation: { label: "Breakeven Inflation",format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "5Y breakeven inflation rate (FRED T5YIE) — market's inflation expectation" },
  fedFundsRate:       { label: "Fed Funds Rate",     format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "Effective Federal Funds Rate (FRED FEDFUNDS)" },
  usdIndex:           { label: "USD Index",          format: v => v == null ? "—" : v.toFixed(2),        tooltip: "US Dollar Index — DXY proxy. Rising = USD strengthening" },
};

function IndicatorCard({ indicatorKey, value }: { indicatorKey: string; value: number | null }) {
  const config = INDICATOR_LABELS[indicatorKey];
  if (!config) return null;
  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 space-y-1"
      title={config.tooltip}
    >
      <div className="text-xs text-slate-500">{config.label}</div>
      <div className="text-2xl font-semibold tabular-nums text-slate-100">{config.format(value)}</div>
    </div>
  );
}

function RegimeTimeline({ history }: { history: MacroResponse["regimeHistory"] }) {
  if (!history || history.length === 0) return null;

  const entries = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">Regime History</h2>
      <div className="space-y-1.5">
        {entries.map((entry, i) => {
          const style = REGIME_STYLES[entry.regime] ?? { label: entry.regime, color: "text-slate-400", ring: "border-slate-600", bg: "bg-slate-800/50" };
          const nextEntry = entries[i + 1];
          const start = new Date(entry.date);
          const end = nextEntry ? new Date(nextEntry.date) : null;
          const days = end ? Math.round((start.getTime() - end.getTime()) / 86_400_000) : null;
          return (
            <div
              key={entry.date}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${style.ring} ${style.bg}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24 tabular-nums">{entry.date}</span>
                <span className={`text-sm font-medium ${style.color}`}>{style.label}</span>
              </div>
              {days != null && (
                <span className="text-xs text-slate-500">{days}d</span>
              )}
            </div>
          );
        })}
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
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-800 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-slate-200">Macro Regime</h1>
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
                {Object.keys(INDICATOR_LABELS).map((key) => (
                  <IndicatorCard
                    key={key}
                    indicatorKey={key}
                    value={macro!.indicators[key as keyof typeof macro.indicators] ?? null}
                  />
                ))}
              </div>
            </section>

            <RegimeTimeline history={macro.regimeHistory} />
          </>
        )}
      </main>
    </div>
  );
}
