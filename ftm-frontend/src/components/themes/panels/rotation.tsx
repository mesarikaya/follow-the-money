import { CapitalRotationData, ThemeSummary } from "@/lib/api";
import { MomentumAlignmentBadge } from "@/components/themes/badges";

/**
 * How hard capital is rotating between themes right now, and which themes disagree with
 * their own momentum.
 */


export const CapitalRotationPanel = ({ data }: { data: CapitalRotationData }) => {
  const INTENSITY_CONFIG: Record<string, { label: string; className: string; barColor: string }> = {
    STRONG:        { label: "STRONG ROTATION",  className: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30", barColor: "bg-emerald-500" },
    MODERATE:      { label: "MODERATE ROTATION", className: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",          barColor: "bg-cyan-500" },
    LOW:           { label: "LOW ROTATION",      className: "text-amber-300 bg-amber-500/15 border-amber-500/30",       barColor: "bg-amber-500" },
    CONSOLIDATING: { label: "CONSOLIDATING",     className: "text-slate-400 bg-slate-700/40 border-slate-600/40",       barColor: "bg-slate-500" },
  };
  const cfg = INTENSITY_CONFIG[data.intensityLabel] ?? INTENSITY_CONFIG.CONSOLIDATING;
  const scorePct = Math.round(data.rotationScore * 100);
  const dispersionPct = Math.round(data.scoreDispersion * 100);
  const alignmentPct = Math.round(data.trendAlignment * 100);
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-3">
        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Capital Rotation Score</span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cfg.className}`}>
          {cfg.label}
        </span>
        <span className="ml-auto text-[11px] font-mono font-bold text-slate-200">{scorePct}</span>
        <span className="text-[9px] font-mono text-slate-600">/100</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase">Score Dispersion</span>
              <span className="text-[10px] font-mono text-slate-400">{dispersionPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cfg.barColor} opacity-80`} style={{ width: `${dispersionPct}%` }} />
            </div>
            <p className="text-[9px] text-slate-600 mt-0.5">IQR of composite scores — wider = more dispersed capital</p>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase">Trend Alignment</span>
              <span className="text-[10px] font-mono text-slate-400">{alignmentPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cfg.barColor} opacity-80`} style={{ width: `${alignmentPct}%` }} />
            </div>
            <p className="text-[9px] text-slate-600 mt-0.5">Winners trending up + losers trending down simultaneously</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {data.leadingThemeNames.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-emerald-600 uppercase mb-1.5">Leading</div>
              <div className="flex flex-col gap-1">
                {data.leadingThemeNames.map((name, i) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-600">#{i + 1}</span>
                    <span className="text-[10px] text-slate-300 truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.laggingThemeNames.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-red-700 uppercase mb-1.5">Lagging</div>
              <div className="flex flex-col gap-1">
                {data.laggingThemeNames.map((name) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-600">↓</span>
                    <span className="text-[10px] text-slate-500 truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const MomentumDivergencePanel = ({ themes }: { themes: ThemeSummary[] }) => {
  const fading = themes.filter(t => t.momentumAlignment === "FADING" && t.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const recovering = themes.filter(t => t.momentumAlignment === "RECOVERING" && t.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  if (fading.length === 0 && recovering.length === 0) return null;
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Momentum Divergence</span>
        <span className="text-[9px] text-slate-600">5d vs 20d trend misalignment signals</span>
      </div>
      <div className="divide-y divide-slate-700/30">
        {recovering.length > 0 && (
          <div className="px-4 py-2.5">
            <div className="text-[9px] font-mono text-teal-600 uppercase mb-2">Recovering — dip in healthy uptrend</div>
            <div className="flex flex-col gap-1.5">
              {recovering.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <MomentumAlignmentBadge alignment="RECOVERING" />
                  <span className="text-[11px] font-medium text-slate-200 flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    score {Math.round((t.compositeScore ?? 0) * 100)}
                  </span>
                  <span className="text-[9px] font-mono text-teal-400">
                    5d {t.compositeTrend5d != null ? `${t.compositeTrend5d > 0 ? "+" : ""}${(t.compositeTrend5d * 100).toFixed(1)}pt` : "—"}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400">
                    20d {t.compositeTrend20d != null ? `+${(t.compositeTrend20d * 100).toFixed(1)}pt` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {fading.length > 0 && (
          <div className="px-4 py-2.5">
            <div className="text-[9px] font-mono text-amber-600 uppercase mb-2">Fading — short bounce in declining trend</div>
            <div className="flex flex-col gap-1.5">
              {fading.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <MomentumAlignmentBadge alignment="FADING" />
                  <span className="text-[11px] font-medium text-slate-200 flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    score {Math.round((t.compositeScore ?? 0) * 100)}
                  </span>
                  <span className="text-[9px] font-mono text-amber-400">
                    5d +{t.compositeTrend5d != null ? `${(t.compositeTrend5d * 100).toFixed(1)}pt` : "—"}
                  </span>
                  <span className="text-[9px] font-mono text-red-400">
                    20d {t.compositeTrend20d != null ? `${(t.compositeTrend20d * 100).toFixed(1)}pt` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
