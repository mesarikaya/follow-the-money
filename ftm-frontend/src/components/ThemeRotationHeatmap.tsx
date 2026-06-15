import { ThemeSummary, ThemeHistoryPoint } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
  columns?: number;
};

function scoreToCell(score: number): { bg: string; label: string } {
  if (score >= 0.65) return { bg: "bg-emerald-600", label: "BUY" };
  if (score >= 0.50) return { bg: "bg-sky-600", label: "WATCH" };
  if (score >= 0.35) return { bg: "bg-amber-600", label: "HOLD" };
  return { bg: "bg-red-700", label: "REDUCE" };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function phaseBadge(phase: string | null): string {
  switch (phase) {
    case "BREAKOUT": return "text-emerald-400";
    case "SETUP": return "text-sky-400";
    case "FADING": return "text-amber-400";
    case "WEAK": return "text-red-400";
    default: return "text-slate-500";
  }
}

export default function ThemeRotationHeatmap({
  themes,
  historiesByThemeId,
  columns = 7,
}: Props) {
  const sortedThemes = [...themes].sort(
    (a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)
  );

  // Derive column dates from the first theme with history
  const referenceDates: string[] = [];
  for (const theme of sortedThemes) {
    const history = historiesByThemeId[theme.id] ?? [];
    if (history.length >= 2) {
      const tail = history.slice(-columns);
      tail.forEach(h => referenceDates.push(h.date));
      break;
    }
  }

  if (referenceDates.length === 0 || sortedThemes.length === 0) return null;

  const scoreLookup: Record<string, Record<string, number>> = {};
  for (const theme of sortedThemes) {
    const history = historiesByThemeId[theme.id] ?? [];
    scoreLookup[theme.id] = {};
    for (const point of history) {
      scoreLookup[theme.id][point.date] = point.compositeScore;
    }
  }

  return (
    <section data-testid="theme-rotation-heatmap" className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-200 mb-4">Theme Rotation Heatmap</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-400 font-medium pb-2 pr-4 min-w-[140px]">Theme</th>
              {referenceDates.map(date => (
                <th key={date} className="text-center text-slate-500 font-normal pb-2 px-1 min-w-[52px]">
                  {formatDate(date)}
                </th>
              ))}
              <th className="text-right text-slate-400 font-medium pb-2 pl-4 min-w-[60px]">Now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sortedThemes.map(theme => {
              const scoreByDate = scoreLookup[theme.id] ?? {};
              const currentScore = theme.compositeScore ?? 0;
              return (
                <tr key={theme.id}>
                  <td className="py-1.5 pr-4">
                    <span className="text-slate-300 font-medium truncate block max-w-[140px]">{theme.name}</span>
                    <span className={`text-[10px] ${phaseBadge(theme.themePhase)}`}>
                      {theme.themePhase ?? "—"}
                    </span>
                  </td>
                  {referenceDates.map(date => {
                    const score = scoreByDate[date];
                    if (score === undefined) {
                      return (
                        <td key={date} className="px-1 py-1.5 text-center">
                          <span className="inline-block w-9 h-6 rounded bg-slate-700/50" />
                        </td>
                      );
                    }
                    const { bg } = scoreToCell(score);
                    return (
                      <td key={date} className="px-1 py-1.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-semibold text-white ${bg}`}
                          title={`${theme.name} — ${date}: ${(score * 100).toFixed(0)}`}
                        >
                          {(score * 100).toFixed(0)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="pl-4 py-1.5 text-right">
                    <span className={`font-semibold ${scoreToCell(currentScore).bg} text-white px-2 py-0.5 rounded text-[10px]`}>
                      {(currentScore * 100).toFixed(0)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        Color: <span className="text-emerald-400">≥65 BUY</span> · <span className="text-sky-400">50–64 WATCH</span> · <span className="text-amber-400">35–49 HOLD</span> · <span className="text-red-400">&lt;35 REDUCE</span>
      </p>
    </section>
  );
}
