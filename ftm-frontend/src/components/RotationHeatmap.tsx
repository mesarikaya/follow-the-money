import { CategorySummary } from "@/lib/api";

const QUADRANT_CONFIG: Record<string, { label: string; dot: string }> = {
  "1": { label: "Leading",   dot: "bg-green-400"  },
  "2": { label: "Improving", dot: "bg-blue-400"   },
  "3": { label: "Weakening", dot: "bg-orange-400" },
  "4": { label: "Lagging",   dot: "bg-slate-500"  },
};

function scoreColors(score: number | null): string {
  if (score === null) return "bg-slate-800 border-slate-700 text-slate-500";
  if (score >= 0.7) return "bg-emerald-900/30 border-emerald-600/40 text-emerald-200";
  if (score >= 0.5) return "bg-blue-900/25 border-blue-600/30 text-blue-200";
  if (score >= 0.3) return "bg-amber-900/20 border-amber-600/30 text-amber-200";
  return "bg-red-900/20 border-red-700/30 text-red-300";
}

function TrendPips({
  trend5d,
  trend20d,
}: {
  trend5d: number | null;
  trend20d: number | null;
}) {
  const p20 = trend20d != null ? Math.round(trend20d * 100) : null;
  const p5 = trend5d != null ? Math.round(trend5d * 100) : null;

  if (p20 == null && p5 == null) return null;

  const dominant = p20 ?? p5!;
  const abs = Math.abs(dominant);
  if (abs < 2) return <span className="text-slate-600 text-[9px]">→</span>;
  const color = dominant > 0 ? "text-emerald-400" : "text-red-400";
  const arrow = dominant > 0 ? "↑" : "↓";

  return (
    <span
      className={`text-[9px] tabular-nums font-semibold ${color}`}
      title={`20d trend: ${p20 != null ? (p20 > 0 ? "+" : "") + p20 + " pts" : "n/a"}${p5 != null ? " · 5d: " + (p5 > 0 ? "+" : "") + p5 + " pts" : ""}`}
    >
      {arrow}{abs}
    </span>
  );
}

type Props = { categories: CategorySummary[] };

export default function RotationHeatmap({ categories }: Props) {
  const sorted = [...categories].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const equities = sorted.filter(c => c.type === "EQUITY_SECTOR");
  const others   = sorted.filter(c => c.type !== "EQUITY_SECTOR");

  const renderCard = (cat: CategorySummary) => {
    const score = cat.compositeScore;
    const pct = score != null ? Math.round(score * 100) : null;
    const q = cat.rrgQuadrant ? QUADRANT_CONFIG[cat.rrgQuadrant] : null;
    const colorClass = scoreColors(score);
    const barWidth = pct != null ? `${pct}%` : "0%";
    const barColor =
      score == null ? "bg-slate-700" :
      score >= 0.7 ? "bg-emerald-500" :
      score >= 0.5 ? "bg-blue-500" :
      score >= 0.3 ? "bg-amber-500" : "bg-red-500";

    return (
      <div key={cat.id} className={`border rounded-lg p-3 flex flex-col gap-2 ${colorClass}`}>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-slate-500">{cat.etfTicker}</span>
            <span className="text-xs font-bold tracking-tight">{cat.id}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendPips trend5d={cat.compositeTrend5d} trend20d={cat.compositeTrend20d} />
            <span className="text-sm font-bold tabular-nums">{pct ?? "—"}</span>
          </div>
        </div>

        <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: barWidth }} />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 truncate leading-tight flex-1 mr-1">{cat.name}</p>
          {q && (
            <span className="flex items-center gap-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${q.dot}`} />
              <span className="text-[9px] text-slate-500">{q.label}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {equities.map(renderCard)}
      </div>
      {others.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {others.map(renderCard)}
        </div>
      )}
    </div>
  );
}
