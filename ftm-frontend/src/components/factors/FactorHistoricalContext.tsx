import { SubSectorSummary } from "@/lib/api";

/** Where each factor's score sits inside its own trailing-year range. */

export function FactorHistoricalContext({ factors }: { factors: SubSectorSummary[] }) {
  const withPct = factors.filter(f => f.scorePercentile252d != null && f.compositeScore != null);
  if (withPct.length === 0) return null;

  return (
    <div className="mb-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Score vs 252-Day Historical Range
        </span>
        <span className="text-[10px] text-slate-600">percentile rank of current score vs trailing year</span>
      </div>
      <div className="space-y-3">
        {withPct.map(f => {
          const pct = Math.round((f.scorePercentile252d ?? 0) * 100);
          const score = Math.round((f.compositeScore ?? 0) * 100);
          const pctColor = pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-lime-400" : pct >= 40 ? "text-amber-400" : "text-red-400";
          const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-lime-500" : pct >= 40 ? "bg-amber-500" : "bg-red-600";
          const label = pct >= 80 ? "Near 1Y High" : pct >= 60 ? "Above Avg" : pct >= 40 ? "Below Avg" : "Near 1Y Low";
          return (
            <div key={f.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-200 w-10">{f.etfTicker}</span>
                  <span className="text-[9px] text-slate-500 hidden sm:inline">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] tabular-nums ${pctColor}`}
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {label}
                  </span>
                  <span className="text-[9px] text-slate-500 tabular-nums"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    score {score} · P{pct}
                  </span>
                </div>
              </div>
              <div className="relative h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                  style={{ width: `${pct}%`, opacity: 0.85 }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/60 rounded-full"
                  style={{ left: `${score}%` }}
                  title={`Current score: ${score}/100`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[9px] text-slate-600 mt-2">
        Bar = score percentile rank vs trailing 252 days · white tick = current score position · P80+ = historically strong
      </div>
    </div>
  );
}
