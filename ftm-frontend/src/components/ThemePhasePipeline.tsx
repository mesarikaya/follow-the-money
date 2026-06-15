import { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

const PHASE_CONFIG: Array<{
  phase: string;
  label: string;
  description: string;
  headerClass: string;
  badgeClass: string;
  dotClass: string;
}> = [
  {
    phase: "BREAKOUT",
    label: "Breakout",
    description: "Score ≥65, accelerating",
    headerClass: "text-emerald-400 border-emerald-700/50",
    badgeClass: "bg-emerald-900/40 border-emerald-700/30 text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  {
    phase: "MOMENTUM",
    label: "Momentum",
    description: "Sustained BUY-zone trend",
    headerClass: "text-sky-400 border-sky-700/50",
    badgeClass: "bg-sky-900/40 border-sky-700/30 text-sky-300",
    dotClass: "bg-sky-500",
  },
  {
    phase: "BUILDING",
    label: "Building",
    description: "Rising toward BUY threshold",
    headerClass: "text-blue-400 border-blue-700/50",
    badgeClass: "bg-blue-900/40 border-blue-700/30 text-blue-300",
    dotClass: "bg-blue-500",
  },
  {
    phase: "SETUP",
    label: "Setup",
    description: "Pre-breakout accumulation",
    headerClass: "text-indigo-400 border-indigo-700/50",
    badgeClass: "bg-indigo-900/40 border-indigo-700/30 text-indigo-300",
    dotClass: "bg-indigo-500",
  },
  {
    phase: "FADING",
    label: "Fading",
    description: "Score declining from peak",
    headerClass: "text-amber-400 border-amber-700/50",
    badgeClass: "bg-amber-900/40 border-amber-700/30 text-amber-300",
    dotClass: "bg-amber-500",
  },
  {
    phase: "WEAK",
    label: "Weak",
    description: "Score ≤35, downtrend",
    headerClass: "text-red-400 border-red-700/50",
    badgeClass: "bg-red-900/40 border-red-700/30 text-red-300",
    dotClass: "bg-red-500",
  },
];

function trendArrow(trend5d: number | null): { arrow: string; cls: string } {
  if (trend5d === null) return { arrow: "—", cls: "text-slate-500" };
  if (trend5d > 0.005) return { arrow: "↑", cls: "text-emerald-400" };
  if (trend5d < -0.005) return { arrow: "↓", cls: "text-red-400" };
  return { arrow: "→", cls: "text-slate-400" };
}

export default function ThemePhasePipeline({ themes }: Props) {
  if (themes.length === 0) return null;

  const byPhase: Record<string, ThemeSummary[]> = {};
  for (const theme of themes) {
    const key = theme.themePhase ?? "UNKNOWN";
    if (!byPhase[key]) byPhase[key] = [];
    byPhase[key].push(theme);
  }

  // Filter to only phases that have themes
  const activeCols = PHASE_CONFIG.filter(cfg => (byPhase[cfg.phase]?.length ?? 0) > 0);
  if (activeCols.length === 0) return null;

  return (
    <section data-testid="theme-phase-pipeline" className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-200 mb-4">Theme Phase Pipeline</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${activeCols.length}, 1fr)` }}>
        {activeCols.map(cfg => {
          const phasethemes = byPhase[cfg.phase] ?? [];
          return (
            <div key={cfg.phase} className={`border rounded-md p-2.5 border-slate-700/40`}>
              <div className={`flex items-center gap-1.5 pb-2 mb-2 border-b ${cfg.headerClass}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                <span className={`text-xs font-semibold ${cfg.headerClass.split(" ")[0]}`}>
                  {cfg.label}
                </span>
                <span className="ml-auto text-[10px] text-slate-500">{phasethemes.length}</span>
              </div>
              <p className="text-[10px] text-slate-600 mb-2">{cfg.description}</p>
              <div className="space-y-1.5">
                {phasethemes
                  .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
                  .map(theme => {
                    const { arrow, cls } = trendArrow(theme.compositeTrend5d);
                    const scorePct = Math.round((theme.compositeScore ?? 0) * 100);
                    return (
                      <div
                        key={theme.id}
                        className={`flex items-center justify-between px-2 py-1 rounded border text-[10px] ${cfg.badgeClass}`}
                        title={theme.thesis}
                      >
                        <span className="truncate max-w-[80%]">{theme.name}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <span className={cls}>{arrow}</span>
                          <span className="text-slate-400">{scorePct}</span>
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-600">
        Arrow shows 5-day trend direction · Score shown as 0–100
      </p>
    </section>
  );
}
