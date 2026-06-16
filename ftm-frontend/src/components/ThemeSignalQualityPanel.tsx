import { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

type QualityEntry = {
  theme: ThemeSummary;
  qualityScore: number;
  streakDays: number;
  volatility: number | null;
  grade: "A" | "B" | "C" | "D";
};

const SIGNAL_COLORS: Record<string, string> = {
  BUY: "text-emerald-400",
  WATCH: "text-cyan-400",
  HOLD: "text-amber-400",
  REDUCE: "text-red-400",
};

const SIGNAL_BG: Record<string, string> = {
  BUY: "bg-emerald-500/20 border-emerald-700/40",
  WATCH: "bg-cyan-500/20 border-cyan-700/40",
  HOLD: "bg-amber-500/20 border-amber-700/40",
  REDUCE: "bg-red-500/20 border-red-700/40",
};

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-300 bg-emerald-900/50 border border-emerald-700/40",
  B: "text-cyan-300 bg-cyan-900/50 border border-cyan-700/40",
  C: "text-amber-300 bg-amber-900/50 border border-amber-700/40",
  D: "text-red-300 bg-red-900/50 border border-red-700/40",
};

function computeGrade(qualityScore: number): QualityEntry["grade"] {
  if (qualityScore >= 0.7) return "A";
  if (qualityScore >= 0.45) return "B";
  if (qualityScore >= 0.2) return "C";
  return "D";
}

export default function ThemeSignalQualityPanel({ themes }: Props) {
  const entries: QualityEntry[] = themes
    .filter((t) => t.signalStreakDays > 0)
    .map((t) => {
      const streakDays = t.signalStreakDays;
      const volatility = t.volatility30d;
      const stabilityFactor = volatility != null ? Math.max(0, 1 - volatility * 10) : 0.5;
      const streakFactor = Math.min(1, streakDays / 20);
      const qualityScore = streakFactor * stabilityFactor;
      return {
        theme: t,
        qualityScore,
        streakDays,
        volatility,
        grade: computeGrade(qualityScore),
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 6);

  if (entries.length === 0) return null;

  const topEntry = entries[0];
  const isHighConviction = topEntry.grade === "A" && topEntry.streakDays >= 15;

  return (
    <section
      className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 space-y-4"
      data-testid="theme-signal-quality-panel"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Signal Quality Ranking</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Streak consistency × score stability — higher grade = more reliable signal
          </p>
        </div>
        {isHighConviction && (
          <span className="text-xs font-medium text-emerald-300 bg-emerald-900/50 border border-emerald-700/40 px-2.5 py-1 rounded-full">
            Elite conviction
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {entries.map((entry, index) => {
          const signalColor = SIGNAL_COLORS[entry.theme.dominantSignal] ?? "text-slate-300";
          const signalBg = SIGNAL_BG[entry.theme.dominantSignal] ?? "bg-slate-700/40 border-slate-600/40";
          const gradeStyle = GRADE_COLORS[entry.grade];
          const barWidth = Math.round(entry.qualityScore * 100);

          return (
            <div key={entry.theme.id} className="flex items-center gap-3">
              <span className="w-4 text-xs text-slate-500 text-right shrink-0">
                {index + 1}
              </span>

              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${gradeStyle} w-6 text-center shrink-0`}
                data-testid="quality-grade"
              >
                {entry.grade}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {entry.theme.name}
                  </span>
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${signalBg} ${signalColor} shrink-0`}
                  >
                    {entry.theme.dominantSignal}
                  </span>
                </div>
                <div className="relative h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      entry.grade === "A"
                        ? "bg-emerald-500"
                        : entry.grade === "B"
                          ? "bg-cyan-500"
                          : entry.grade === "C"
                            ? "bg-amber-500"
                            : "bg-red-500"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>

              <div className="text-right shrink-0 space-y-0.5">
                <div
                  className="text-xs font-medium text-slate-200"
                  data-testid="streak-days-label"
                >
                  {entry.streakDays}d streak
                </div>
                {entry.volatility != null && (
                  <div className="text-xs text-slate-500">
                    σ={entry.volatility.toFixed(3)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-1 border-t border-slate-700/40 flex gap-4 text-xs text-slate-500">
        <span>Grade A ≥ 70 quality pts</span>
        <span>Grade B ≥ 45</span>
        <span>Grade C ≥ 20</span>
      </div>
    </section>
  );
}
