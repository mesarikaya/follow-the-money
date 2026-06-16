import Link from "next/link";
import { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

const SIGNAL_COLORS: Record<string, string> = {
  BUY:    "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
  WATCH:  "bg-cyan-900/60 text-cyan-300 border border-cyan-700/50",
  HOLD:   "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  REDUCE: "bg-red-900/60 text-red-300 border border-red-700/50",
};

type ThemeRowProps = {
  theme: ThemeSummary;
  showTrend?: boolean;
  showPercentile?: boolean;
};

function percentileLabel(pct: number | null): string | null {
  if (pct == null) return null;
  return `P${Math.round(pct * 100)}`;
}

function percentileColor(pct: number): string {
  if (pct >= 0.80) return "text-rose-400";
  if (pct >= 0.60) return "text-slate-400";
  return "text-emerald-400";
}

function ThemeRow({ theme, showTrend, showPercentile }: ThemeRowProps) {
  const score = theme.compositeScore != null ? Math.round(theme.compositeScore * 100) : null;
  const trend = theme.compositeTrend5d;
  const trendPct = trend != null ? (trend * 100).toFixed(1) : null;
  const isRising = trend != null && trend > 0;
  const signalClass = SIGNAL_COLORS[theme.dominantSignal] ?? SIGNAL_COLORS.HOLD;
  const pctLabel = percentileLabel(theme.scorePercentile30d);

  return (
    <Link
      href={`/themes/${theme.id}`}
      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700/40 transition-colors group"
    >
      <span className="flex-1 text-sm text-slate-200 truncate group-hover:text-white">
        {theme.name}
      </span>

      {showPercentile && pctLabel != null && (
        <span
          data-testid="percentile-badge"
          className={`text-[9px] font-mono font-semibold w-8 text-right ${percentileColor(theme.scorePercentile30d!)}`}
        >
          {pctLabel}
        </span>
      )}

      {showTrend && trendPct != null && (
        <span className={`text-xs font-mono font-semibold ${isRising ? "text-emerald-400" : "text-red-400"}`}>
          {isRising ? "▲" : "▼"} {Math.abs(Number(trendPct))}%
        </span>
      )}

      {score != null && (
        <span className="text-xs font-mono text-slate-400 w-8 text-right">{score}</span>
      )}

      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${signalClass}`}>
        {theme.dominantSignal}
      </span>
    </Link>
  );
}

export default function ThemeLeaderboard({ themes }: Props) {
  const scoredThemes = themes.filter(t => t.compositeScore != null);
  const trendedThemes = themes.filter(t => t.compositeTrend5d != null);

  const leaders = [...scoredThemes]
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 5);

  const rising = [...trendedThemes]
    .sort((a, b) => (b.compositeTrend5d ?? 0) - (a.compositeTrend5d ?? 0))
    .filter(t => (t.compositeTrend5d ?? 0) > 0)
    .slice(0, 5);

  const falling = [...trendedThemes]
    .sort((a, b) => (a.compositeTrend5d ?? 0) - (b.compositeTrend5d ?? 0))
    .filter(t => (t.compositeTrend5d ?? 0) < 0)
    .slice(0, 5);

  // Value Zone: historically cheap (bottom 40th pct) but recovering (positive 5d trend)
  const valueZone = themes
    .filter(t =>
      t.scorePercentile30d != null &&
      t.scorePercentile30d < 0.40 &&
      (t.compositeTrend5d ?? 0) > 0
    )
    .sort((a, b) => (a.scorePercentile30d ?? 1) - (b.scorePercentile30d ?? 1))
    .slice(0, 4);

  return (
    <div
      data-testid="theme-leaderboard"
      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4"
    >
      <h2 className="text-sm font-semibold text-slate-200 mb-3">Theme Leaderboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
            Top Themes
          </h3>
          <div className="space-y-0.5">
            {leaders.length === 0 ? (
              <p className="text-xs text-slate-500 px-3">No data</p>
            ) : (
              leaders.map(t => <ThemeRow key={t.id} theme={t} showPercentile />)
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 px-3">
            Rising (5d)
          </h3>
          <div className="space-y-0.5">
            {rising.length === 0 ? (
              <p className="text-xs text-slate-500 px-3">No gainers</p>
            ) : (
              rising.map(t => <ThemeRow key={t.id} theme={t} showTrend />)
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 px-3">
            Falling (5d)
          </h3>
          <div className="space-y-0.5">
            {falling.length === 0 ? (
              <p className="text-xs text-slate-500 px-3">No laggards</p>
            ) : (
              falling.map(t => <ThemeRow key={t.id} theme={t} showTrend />)
            )}
          </div>
        </div>

        <div data-testid="value-zone-section">
          <h3
            data-testid="value-zone-heading"
            className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 px-3"
          >
            Value Zone
          </h3>
          <p className="text-[10px] text-slate-500 px-3 mb-1.5">
            Below 40th pct · recovering
          </p>
          <div className="space-y-0.5">
            {valueZone.length === 0 ? (
              <p className="text-xs text-slate-500 px-3">No candidates</p>
            ) : (
              valueZone.map(t => <ThemeRow key={t.id} theme={t} showPercentile />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
