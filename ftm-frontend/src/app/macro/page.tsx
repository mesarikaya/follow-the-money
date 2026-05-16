import ComingSoonPage from "@/components/ComingSoonPage";

const MOCK_REGIME_HISTORY = [
  { date: "2026-05-16", regime: "RISK_ON_GROWTH",   days: 14 },
  { date: "2026-05-02", regime: "RISK_ON_DEFENSIVE", days: 21 },
  { date: "2026-04-11", regime: "RISK_OFF_FLIGHT",   days: 9  },
  { date: "2026-04-02", regime: "RISK_ON_GROWTH",    days: 45 },
  { date: "2026-02-16", regime: "STAGFLATION",       days: 18 },
];

const REGIME_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  RISK_ON_GROWTH:    { label: "Risk On — Growth",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  RISK_ON_DEFENSIVE: { label: "Risk On — Defensive", color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30"    },
  RISK_OFF_FLIGHT:   { label: "Risk Off — Flight",   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30"     },
  STAGFLATION:       { label: "Stagflation",          color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
};

export default function MacroRegimePage() {
  return (
    <ComingSoonPage
      title="Macro Regime"
      milestone="M3"
      description="Full regime history, indicator trend charts, and MACRO_FIT win-rates per category."
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Regime History (last 90 days)</h3>
          <div className="space-y-2">
            {MOCK_REGIME_HISTORY.map((entry) => {
              const style = REGIME_STYLES[entry.regime] ?? { label: entry.regime, color: "text-zinc-400", bg: "bg-zinc-700/30 border-zinc-600/30" };
              return (
                <div key={entry.date} className={`flex items-center justify-between px-3 py-2 rounded-md border ${style.bg}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-24">{entry.date}</span>
                    <span className={`text-sm font-medium ${style.color}`}>{style.label}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{entry.days}d</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">MACRO_FIT Win-Rates — Current Regime</h3>
          <p className="text-xs text-zinc-600 mb-3">
            Fraction of historical RISK_ON_GROWTH days where RS_60 was positive per category.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "Technology",        winRate: 0.78 },
              { name: "Financial",         winRate: 0.72 },
              { name: "Energy",            winRate: 0.65 },
              { name: "Healthcare",        winRate: 0.61 },
              { name: "Consumer Disc.",    winRate: 0.58 },
              { name: "Industrials",       winRate: 0.54 },
              { name: "Bonds (Long-Term)", winRate: 0.31 },
              { name: "Gold",              winRate: 0.28 },
            ].map((row) => (
              <div key={row.name} className="flex items-center gap-2 bg-zinc-800/40 border border-zinc-700/50 rounded px-3 py-2">
                <span className="text-xs text-zinc-400 flex-1">{row.name}</span>
                <span className={`text-xs font-mono font-medium ${row.winRate >= 0.6 ? "text-emerald-400" : row.winRate >= 0.4 ? "text-zinc-300" : "text-red-400"}`}>
                  {Math.round(row.winRate * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ComingSoonPage>
  );
}
