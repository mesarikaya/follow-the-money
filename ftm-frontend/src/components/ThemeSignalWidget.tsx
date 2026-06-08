import Link from "next/link";
import { ThemeSummary, ThemeHistoryPoint } from "@/lib/api";

const SIGNAL_COLOR: Record<string, string> = {
  BUY:    "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  WATCH:  "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  HOLD:   "text-slate-400 bg-slate-700/60 border-slate-600/40",
  REDUCE: "text-red-400 bg-red-500/15 border-red-500/30",
};

function MiniSparkline({ history }: { history: ThemeHistoryPoint[] }) {
  if (history.length < 2) return null;
  const values = history.map(h => h.compositeScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const width = 56, height = 16;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = range > 0 ? height - ((v - min) / range) * (height - 2) - 1 : height / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const latest = values[values.length - 1];
  const first = values[0];
  const trending = latest > first + 0.02 ? "up" : latest < first - 0.02 ? "down" : "flat";
  const stroke = trending === "up" ? "#34d399" : trending === "down" ? "#f87171" : "#94a3b8";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DivergenceBadge({ divergence }: { divergence: number | null }) {
  if (divergence == null) return null;
  const pts = Math.round(divergence * 100);
  if (Math.abs(pts) < 2) return null;
  const isPositive = pts > 0;
  const cls = isPositive
    ? "text-emerald-400 bg-emerald-500/10"
    : "text-red-400 bg-red-500/10";
  return (
    <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${cls}`} title="Theme vs parent sectors (rotation signal)">
      {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{pts}pt vs sectors
    </span>
  );
}

type ThemeWithHistory = {
  theme: ThemeSummary;
  history: ThemeHistoryPoint[];
};

function ActionableThemeRow({ theme, history }: ThemeWithHistory) {
  const signalClass = SIGNAL_COLOR[theme.dominantSignal] ?? SIGNAL_COLOR.HOLD;
  const scorePercent = theme.compositeScore != null ? Math.round(theme.compositeScore * 100) : null;

  return (
    <Link
      href={`/themes/${theme.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-slate-700/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-white truncate group-hover:text-slate-100" style={{ fontFamily: "var(--font-rajdhani)" }}>
            {theme.name}
          </span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${signalClass}`}>
            {theme.dominantSignal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {scorePercent != null && (
            <span className="text-[10px] font-mono text-slate-400">{scorePercent}/100</span>
          )}
          <span className="text-[10px] text-slate-500">{theme.bullishCount}/{theme.constituentCount} bullish</span>
          <DivergenceBadge divergence={theme.divergenceFromParentSectors} />
        </div>
      </div>
      <MiniSparkline history={history} />
    </Link>
  );
}

type Props = {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
};

export default function ThemeSignalWidget({ themes, historiesByThemeId }: Props) {
  const actionableThemes = themes
    .filter(t => t.dominantSignal === "BUY" || t.dominantSignal === "WATCH")
    .sort((a, b) => {
      const scoreA = (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
      if (scoreA !== 0) return scoreA;
      return (b.divergenceFromParentSectors ?? 0) - (a.divergenceFromParentSectors ?? 0);
    })
    .slice(0, 4);

  if (actionableThemes.length === 0) return null;

  return (
    <section className="bg-slate-800/50 border border-slate-700/60 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Active Themes</h2>
          <span className="text-[10px] font-mono text-slate-500">{actionableThemes.length} signalling</span>
        </div>
        <Link
          href="/themes"
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          All themes →
        </Link>
      </div>
      <div className="divide-y divide-slate-700/40">
        {actionableThemes.map(theme => (
          <ActionableThemeRow
            key={theme.id}
            theme={theme}
            history={historiesByThemeId[theme.id] ?? []}
          />
        ))}
      </div>
    </section>
  );
}
