import { MacroResponse } from "@/lib/api";

const REGIME_COLORS: Record<string, string> = {
  RISK_ON_GROWTH:     "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  RISK_ON_DEFENSIVE:  "bg-blue-900/50 text-blue-300 border-blue-700",
  RISK_OFF_DEFENSIVE: "bg-orange-900/50 text-orange-300 border-orange-700",
  RISK_OFF_FLIGHT:    "bg-red-900/50 text-red-300 border-red-700",
  STAGFLATION:        "bg-amber-900/50 text-amber-300 border-amber-700",
};

function fmt(v: number | null, decimals = 2, suffix = ""): string {
  return v == null ? "—" : `${Number(v).toFixed(decimals)}${suffix}`;
}

function MacroCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-100">{value}</div>
    </div>
  );
}

export default function MacroPanel({ macro }: { macro: MacroResponse }) {
  const { indicators, regime, asOfDate } = macro;
  const regimeClass = REGIME_COLORS[regime] ?? "bg-slate-700 text-slate-300 border-slate-600";

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-slate-200">Macro Environment</h2>
        <span className={`inline-block px-2.5 py-0.5 rounded border text-xs font-medium ${regimeClass}`}>
          {regime.replace(/_/g, " ")}
        </span>
        {asOfDate && (
          <span className="text-xs text-slate-500">as of {asOfDate}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MacroCard label="VIX" value={fmt(indicators.vix, 2)} />
        <MacroCard label="10Y Yield" value={fmt(indicators.tenYearYield, 2, "%")} />
        <MacroCard label="2Y Yield" value={fmt(indicators.twoYearYield, 2, "%")} />
        <MacroCard label="10Y–2Y Spread" value={fmt(indicators.yieldSpread10y2y, 2, "%")} />
        <MacroCard label="Breakeven Inflation" value={fmt(indicators.breakevenInflation, 2, "%")} />
        <MacroCard label="Fed Funds Rate" value={fmt(indicators.fedFundsRate, 2, "%")} />
        <MacroCard label="USD Index" value={fmt(indicators.usdIndex, 2)} />
      </div>
    </section>
  );
}
