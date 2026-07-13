import { ThemeHistoryPoint } from "@/lib/api";
import { WinnerSide } from "@/lib/themes/themeComparison";

/** The building blocks of the comparison table: the dual sparkline, a metric row, and the cells. */

export const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY:    { label: "BUY",    color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { label: "WATCH",  color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40" },
  REDUCE: { label: "REDUCE", color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30" },
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-400", B: "text-cyan-400", C: "text-amber-400", D: "text-orange-400", F: "text-red-400",
};

export function gradeColor(grade: string) { return GRADE_COLOR[grade] ?? "text-slate-400"; }

export function scoreColor(score: number | null) {
  if (score == null) return "text-slate-500";
  return score >= 0.65 ? "text-emerald-400" : score >= 0.50 ? "text-cyan-400" : score >= 0.35 ? "text-amber-400" : "text-red-400";
}

export function scoreBarColor(score: number | null) {
  if (score == null) return "bg-slate-600";
  return score >= 0.65 ? "bg-emerald-500" : score >= 0.50 ? "bg-cyan-500" : score >= 0.35 ? "bg-amber-500" : "bg-red-500";
}

export function ComparisonSparkline({
  historyA,
  historyB,
  nameA,
  nameB,
}: {
  historyA: ThemeHistoryPoint[];
  historyB: ThemeHistoryPoint[];
  nameA: string;
  nameB: string;
}) {
  if (historyA.length < 2 && historyB.length < 2) return null;
  const W = 480, H = 80, padX = 8, padY = 8;

  const allVals = [
    ...historyA.map(h => h.compositeScore),
    ...historyB.map(h => h.compositeScore),
  ];
  const minV = Math.min(...allVals) - 0.02;
  const maxV = Math.max(...allVals) + 0.02;
  const range = Math.max(maxV - minV, 0.01);
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const toPath = (hist: ThemeHistoryPoint[]) => {
    if (hist.length < 2) return "";
    return hist
      .map((h, i) => {
        const x = padX + (i / (hist.length - 1)) * chartW;
        const y = padY + (1 - (h.compositeScore - minV) / range) * chartH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const latA = historyA[historyA.length - 1]?.compositeScore ?? 0;
  const latB = historyB[historyB.length - 1]?.compositeScore ?? 0;
  const colorA = latA >= 0.65 ? "#34d399" : latA >= 0.50 ? "#22d3ee" : latA >= 0.35 ? "#fbbf24" : "#f87171";
  const colorB = latB >= 0.65 ? "#34d399" : latB >= 0.50 ? "#22d3ee" : latB >= 0.35 ? "#fbbf24" : "#f87171";

  const buyY = padY + (1 - (0.65 - minV) / range) * chartH;
  const watchY = padY + (1 - (0.50 - minV) / range) * chartH;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-6 mb-3 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 rounded" style={{ backgroundColor: colorA }} />
          <span className="text-slate-400">{nameA}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 rounded opacity-60" style={{ backgroundColor: colorB, borderTop: "2px dashed" }} />
          <span className="text-slate-500">{nameB}</span>
        </div>
        <span className="ml-auto text-slate-700">30-day scores</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {buyY >= padY && buyY <= padY + chartH && (
          <>
            <line x1={padX} y1={buyY} x2={W - padX} y2={buyY} stroke="#34d39920" strokeWidth="1" strokeDasharray="3 2" />
            <text x={padX + 2} y={buyY - 2} fill="#34d39940" fontSize="7" fontFamily="monospace">BUY 65</text>
          </>
        )}
        {watchY >= padY && watchY <= padY + chartH && (
          <line x1={padX} y1={watchY} x2={W - padX} y2={watchY} stroke="#22d3ee15" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {historyB.length >= 2 && (
          <path d={toPath(historyB)} fill="none" stroke={colorB} strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 2" strokeLinecap="round" />
        )}
        {historyA.length >= 2 && (
          <path d={toPath(historyA)} fill="none" stroke={colorA} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}

export function ComparisonMetricRow({
  label,
  cellA,
  cellB,
  winner,
  subtitle,
}: {
  label: string;
  cellA: React.ReactNode;
  cellB: React.ReactNode;
  winner: WinnerSide;
  subtitle?: string;
}) {
  const winnerClass = "bg-slate-700/30";
  return (
    <tr className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors">
      <td className="py-2.5 px-4 text-[10px] font-mono text-slate-500 uppercase tracking-wider w-28 shrink-0">
        {label}
        {subtitle && <div className="text-[9px] text-slate-700 normal-case tracking-normal font-normal mt-0.5">{subtitle}</div>}
      </td>
      <td className={`py-2.5 px-4 text-left ${winner === "A" ? winnerClass : ""}`}>
        <div className="flex items-center gap-1.5">
          {winner === "A" && <span className="text-emerald-400 text-[9px] font-mono">✓</span>}
          {cellA}
        </div>
      </td>
      <td className={`py-2.5 px-4 text-left ${winner === "B" ? winnerClass : ""}`}>
        <div className="flex items-center gap-1.5">
          {winner === "B" && <span className="text-emerald-400 text-[9px] font-mono">✓</span>}
          {cellB}
        </div>
      </td>
    </tr>
  );
}

export function ScoreBarCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums ${scoreColor(score)}`}>{pct}</span>
    </div>
  );
}

export function GradeBadge({ grade, score, label }: { grade: string; score: number; label: string }) {
  return (
    <span
      className={`text-xs font-mono font-bold ${gradeColor(grade)}`}
      title={`${label}: ${score}/100`}
    >
      {grade}
      <span className="text-slate-600 font-normal ml-1">({score})</span>
    </span>
  );
}
