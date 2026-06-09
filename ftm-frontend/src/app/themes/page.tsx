import Link from "next/link";
import { fetchThemes, fetchThemeHistory, ThemeSummary, ThemeConstituent, ThemeHistoryPoint } from "@/lib/api";

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY:    { label: "BUY",    color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { label: "WATCH",  color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40" },
  REDUCE: { label: "REDUCE", color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30" },
};

function scoreColor(score: number | null): string {
  if (score == null) return "text-slate-500";
  if (score >= 0.65) return "text-emerald-400";
  if (score >= 0.50) return "text-cyan-400";
  if (score >= 0.35) return "text-amber-400";
  return "text-red-400";
}

function ScoreArc({ score }: { score: number | null }) {
  if (score == null) return <div className="text-slate-600 text-xs font-mono text-center">—</div>;
  const pct = Math.round(score * 100);
  const color = score >= 0.65 ? "#34d399" : score >= 0.50 ? "#22d3ee" : score >= 0.35 ? "#fbbf24" : "#f87171";
  const r = 20, cx = 24, cy = 24, circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="11" fontFamily="monospace" fontWeight="600">
          {pct}
        </text>
      </svg>
    </div>
  );
}

function FlowChip({ flow }: { flow: number | null }) {
  if (flow == null) return null;
  const z = flow.toFixed(2);
  const isIn = flow > 0.3;
  const isOut = flow < -0.3;
  const cls = isIn ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
            : isOut ? "bg-red-500/15 text-red-400 border border-red-500/25"
            : "bg-slate-700/60 text-slate-400 border border-slate-600/40";
  const arrow = isIn ? "↑" : isOut ? "↓" : "→";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${cls}`} title={`Avg flow z-score: ${z}σ`}>
      {arrow} {Math.abs(flow) >= 0.1 ? Math.abs(parseFloat(z)).toFixed(1) : "~0"}σ
    </span>
  );
}

function TrendChip({ trend }: { trend: number | null }) {
  if (trend == null) return null;
  const isUp = trend > 0.005;
  const isDown = trend < -0.005;
  const cls = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return (
    <span className={`text-[10px] font-mono ${cls}`} title={`Avg 20d trend: ${trend > 0 ? "+" : ""}${(trend * 100).toFixed(1)}pt`}>
      {arrow}
    </span>
  );
}

function EtfBubble({ c }: { c: ThemeConstituent }) {
  const color = c.compositeScore == null ? "bg-slate-700 text-slate-400"
    : c.compositeScore >= 0.65 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
    : c.compositeScore >= 0.50 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
    : c.compositeScore >= 0.35 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
    : "bg-slate-700 text-slate-400";
  return (
    <span
      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${color}`}
      title={`${c.name} — composite: ${c.compositeScore != null ? Math.round(c.compositeScore * 100) : "—"}`}
    >
      {c.etfTicker}
    </span>
  );
}

function DivergenceChip({ divergence }: { divergence: number | null }) {
  if (divergence == null) return null;
  const pts = Math.round(divergence * 100);
  const isPositive = divergence > 0.02;
  const isNegative = divergence < -0.02;
  const cls = isPositive
    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
    : isNegative
    ? "bg-red-500/15 text-red-400 border border-red-500/25"
    : "bg-slate-700/60 text-slate-400 border border-slate-600/40";
  const arrow = isPositive ? "▲" : isNegative ? "▼" : "≈";
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${cls}`}
      title={`Theme vs parent sectors: ${pts > 0 ? "+" : ""}${pts}pt — positive = theme outpacing sector (rotation signal)`}
    >
      {arrow} {pts > 0 ? "+" : ""}{pts}pt
    </span>
  );
}

function ThemeSparkline({ history }: { history: ThemeHistoryPoint[] }) {
  if (history.length < 2) return null;
  const values = history.map(h => h.compositeScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const width = 72, height = 20;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = range > 0 ? height - ((v - min) / range) * (height - 2) - 1 : height / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const latest = values[values.length - 1];
  const stroke = latest >= 0.65 ? "#34d399" : latest >= 0.50 ? "#22d3ee" : latest >= 0.35 ? "#fbbf24" : "#f87171";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="opacity-70 shrink-0"
    >
      <title>{`30-day trend · latest: ${Math.round(latest * 100)}`}</title>
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

function BullishBar({ bullish, total }: { bullish: number; total: number }) {
  const pct = total > 0 ? bullish / total : 0;
  const color = pct >= 0.6 ? "bg-emerald-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <span className="text-[10px] font-mono text-slate-400">{bullish}/{total}</span>
    </div>
  );
}

function ThemeCard({ theme, history }: { theme: ThemeSummary; history: ThemeHistoryPoint[] }) {
  const signal = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;

  return (
    <Link href={`/themes/${theme.id}`} className="block group">
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-4 hover:border-slate-500/80 hover:bg-slate-800 transition-all duration-150 group-hover:shadow-lg group-hover:shadow-black/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight mb-1 truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
              {theme.name}
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">{theme.thesis}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <ScoreArc score={theme.compositeScore} />
            <ThemeSparkline history={history} />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${signal.bg} ${signal.color}`}>
            {signal.label}
          </span>
          <FlowChip flow={theme.flow20d} />
          <TrendChip trend={theme.compositeTrend20d} />
          <DivergenceChip divergence={theme.divergenceFromParentSectors} />
          {theme.rs60 != null && (
            <span
              className={`text-[10px] font-mono ${scoreColor(theme.rs60 > 0 ? 0.65 : 0.3)}`}
              title={`Avg RS-60: ${theme.rs60 > 0 ? "+" : ""}${(theme.rs60 * 100).toFixed(1)}%`}
            >
              RS {theme.rs60 > 0 ? "+" : ""}{(theme.rs60 * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <BullishBar bullish={theme.bullishCount} total={theme.constituentCount} />

        <div className="flex flex-wrap gap-1 mt-2.5">
          {theme.topConstituents.map(c => <EtfBubble key={c.categoryId} c={c} />)}
          {theme.constituentCount > theme.topConstituents.length && (
            <span className="text-[9px] font-mono text-slate-600">
              +{theme.constituentCount - theme.topConstituents.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function DualSparkline({
  leaderHistory,
  laggerHistory,
}: {
  leaderHistory: ThemeHistoryPoint[];
  laggerHistory: ThemeHistoryPoint[];
}) {
  if (leaderHistory.length < 2 || laggerHistory.length < 2) return null;
  const W = 96, H = 28;

  const allVals = [...leaderHistory.map(h => h.compositeScore), ...laggerHistory.map(h => h.compositeScore)];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 0.01;

  const toPoints = (hist: ThemeHistoryPoint[]) =>
    hist.map((h, i) => {
      const x = (i / (hist.length - 1)) * W;
      const y = H - ((h.compositeScore - minV) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80 shrink-0">
      <polyline points={toPoints(laggerHistory)} fill="none" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
      <polyline points={toPoints(leaderHistory)} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ActiveRotationBanner({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const scored = themes.filter(t => t.compositeScore != null);
  if (scored.length < 2) return null;

  // Prefer a pair where one is rising and the other falling (confirmed rotation)
  const rising = scored.filter(t => (t.compositeTrend20d ?? 0) > 0.002);
  const falling = scored.filter(t => (t.compositeTrend20d ?? 0) < -0.002);

  let leader = scored[0];
  let lagger = scored[scored.length - 1];
  let isRotating = false;

  if (rising.length > 0 && falling.length > 0) {
    // Find the rising+falling pair with the largest composite divergence
    let maxDiv = -1;
    for (const r of rising) {
      for (const f of falling) {
        const div = (r.compositeScore ?? 0) - (f.compositeScore ?? 0);
        if (div > maxDiv) { maxDiv = div; leader = r; lagger = f; }
      }
    }
    isRotating = true;
  } else {
    // No confirmed rotation — just show the widest absolute gap
    const byScore = [...scored].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
    leader = byScore[0];
    lagger = byScore[byScore.length - 1];
  }

  const divergence = (leader.compositeScore ?? 0) - (lagger.compositeScore ?? 0);
  if (divergence < 0.12) return null;

  return (
    <div className={`rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between gap-4 ${
      isRotating
        ? "bg-emerald-900/20 border border-emerald-700/40"
        : "bg-slate-800/50 border border-slate-700/60"
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
          Rotation
        </span>
        <Link href={`/themes/${leader.id}`} className="text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 truncate">
          {leader.name}
        </Link>
        <span className="text-[10px] text-slate-500 shrink-0">
          {isRotating ? "outpacing" : "ahead of"}
        </span>
        <Link href={`/themes/${lagger.id}`} className="text-[12px] font-medium text-red-400 hover:text-red-300 truncate">
          {lagger.name}
        </Link>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <DualSparkline
          leaderHistory={historiesByThemeId[leader.id] ?? []}
          laggerHistory={historiesByThemeId[lagger.id] ?? []}
        />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] font-bold font-mono text-white">
            +{Math.round(divergence * 100)}pt
          </span>
          {isRotating && (
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              rotating ↑↓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RotationMomentumStrip({ themes }: { themes: ThemeSummary[] }) {
  const withVelocity = themes.filter(t => t.compositeTrend20d != null);
  if (withVelocity.length < 2) return null;

  const sorted = [...withVelocity].sort(
    (a, b) => (b.compositeTrend20d ?? 0) - (a.compositeTrend20d ?? 0)
  );
  const rising = sorted.filter(t => (t.compositeTrend20d ?? 0) > 0.003).slice(0, 3);
  const falling = sorted.filter(t => (t.compositeTrend20d ?? 0) < -0.003).reverse().slice(0, 3);

  if (rising.length === 0 && falling.length === 0) return null;

  const velLabel = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}pt`;

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-3 mb-4">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
        Rotation Momentum · 20-day velocity
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rising.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-emerald-400 mb-1.5">↑ Accelerating</div>
            <div className="space-y-1">
              {rising.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <Link href={`/themes/${t.id}`} className="text-[11px] text-slate-300 hover:text-white truncate">
                    {t.name}
                  </Link>
                  <span className="text-[10px] font-mono text-emerald-400 ml-2 shrink-0">
                    {velLabel(t.compositeTrend20d!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {falling.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-red-400 mb-1.5">↓ Decelerating</div>
            <div className="space-y-1">
              {falling.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <Link href={`/themes/${t.id}`} className="text-[11px] text-slate-300 hover:text-white truncate">
                    {t.name}
                  </Link>
                  <span className="text-[10px] font-mono text-red-400 ml-2 shrink-0">
                    {velLabel(t.compositeTrend20d!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ThemesPage() {
  const themes = await fetchThemes();

  const historyResults = await Promise.allSettled(
    themes.map(t => fetchThemeHistory(t.id, 30))
  );
  const historyByThemeId: Record<string, ThemeHistoryPoint[]> = {};
  themes.forEach((t, i) => {
    const result = historyResults[i];
    historyByThemeId[t.id] = result.status === "fulfilled" ? result.value : [];
  });

  const buyThemes = themes.filter(t => t.dominantSignal === "BUY").length;
  const watchThemes = themes.filter(t => t.dominantSignal === "WATCH").length;
  const activeThemes = themes.filter(t => t.dominantSignal === "BUY" || t.dominantSignal === "WATCH").length;

  const sortedByScore = [...themes].sort(
    (a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1)
  );

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Investment Themes
          </h1>
          <p className="text-slate-400 text-sm">
            Cross-sector capital flow narratives — each theme aggregates signals across constituent ETFs to surface conviction before the mainstream narrative. Sparklines show 30-day composite trend.
          </p>
          {themes.length > 0 && (
            <div className="flex gap-3 mt-2">
              {buyThemes > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {buyThemes} BUY
                </span>
              )}
              {watchThemes > 0 && (
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                  {watchThemes} WATCH
                </span>
              )}
              {activeThemes === 0 && (
                <span className="text-[11px] font-mono text-slate-500">No active signals</span>
              )}
              <span className="text-[11px] font-mono text-slate-600">
                {themes.length} themes · {themes.reduce((a, t) => a + t.constituentCount, 0)} ETFs tracked
              </span>
            </div>
          )}
        </div>

        {themes.length > 0 && <ActiveRotationBanner themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <RotationMomentumStrip themes={themes} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedByScore.map(theme => (
            <ThemeCard key={theme.id} theme={theme} history={historyByThemeId[theme.id] ?? []} />
          ))}
        </div>

        {themes.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-12">
            No themes available — run ingestion to populate signals.
          </div>
        )}
      </div>
    </main>
  );
}
