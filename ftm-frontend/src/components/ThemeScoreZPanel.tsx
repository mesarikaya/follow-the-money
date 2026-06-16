import Link from "next/link";
import { ThemeSummary, ThemeHistoryPoint } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
};

type ZEntry = {
  theme: ThemeSummary;
  z: number;
  current: number;
  mean: number;
};

function computeZ(history: ThemeHistoryPoint[]): number | null {
  if (history.length < 6) return null;
  const scores = history.map(h => h.compositeScore);
  const current = scores[scores.length - 1];
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  if (stddev < 0.005) return null;
  return (current - mean) / stddev;
}

function zColor(z: number): { bar: string; text: string } {
  if (z >= 2.0) return { bar: "bg-emerald-500", text: "text-emerald-400" };
  if (z >= 1.0) return { bar: "bg-cyan-500", text: "text-cyan-400" };
  if (z >= 0) return { bar: "bg-slate-500", text: "text-slate-400" };
  if (z >= -1.0) return { bar: "bg-amber-500", text: "text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-400" };
}

export default function ThemeScoreZPanel({ themes, historiesByThemeId }: Props) {
  const entries: ZEntry[] = [];

  for (const theme of themes) {
    const history = historiesByThemeId[theme.id] ?? [];
    const z = computeZ(history);
    if (z == null) continue;
    const current = history[history.length - 1]?.compositeScore ?? 0;
    const scores = history.map(h => h.compositeScore);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    entries.push({ theme, z, current, mean });
  }

  if (entries.length < 2) return null;

  entries.sort((a, b) => b.z - a.z);

  const elevated = entries.slice(0, 3);
  const depressed = entries.slice(-2).reverse();

  const maxAbsZ = Math.max(1, ...entries.map(e => Math.abs(e.z)));

  const renderRow = (entry: ZEntry, direction: "high" | "low") => {
    const { theme, z, current, mean } = entry;
    const { bar, text } = zColor(z);
    const absZ = Math.abs(z);
    const barWidth = Math.round((absZ / maxAbsZ) * 100);
    const scorePct = Math.round(current * 100);
    const meanPct = Math.round(mean * 100);

    return (
      <Link
        key={theme.id}
        href={`/themes/${theme.id}`}
        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/30 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium text-slate-200 truncate group-hover:text-white">
              {theme.name}
            </span>
            <span className="text-[9px] font-mono text-slate-600 shrink-0">
              {scorePct} vs avg {meanPct}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-1 rounded-full ${direction === "high" ? bar : "bg-amber-500"}`}
              style={{ width: `${barWidth}%`, maxWidth: 80 }}
            />
            <span className={`text-[9px] font-mono ${text} shrink-0`}>
              {z > 0 ? "+" : ""}{z.toFixed(2)}σ
            </span>
          </div>
        </div>
        <span className={`text-[10px] font-bold font-mono shrink-0 ${text}`}>
          {z > 0 ? "↑" : "↓"} {absZ.toFixed(1)}σ
        </span>
      </Link>
    );
  };

  return (
    <div
      data-testid="theme-score-z-panel"
      className="bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden mb-4"
    >
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Score Z-Score
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            · deviation from 30-day mean
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-600">
          σ = {entries.length} themes
        </span>
      </div>

      {elevated.length > 0 && (
        <div>
          <div className="px-4 py-1 bg-emerald-900/10 border-b border-emerald-900/20">
            <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-wider">
              Elevated · above 30d mean
            </span>
          </div>
          <div className="divide-y divide-slate-700/20">
            {elevated.map(e => renderRow(e, "high"))}
          </div>
        </div>
      )}

      {depressed.length > 0 && (
        <div className="border-t border-slate-700/30">
          <div className="px-4 py-1 bg-red-900/10 border-b border-red-900/20">
            <span className="text-[9px] font-mono text-amber-500/80 uppercase tracking-wider">
              Depressed · below 30d mean
            </span>
          </div>
          <div className="divide-y divide-slate-700/20">
            {depressed.map(e => renderRow(e, "low"))}
          </div>
        </div>
      )}
    </div>
  );
}
