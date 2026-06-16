import Link from "next/link";
import { ThemeSummary, ThemeHistoryPoint } from "@/lib/api";

const SIGNAL_COLOR: Record<string, string> = {
  BUY:    "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  WATCH:  "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  HOLD:   "text-slate-400 bg-slate-700/60 border-slate-600/40",
  REDUCE: "text-red-400 bg-red-500/15 border-red-500/30",
};

const PHASE_MINI: Record<string, { label: string; cls: string }> = {
  BREAKOUT:  { label: "↗ BREAKOUT",  cls: "text-emerald-300 bg-emerald-500/10" },
  MOMENTUM:  { label: "↑ MOMENTUM",  cls: "text-cyan-400 bg-cyan-500/10" },
  SETUP:     { label: "⬆ SETUP",     cls: "text-sky-400 bg-sky-500/10" },
  BUILDING:  { label: "→ BUILDING",  cls: "text-slate-400 bg-slate-700/20" },
  HOLDING:   { label: "■ HOLDING",   cls: "text-slate-500 bg-slate-700/20" },
  FADING:    { label: "↓ FADING",    cls: "text-amber-400 bg-amber-500/10" },
  WEAK:      { label: "↓ WEAK",      cls: "text-red-400 bg-red-500/10" },
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

function ScoreDelta({ history }: { history: ThemeHistoryPoint[] }) {
  if (history.length < 5) return null;
  const deltaPts = Math.round((history[history.length - 1].compositeScore - history[0].compositeScore) * 100);
  if (Math.abs(deltaPts) < 2) return null;
  const isUp = deltaPts > 0;
  return (
    <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${isUp ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
      {isUp ? "↑+" : "↓"}{deltaPts}pt
    </span>
  );
}

function ActionableThemeRow({ theme, history }: ThemeWithHistory) {
  const signalClass = SIGNAL_COLOR[theme.dominantSignal] ?? SIGNAL_COLOR.HOLD;
  const scorePercent = theme.compositeScore != null ? Math.round(theme.compositeScore * 100) : null;
  const phaseMeta = theme.themePhase ? PHASE_MINI[theme.themePhase] : null;

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
          {phaseMeta && (
            <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${phaseMeta.cls}`}>
              {phaseMeta.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scorePercent != null && (
            <span className="text-[10px] font-mono text-slate-400">{scorePercent}/100</span>
          )}
          <ScoreDelta history={history} />
          <span className="text-[10px] text-slate-500">{theme.bullishCount}/{theme.constituentCount} bullish</span>
          <DivergenceBadge divergence={theme.divergenceFromParentSectors} />
        </div>
      </div>
      <MiniSparkline history={history} />
    </Link>
  );
}

const BULLISH_PHASES = new Set(["BREAKOUT", "MOMENTUM", "SETUP", "BUILDING"]);
const BEARISH_PHASES = new Set(["FADING", "WEAK", "DISTRIBUTE"]);

function ThemeConvictionBar({ themes }: { themes: ThemeSummary[] }) {
  const buyCount = themes.filter(t => t.dominantSignal === "BUY").length;
  const watchCount = themes.filter(t => t.dominantSignal === "WATCH").length;
  const bullishPhaseCount = themes.filter(t => t.themePhase && BULLISH_PHASES.has(t.themePhase)).length;
  const bearishPhaseCount = themes.filter(t => t.themePhase && BEARISH_PHASES.has(t.themePhase)).length;
  const total = themes.length;
  if (total === 0) return null;

  const conviction = bullishPhaseCount / total;
  const convictionLabel = conviction >= 0.6 ? "BULLISH" : conviction <= 0.35 ? "BEARISH" : "MIXED";
  const convictionCls = conviction >= 0.6
    ? "text-emerald-400"
    : conviction <= 0.35
    ? "text-red-400"
    : "text-amber-400";

  return (
    <div className="px-4 py-2 border-t border-slate-700/40 flex items-center justify-between text-[10px]">
      <div className="flex items-center gap-3 text-slate-500">
        <span><span className="text-emerald-400 font-mono">{buyCount}</span> BUY</span>
        <span><span className="text-cyan-400 font-mono">{watchCount}</span> WATCH</span>
        <span className="text-slate-600">·</span>
        <span><span className="text-emerald-500 font-mono">{bullishPhaseCount}</span> bullish phases</span>
        {bearishPhaseCount > 0 && (
          <span><span className="text-red-400 font-mono">{bearishPhaseCount}</span> fading</span>
        )}
      </div>
      <span className={`font-semibold tracking-wide ${convictionCls}`}>{convictionLabel}</span>
    </div>
  );
}

function NearEntryRow({ theme }: { theme: ThemeSummary }) {
  const score = theme.compositeScore ?? 0;
  const scorePct = Math.round(score * 100);
  const gapToBuy = Math.round((0.65 - score) * 100);
  const progressWidth = Math.min(100, Math.max(0, Math.round(((score - 0.55) / 0.10) * 100)));
  const trend5d = theme.compositeTrend5d ?? 0;
  const trendLabel = `+${(trend5d * 100).toFixed(1)}pt/d`;
  const daysToEntry = trend5d > 0 ? Math.min(99, Math.ceil((0.65 - score) / trend5d)) : null;
  const phaseMeta = theme.themePhase ? PHASE_MINI[theme.themePhase] : null;

  return (
    <Link
      href={`/themes/${theme.id}`}
      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/30 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] text-slate-300 truncate group-hover:text-white" style={{ fontFamily: "var(--font-rajdhani)" }}>
            {theme.name}
          </span>
          {phaseMeta && (
            <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${phaseMeta.cls}`}>
              {phaseMeta.label}
            </span>
          )}
          <span className="text-[9px] font-mono text-emerald-500/80 bg-emerald-500/10 px-1 py-0.5 rounded ml-auto shrink-0">
            {trendLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative h-1 rounded-full overflow-hidden bg-slate-700" style={{ width: 72 }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-sky-500/60 to-emerald-500/70"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-500">{scorePct}/100</span>
          <span className="text-[9px] text-slate-600">{gapToBuy}pt to BUY</span>
          {daysToEntry != null && daysToEntry <= 30 && (
            <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded">
              ~{daysToEntry}d
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

type Props = {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
};

export default function ThemeSignalWidget({ themes, historiesByThemeId }: Props) {
  const signalThemes = themes
    .filter(t => t.dominantSignal === "BUY" || t.dominantSignal === "WATCH")
    .sort((a, b) => {
      const scoreA = (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
      if (scoreA !== 0) return scoreA;
      return (b.divergenceFromParentSectors ?? 0) - (a.divergenceFromParentSectors ?? 0);
    });

  const actionableThemes = signalThemes.length > 0
    ? signalThemes.slice(0, 4)
    : [...themes]
        .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
        .slice(0, 3);

  const nearEntryThemes = themes
    .filter(t => {
      const score = t.compositeScore ?? 0;
      return (
        score >= 0.55 &&
        score < 0.65 &&
        t.compositeTrend5d != null &&
        t.compositeTrend5d > 0.003 &&
        t.dominantSignal !== "BUY"
      );
    })
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 3);

  if (actionableThemes.length === 0) return null;
  const showingTopByScore = signalThemes.length === 0;

  return (
    <section className="bg-slate-800/50 border border-slate-700/60 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">
            {showingTopByScore ? "Theme Leaders" : "Active Themes"}
          </h2>
          <span className="text-[10px] font-mono text-slate-500">
            {showingTopByScore ? "top by score" : `${actionableThemes.length} signalling`}
          </span>
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
      <ThemeConvictionBar themes={themes} />
      {nearEntryThemes.length > 0 && (
        <div className="border-t border-slate-700/40">
          <div className="px-4 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-sky-500/80">NEAR ENTRY</span>
            <span className="text-[10px] text-slate-600">{nearEntryThemes.length} approaching BUY</span>
          </div>
          <div className="divide-y divide-slate-700/30">
            {nearEntryThemes.map(theme => (
              <NearEntryRow key={theme.id} theme={theme} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
