import type { ThemeSummary, ThemeHistoryPoint } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
};

type StreakEntry = {
  theme: ThemeSummary;
  signal: string;
  streakDays: number;
};

const SIGNAL_STYLES: Record<string, { bar: string; badge: string; text: string }> = {
  BUY:    { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", text: "text-emerald-400" },
  WATCH:  { bar: "bg-cyan-500",    badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",          text: "text-cyan-400" },
  HOLD:   { bar: "bg-slate-500",   badge: "bg-slate-500/15 text-slate-400 border-slate-500/30",       text: "text-slate-400" },
  REDUCE: { bar: "bg-red-500",     badge: "bg-red-500/15 text-red-400 border-red-500/30",             text: "text-red-400" },
};

function inferSignalFromScore(score: number): string {
  if (score >= 0.65) return "BUY";
  if (score >= 0.50) return "WATCH";
  if (score >= 0.35) return "HOLD";
  return "REDUCE";
}

function computeSignalStreak(history: ThemeHistoryPoint[], signal: string): number {
  const newest = [...history].reverse();
  let streak = 0;
  for (const point of newest) {
    if (inferSignalFromScore(point.compositeScore) === signal) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default function ThemeSignalStreakPanel({ themes, historiesByThemeId }: Props) {
  const entries: StreakEntry[] = themes
    .map(theme => {
      const history = historiesByThemeId[theme.id] ?? [];
      const signal = inferSignalFromScore(theme.compositeScore ?? 0);
      const streakDays = history.length >= 3 ? computeSignalStreak(history, signal) : 0;
      return { theme, signal, streakDays };
    })
    .filter(e => e.streakDays > 0)
    .sort((a, b) => b.streakDays - a.streakDays)
    .slice(0, 6);

  if (entries.length === 0) return null;

  const maxStreak = Math.max(...entries.map(e => e.streakDays), 1);
  const topEntry = entries[0];

  return (
    <section
      className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3"
      data-testid="theme-signal-streak-panel"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Signal Conviction Tracker</h2>
        <span className="text-xs text-slate-500">consecutive days at current signal</span>
      </div>

      <div className="space-y-2.5">
        {entries.map(({ theme, signal, streakDays }) => {
          const styles = SIGNAL_STYLES[signal] ?? SIGNAL_STYLES.HOLD;
          const barWidth = (streakDays / maxStreak) * 100;
          return (
            <div key={theme.id} className="flex items-center gap-3 min-w-0">
              <div
                className="w-36 shrink-0 text-xs text-slate-300 truncate"
                title={theme.name}
              >
                {theme.name}
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${styles.badge}`}
              >
                {signal}
              </span>
              <div className="flex-1 bg-slate-700/50 rounded-full h-2 overflow-hidden min-w-0">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${styles.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span
                className={`text-xs font-mono tabular-nums w-10 text-right shrink-0 ${styles.text}`}
              >
                {streakDays}d
              </span>
            </div>
          );
        })}
      </div>

      {topEntry && topEntry.streakDays >= 20 && (
        <p className="text-[11px] text-slate-500 border-t border-slate-700/40 pt-2">
          <span className={SIGNAL_STYLES[topEntry.signal]?.text ?? "text-slate-400"}>
            {topEntry.theme.name}
          </span>{" "}
          has held {topEntry.signal} for {topEntry.streakDays} consecutive days — sustained conviction.
        </p>
      )}
    </section>
  );
}
