import Link from "next/link";
import { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

type CountdownEntry = {
  theme: ThemeSummary;
  score: number;
  gapPts: number;
  trend5d: number;
  daysToEntry: number;
  accelerating: boolean;
};

function urgencyColor(days: number): { bar: string; text: string; badge: string } {
  if (days <= 5) return {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  };
  if (days <= 14) return {
    bar: "bg-cyan-500",
    text: "text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  };
  return {
    bar: "bg-amber-500",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  };
}

export default function ThemeBuyCountdown({ themes }: Props) {
  const entries: CountdownEntry[] = themes
    .filter(t => {
      const score = t.compositeScore ?? 0;
      return (
        score >= 0.50 &&
        score < 0.65 &&
        t.compositeTrend5d != null &&
        t.compositeTrend5d > 0.002 &&
        t.dominantSignal !== "BUY"
      );
    })
    .map(t => {
      const score = t.compositeScore!;
      const trend5d = t.compositeTrend5d!;
      const gapPts = Math.round((0.65 - score) * 100);
      const daysToEntry = Math.min(99, Math.ceil((0.65 - score) / trend5d));
      const accelerating =
        t.compositeTrend20d != null && trend5d > t.compositeTrend20d + 0.003;
      return { theme: t, score, gapPts, trend5d, daysToEntry, accelerating };
    })
    .sort((a, b) => a.daysToEntry - b.daysToEntry)
    .slice(0, 5);

  if (entries.length === 0) return null;

  return (
    <div
      data-testid="theme-buy-countdown"
      className="bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden mb-4"
    >
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Near Entry
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            · approaching BUY threshold
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-600">
          {entries.length} theme{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-slate-700/20">
        {entries.map(({ theme, score, gapPts, trend5d, daysToEntry, accelerating }) => {
          const scorePct = Math.round(score * 100);
          const progressPct = Math.min(100, Math.max(0, Math.round(((score - 0.50) / 0.15) * 100)));
          const colors = urgencyColor(daysToEntry);

          return (
            <Link
              key={theme.id}
              href={`/themes/${theme.id}`}
              className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-700/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-medium text-slate-200 truncate group-hover:text-white">
                    {theme.name}
                  </span>
                  {accelerating && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 shrink-0">
                      ↑ accel
                    </span>
                  )}
                  {theme.themePhase && (
                    <span className="text-[9px] font-mono text-slate-600 shrink-0">
                      {theme.themePhase}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-700" style={{ width: 80 }}>
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${colors.bar}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{scorePct}/100</span>
                  <span className="text-[10px] font-mono text-slate-600">{gapPts}pt to BUY</span>
                  <span className={`text-[9px] font-mono ${colors.text}`}>
                    +{(trend5d * 100).toFixed(1)}pt/d
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={`text-[11px] font-bold font-mono ${colors.text}`}>
                  ~{daysToEntry}d
                </span>
                <span className="text-[9px] font-mono text-slate-600">to BUY</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
