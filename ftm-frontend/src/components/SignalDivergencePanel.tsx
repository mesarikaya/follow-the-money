import { CategorySummary } from "@/lib/api";

type DivergenceType = "SCORE_HIGH_RRG_WEAKENING" | "SCORE_LOW_RRG_IMPROVING";

const DIVERGENCE_CONFIG: Record<DivergenceType, {
  title: string;
  note: string;
  interpretation: string;
  scoreBadgeClass: string;
  quadrantLabel: string;
}> = {
  SCORE_HIGH_RRG_WEAKENING: {
    title: "Score ↑ / RRG ↘",
    note: "composite strong but RS fading",
    interpretation: "High composite score with weakening RRG momentum — possible rotation peak. Watch for score deterioration.",
    scoreBadgeClass: "bg-green-900/30 text-green-300 border border-green-700/30",
    quadrantLabel: "↘ Weakening",
  },
  SCORE_LOW_RRG_IMPROVING: {
    title: "Score ↓ / RRG ↖",
    note: "composite weak but RS building",
    interpretation: "Low composite score with improving RRG momentum — potential early-stage recovery. Watch for score breakout above 40.",
    scoreBadgeClass: "bg-red-900/30 text-red-300 border border-red-700/30",
    quadrantLabel: "↖ Improving",
  },
};

type DivergenceEntry = {
  cat: CategorySummary;
  type: DivergenceType;
};

export default function SignalDivergencePanel({ categories }: { categories: CategorySummary[] }) {
  const divergences: DivergenceEntry[] = [];

  for (const cat of categories) {
    if (cat.type !== "EQUITY_SECTOR") continue;
    if (cat.compositeScore == null || cat.rrgQuadrant == null) continue;

    const score = cat.compositeScore;
    const quadrant = cat.rrgQuadrant;

    if (score >= 0.65 && quadrant === "3") {
      divergences.push({ cat, type: "SCORE_HIGH_RRG_WEAKENING" });
    } else if (score < 0.40 && quadrant === "2") {
      divergences.push({ cat, type: "SCORE_LOW_RRG_IMPROVING" });
    }
  }

  if (divergences.length === 0) return null;

  const peaks    = divergences.filter(d => d.type === "SCORE_HIGH_RRG_WEAKENING");
  const recovers = divergences.filter(d => d.type === "SCORE_LOW_RRG_IMPROVING");

  const renderEntry = (entry: DivergenceEntry) => {
    const config = DIVERGENCE_CONFIG[entry.type];
    const score = Math.round((entry.cat.compositeScore ?? 0) * 100);
    return (
      <div
        key={entry.cat.id}
        className="flex items-center gap-3 py-1.5 border-b border-slate-700/30 last:border-0"
        title={config.interpretation}
      >
        <span
          className="font-mono text-xs text-cyan-400 w-10 shrink-0"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {entry.cat.etfTicker}
        </span>
        <span className="flex-1 text-xs text-slate-300 truncate">{entry.cat.name}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${config.scoreBadgeClass}`}>
          {score}/100
        </span>
        <span className="text-[10px] text-slate-500 shrink-0">{config.quadrantLabel}</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-800/40 border border-amber-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rotation Peak?</span>
          <span className="text-[10px] text-slate-600 ml-auto">score strong, momentum fading</span>
        </div>
        {peaks.length === 0 ? (
          <p className="text-[11px] text-slate-600 py-2">No divergences</p>
        ) : (
          peaks.map(renderEntry)
        )}
      </div>

      <div className="bg-slate-800/40 border border-blue-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Early Recovery?</span>
          <span className="text-[10px] text-slate-600 ml-auto">score weak, momentum building</span>
        </div>
        {recovers.length === 0 ? (
          <p className="text-[11px] text-slate-600 py-2">No divergences</p>
        ) : (
          recovers.map(renderEntry)
        )}
      </div>
    </div>
  );
}
