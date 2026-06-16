import Link from "next/link";
import { fetchThemes, fetchThemeHistory, fetchAlerts, fetchRecentAlerts, AlertDto, ThemeSummary, ThemeConstituent, ThemeHistoryPoint } from "@/lib/api";
import ThemeAlertRiskMap from "@/components/ThemeAlertRiskMap";
import { SECTOR_SHORT_NAMES, getParentSectorId } from "@/lib/sectors";

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

function ScoreDeltaBadge({ history }: { history: ThemeHistoryPoint[] }) {
  if (history.length < 5) return null;
  const first = history[0].compositeScore;
  const last = history[history.length - 1].compositeScore;
  const deltaPts = Math.round((last - first) * 100);
  if (Math.abs(deltaPts) < 2) return null;
  const isUp = deltaPts > 0;
  return (
    <span
      className={`text-[9px] font-mono px-1 py-0.5 rounded ${isUp ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}
      title={`30-day score change: ${isUp ? "+" : ""}${deltaPts}pt`}
    >
      {isUp ? "↑" : "↓"}{isUp ? "+" : ""}{deltaPts}pt
    </span>
  );
}

const PHASE_CONFIG: Record<string, { label: string; className: string; priority: number }> = {
  BREAKOUT: { label: "↗ BREAKOUT", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30", priority: 1 },
  MOMENTUM: { label: "↑ MOMENTUM", className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",         priority: 2 },
  SETUP:    { label: "⬆ SETUP",    className: "bg-sky-500/15 text-sky-400 border border-sky-500/25",             priority: 3 },
  BUILDING: { label: "→ BUILDING", className: "bg-slate-700/60 text-slate-400 border border-slate-600/40",       priority: 4 },
  HOLDING:  { label: "■ HOLDING",  className: "bg-slate-700/40 text-slate-500 border border-slate-700/40",       priority: 5 },
  FADING:   { label: "↓ FADING",   className: "bg-amber-500/15 text-amber-400 border border-amber-500/25",       priority: 6 },
  DISTRIBUTE: { label: "↘ DIST",   className: "bg-orange-500/15 text-orange-400 border border-orange-500/25",    priority: 7 },
  WEAK:     { label: "↓ WEAK",     className: "bg-red-500/15 text-red-400 border border-red-500/25",             priority: 8 },
};

function ThemePhaseBadge({ phase }: { phase: string | null }) {
  if (!phase) return null;
  const cfg = PHASE_CONFIG[phase];
  if (!cfg) return null;
  return (
    <span
      className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${cfg.className}`}
      title={`Theme lifecycle phase: ${phase}`}
    >
      {cfg.label}
    </span>
  );
}

function scoreTier(score: number | null): string {
  if (score == null) return "HOLD";
  if (score >= 0.65) return "BUY";
  if (score >= 0.50) return "WATCH";
  if (score >= 0.35) return "HOLD";
  return "REDUCE";
}

function signalAgeDays(history: ThemeHistoryPoint[], dominantSignal: string): number {
  if (history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (scoreTier(history[i].compositeScore) === dominantSignal) count++;
    else break;
  }
  return count;
}

function phaseFromHistory(score: number, trend5d: number | null, trend20d: number | null): string {
  if (trend5d == null || trend20d == null) return "NEUTRAL";
  const accelerating = (trend5d - trend20d) > 0.005;
  const trending = trend20d > 0.003;
  const fading = trend20d < -0.003;
  if (score >= 0.65) {
    if (accelerating) return "BREAKOUT";
    if (trending) return "MOMENTUM";
    return "HOLDING";
  }
  if (score >= 0.50) {
    if (accelerating) return "SETUP";
    if (fading) return "FADING";
    return "BUILDING";
  }
  if (fading) return "FADING";
  if (score < 0.35) return "WEAK";
  return "NEUTRAL";
}

function phaseAgeDays(history: ThemeHistoryPoint[], currentPhase: string | null): number {
  if (!currentPhase || history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (phaseFromHistory(h.compositeScore, h.trend5d, h.trend20d) === currentPhase) count++;
    else break;
  }
  return count;
}

function SignalFreshnessBadge({
  history,
  signal,
}: {
  history: ThemeHistoryPoint[];
  signal: string;
}) {
  const days = signalAgeDays(history, signal);
  if (days === 0 || days > 10) return null;
  if (days <= 3) {
    return (
      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 animate-pulse"
        title={`Entered ${signal} ${days}d ago — fresh signal`}
      >
        NEW {days}d
      </span>
    );
  }
  return (
    <span
      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 border border-slate-700/40"
      title={`In ${signal} for ${days} days`}
    >
      {days}d
    </span>
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
          <ThemePhaseBadge phase={theme.themePhase} />
          <SignalFreshnessBadge history={history} signal={theme.dominantSignal} />
          <ScoreDeltaBadge history={history} />
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

const RULE_LABELS: Record<string, string> = {
  theme_5d_acceleration:            "5d Accel",
  theme_dominant_signal_transition: "Signal Shift",
  theme_momentum_surge:             "Mom. Surge",
  theme_momentum_collapse:          "Mom. Collapse",
  theme_distribute_warning:         "Distribution",
  theme_phase_breakout_entry:       "Breakout Entry",
  theme_setup_acceleration:         "Pre-Breakout",
  theme_failed_breakout:            "Failed Breakout",
  theme_phase_fading:               "Phase Fading",
  theme_momentum_exhaustion:        "Momentum Exhaustion",
  theme_recovery_signal:            "Recovery Signal",
  theme_strong_breakout_confirmation: "Strong Breakout",
  pre_buy_flow_surge:               "Pre-Buy Flow",
};

const SEVERITY_CONFIG: Record<string, { badge: string; dot: string }> = {
  ACTION:  { badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25", dot: "bg-emerald-400" },
  WARNING: { badge: "bg-amber-500/15 text-amber-400 border border-amber-500/25",      dot: "bg-amber-400"   },
  URGENT:  { badge: "bg-red-500/15 text-red-400 border border-red-500/25",            dot: "bg-red-400"     },
  INFO:    { badge: "bg-slate-700/60 text-slate-400 border border-slate-600/40",      dot: "bg-slate-500"   },
};

function ThemeEventsFeed({ events }: { events: AlertDto[] }) {
  if (events.length === 0) return null;

  const STATUS_STYLE = {
    ACTIVE:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
    RESOLVED:     "text-slate-500 bg-slate-800/40 border-slate-700/30",
    ACKNOWLEDGED: "text-slate-600 bg-slate-800/30 border-slate-700/20",
  };
  const STATUS_LABEL = { ACTIVE: "active", RESOLVED: "resolved", ACKNOWLEDGED: "ack" };

  return (
    <div className="mb-5 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Event Log</span>
        <span className="text-[10px] font-mono text-slate-600">{events.length} recent</span>
      </div>
      <div className="divide-y divide-slate-700/20 max-h-64 overflow-y-auto">
        {events.map(e => {
          const subject = e.themeId ?? e.categoryId ?? "—";
          const ruleLabel = RULE_LABELS[e.ruleId] ?? e.ruleId;
          const ts = new Date(e.createdAt);
          const timeStr = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            + " " + ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const severityStyle = SEVERITY_CONFIG[e.severity] ?? SEVERITY_CONFIG.INFO;
          const statusStyle = STATUS_STYLE[e.status] ?? STATUS_STYLE.ACKNOWLEDGED;
          return (
            <div key={e.id} className={`flex items-start gap-2 px-4 py-2 text-[11px] ${e.status !== "ACTIVE" ? "opacity-50" : ""}`}>
              <span className="font-mono text-slate-600 shrink-0 w-24 pt-0.5">{timeStr}</span>
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${severityStyle.dot}`} />
              <span className="font-mono font-semibold text-slate-300 shrink-0 w-28 truncate pt-0.5">
                {e.themeId ? (
                  <Link href={`/themes/${e.themeId}`} className="hover:text-cyan-400 transition-colors">{subject}</Link>
                ) : subject}
              </span>
              <span className="text-slate-500 shrink-0 pt-0.5">{ruleLabel}</span>
              <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-mono ${statusStyle}`}>
                {STATUS_LABEL[e.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemeAlertFeed({
  alerts,
  themes,
}: {
  alerts: AlertDto[];
  themes: ThemeSummary[];
}) {
  const themeAlerts = alerts
    .filter(a => a.themeId != null && a.status === "ACTIVE")
    .slice(0, 5);
  if (themeAlerts.length === 0) return null;

  const themeNameById = Object.fromEntries(themes.map(t => [t.id, t.name]));

  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active Theme Alerts</span>
        </div>
        <Link href="/alerts" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
          all alerts →
        </Link>
      </div>
      <div className="divide-y divide-slate-800/60">
        {themeAlerts.map(alert => {
          const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
          const ruleLabel = RULE_LABELS[alert.ruleId] ?? alert.ruleId;
          const themeName = alert.themeId ? (themeNameById[alert.themeId] ?? alert.themeId) : null;
          return (
            <div key={alert.id} className="px-3 py-2 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
              <span className={`mt-0.5 w-1 h-1 rounded-full shrink-0 ${sev.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sev.badge}`}>{alert.severity}</span>
                  <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">{ruleLabel}</span>
                  {themeName && alert.themeId && (
                    <Link
                      href={`/themes/${alert.themeId}`}
                      className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors truncate"
                    >
                      {themeName}
                    </Link>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-1">{alert.message}</p>
              </div>
              <span className="text-[9px] font-mono text-slate-700 shrink-0 mt-0.5">
                {new Date(alert.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemePlaybook({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  type PlaybookEntry = {
    theme: ThemeSummary;
    action: string;
    note: string;
    actionCls: string;
    priority: number;
  };

  const entries: PlaybookEntry[] = [];

  for (const t of themes) {
    if (t.compositeScore == null) continue;
    const score = t.compositeScore;
    const hist = historiesByThemeId[t.id] ?? [];
    const accel = t.compositeTrend5d != null && t.compositeTrend20d != null
      ? t.compositeTrend5d - t.compositeTrend20d : null;
    const delta5d = hist.length >= 6
      ? Math.round((hist[hist.length - 1].compositeScore - hist[hist.length - 6].compositeScore) * 100)
      : null;
    const phase = t.themePhase ?? "";
    const signal = t.dominantSignal;

    if (signal === "BUY" && phase === "BREAKOUT") {
      entries.push({
        theme: t, priority: 1,
        action: "ENTER",
        actionCls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
        note: `Breakout phase: score ${Math.round(score * 100)}, momentum accelerating${accel != null && accel > 0 ? ` (+${Math.round(accel * 100)}pt acceleration)` : ""}. Primary entry zone — add on pullbacks to mid-60s.`,
      });
    } else if (signal === "BUY" && phase === "MOMENTUM") {
      entries.push({
        theme: t, priority: 2,
        action: "HOLD",
        actionCls: "text-cyan-300 bg-cyan-500/15 border-cyan-500/25",
        note: `Momentum phase: score ${Math.round(score * 100)}, trend sustained. Hold existing positions — add only on confirmed dips.`,
      });
    } else if (signal === "BUY" && (phase === "HOLDING" || phase === "FADING")) {
      entries.push({
        theme: t, priority: 3,
        action: "WATCH",
        actionCls: "text-amber-300 bg-amber-500/15 border-amber-500/25",
        note: `${phase} phase: score ${Math.round(score * 100)}${delta5d != null && delta5d < 0 ? `, -${Math.abs(delta5d)}pt in 5d` : ""}. Monitor closely — momentum waning, tighten stops.`,
      });
    } else if (signal === "WATCH" && (phase === "SETUP" || phase === "BUILDING")) {
      entries.push({
        theme: t, priority: 4,
        action: "PREPARE",
        actionCls: "text-sky-300 bg-sky-500/15 border-sky-500/25",
        note: `${phase} phase: score ${Math.round(score * 100)}${delta5d != null && delta5d > 0 ? `, +${delta5d}pt in 5d` : ""}. Approaching BUY zone — build watchlist, set ${Math.round((0.65 - score) * 100)}pt alert.`,
      });
    } else if (signal === "REDUCE" || (signal === "HOLD" && phase === "WEAK")) {
      entries.push({
        theme: t, priority: 5,
        action: "REDUCE",
        actionCls: "text-red-300 bg-red-500/15 border-red-500/25",
        note: `Score ${Math.round(score * 100)} in ${phase || "WEAK"} territory. Exit remaining positions, avoid new entries.`,
      });
    }
  }

  if (entries.length === 0) return null;
  entries.sort((a, b) => a.priority - b.priority);

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Theme Playbook</span>
        <span className="text-[10px] text-slate-600 font-mono">action-oriented guidance per theme</span>
      </div>
      <div className="divide-y divide-slate-700/20">
        {entries.map(({ theme: t, action, note, actionCls }) => (
          <div key={t.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`shrink-0 mt-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border w-14 text-center ${actionCls}`}>
              {action}
            </span>
            <Link href={`/themes/${t.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors shrink-0 w-36 pt-0.5 truncate">
              {t.name}
            </Link>
            <span className="text-[10px] text-slate-400 leading-relaxed">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreBuySetupPanel({ themes }: { themes: ThemeSummary[] }) {
  const setups = themes.filter(
    t =>
      t.compositeScore != null &&
      t.compositeScore >= 0.50 &&
      t.compositeScore < 0.65 &&
      t.dominantSignal !== "BUY" &&
      t.compositeTrend5d != null &&
      t.compositeTrend20d != null &&
      t.compositeTrend5d > t.compositeTrend20d
  );
  if (setups.length === 0) return null;

  return (
    <div className="bg-cyan-900/10 border border-cyan-700/30 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Pre-Buy Setups</span>
        <span className="text-[10px] font-mono text-cyan-600">— approaching BUY, momentum accelerating</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {setups.map(t => {
          const score = Math.round((t.compositeScore ?? 0) * 100);
          const delta = ((t.compositeTrend5d ?? 0) - (t.compositeTrend20d ?? 0)) * 100;
          return (
            <Link
              key={t.id}
              href={`/themes/${t.id}`}
              className="flex items-center gap-1.5 bg-slate-800/60 border border-cyan-700/30 rounded px-2 py-1 hover:border-cyan-500/50 hover:bg-slate-800 transition-all"
            >
              <span className="text-[10px] font-semibold text-slate-200">{t.name}</span>
              <span className="text-[10px] font-mono text-cyan-400">{score}</span>
              <span className="text-[9px] font-mono text-emerald-400" title={`5d accelerating +${delta.toFixed(1)}pt vs 20d`}>
                ⬆+{delta.toFixed(1)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type OpportunityEntry = {
  theme: ThemeSummary;
  action: string;
  reason: string;
  priority: "HIGH" | "MED" | "LOW";
  actionColor: string;
};

function ThemeTippingPoints({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const BUY_ZONE = 0.65;
  const HOLD_ZONE = 0.50;

  const approaching: { theme: ThemeSummary; score: number; delta5d: number | null; gap: number }[] = [];
  const atRisk: { theme: ThemeSummary; score: number; delta5d: number | null; margin: number }[] = [];
  const recovering: { theme: ThemeSummary; score: number; delta5d: number | null; gap: number }[] = [];

  for (const t of themes) {
    if (t.compositeScore == null) continue;
    const hist = historiesByThemeId[t.id] ?? [];
    const delta5d = hist.length >= 6
      ? (hist[hist.length - 1].compositeScore - hist[hist.length - 6].compositeScore)
      : null;

    const score = t.compositeScore;
    if (score >= 0.58 && score < BUY_ZONE && (delta5d == null || delta5d >= -0.02)) {
      approaching.push({ theme: t, score, delta5d, gap: BUY_ZONE - score });
    } else if (score >= BUY_ZONE && score <= 0.72 && delta5d != null && delta5d < -0.02) {
      atRisk.push({ theme: t, score, delta5d, margin: score - BUY_ZONE });
    } else if (score >= 0.38 && score < HOLD_ZONE && delta5d != null && delta5d > 0.01) {
      recovering.push({ theme: t, score, delta5d, gap: HOLD_ZONE - score });
    }
  }

  approaching.sort((a, b) => a.gap - b.gap);
  atRisk.sort((a, b) => a.margin - b.margin);
  recovering.sort((a, b) => b.delta5d! - a.delta5d!);

  if (approaching.length === 0 && atRisk.length === 0 && recovering.length === 0) return null;

  const renderRow = (
    t: ThemeSummary,
    score: number,
    delta5d: number | null,
    tag: string,
    tagCls: string,
    note: string,
  ) => {
    const pct = Math.round(score * 100);
    const barClr = score >= BUY_ZONE ? "bg-emerald-500" : score >= HOLD_ZONE ? "bg-cyan-500" : "bg-amber-500";
    return (
      <div key={t.id} className="flex items-center gap-3 px-4 py-2 border-t border-slate-700/20 first:border-t-0">
        <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${tagCls}`}>{tag}</span>
        <Link href={`/themes/${t.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors w-40 truncate shrink-0">
          {t.name}
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barClr}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-slate-300">{pct}</span>
        </div>
        {delta5d != null && (
          <span className={`text-[10px] font-mono tabular-nums shrink-0 ${delta5d > 0 ? "text-emerald-400" : delta5d < 0 ? "text-red-400" : "text-slate-500"}`}>
            {delta5d > 0 ? "+" : ""}{Math.round(delta5d * 100)}pt
          </span>
        )}
        <span className="text-[10px] text-slate-500 truncate">{note}</span>
      </div>
    );
  };

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Tipping Points</span>
        <span className="text-[10px] text-slate-600 font-mono">themes at key signal thresholds</span>
      </div>
      <div className="divide-y divide-slate-700/10">
        {approaching.slice(0, 3).map(({ theme: t, score, delta5d, gap }) =>
          renderRow(t, score, delta5d, "ENTRY", "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            `${Math.round(gap * 100)}pt below BUY — ${delta5d != null && delta5d > 0 ? "rising" : "watch for breakout"}`)
        )}
        {atRisk.slice(0, 3).map(({ theme: t, score, delta5d, margin }) =>
          renderRow(t, score, delta5d, "AT RISK", "text-amber-400 bg-amber-500/10 border-amber-500/20",
            `${Math.round(margin * 100)}pt above BUY floor — momentum fading`)
        )}
        {recovering.slice(0, 2).map(({ theme: t, score, delta5d, gap }) =>
          renderRow(t, score, delta5d, "RECOVERY", "text-sky-400 bg-sky-500/10 border-sky-500/20",
            `${Math.round(gap * 100)}pt below HOLD — momentum turning`)
        )}
      </div>
    </div>
  );
}

function TopOpportunitiesPanel({ themes }: { themes: ThemeSummary[] }) {
  const opportunities: OpportunityEntry[] = [];

  for (const t of themes) {
    const score = t.compositeScore ?? 0;
    const accel = (t.compositeTrend5d ?? 0) - (t.compositeTrend20d ?? 0);
    const phase = t.themePhase;

    if (phase === "BREAKOUT" && t.dominantSignal === "BUY") {
      opportunities.push({
        theme: t,
        action: "ENTER / ADD",
        reason: `BREAKOUT · score ${Math.round(score * 100)} · accel +${(accel * 100).toFixed(1)}pt`,
        priority: "HIGH",
        actionColor: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
      });
    } else if (phase === "SETUP" && score >= 0.55 && accel > 0.003) {
      const ptsNeeded = Math.round((0.65 - score) * 100);
      opportunities.push({
        theme: t,
        action: "ACCUMULATE",
        reason: `SETUP · ${ptsNeeded}pt from BUY · momentum accelerating`,
        priority: "MED",
        actionColor: "text-sky-300 bg-sky-500/15 border-sky-500/30",
      });
    } else if (phase === "DISTRIBUTE" && t.dominantSignal === "BUY") {
      opportunities.push({
        theme: t,
        action: "TRIM / EXIT",
        reason: `DISTRIBUTING · score ${Math.round(score * 100)} but flow ${(t.flow20d ?? 0).toFixed(1)}σ`,
        priority: "HIGH",
        actionColor: "text-orange-300 bg-orange-500/15 border-orange-500/30",
      });
    } else if (phase === "FADING" && t.dominantSignal !== "REDUCE") {
      opportunities.push({
        theme: t,
        action: "REDUCE",
        reason: `FADING · trend turning negative · avoid new entries`,
        priority: "MED",
        actionColor: "text-amber-300 bg-amber-500/15 border-amber-500/30",
      });
    }
  }

  if (opportunities.length === 0) return null;

  const sorted = [
    ...opportunities.filter(o => o.priority === "HIGH"),
    ...opportunities.filter(o => o.priority === "MED"),
  ].slice(0, 5);

  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-lg overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-2">
        <span className="text-[10px] font-mono text-white uppercase tracking-wider">Trade Opportunities</span>
        <span className="text-[10px] font-mono text-slate-600">· phase-based signals</span>
        <span className="ml-auto text-[9px] font-mono text-slate-700">{sorted.length} active</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {sorted.map(o => (
          <div key={o.theme.id} className="px-3 py-2 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${o.actionColor}`}>
              {o.action}
            </span>
            <Link href={`/themes/${o.theme.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors truncate">
              {o.theme.name}
            </Link>
            <span className="text-[9px] font-mono text-slate-500 ml-auto shrink-0 hidden sm:block">
              {o.reason}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemeNarrative({ themes }: { themes: ThemeSummary[] }) {
  if (themes.length === 0) return null;

  const buy = themes.filter(t => t.dominantSignal === "BUY");
  const watch = themes.filter(t => t.dominantSignal === "WATCH");
  const reduce = themes.filter(t => t.dominantSignal === "REDUCE");

  const sorted = [...themes].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const topTheme = sorted[0];
  const bottomTheme = sorted[sorted.length - 1];

  const rising = themes
    .filter(t => (t.compositeTrend20d ?? 0) > 0.005)
    .sort((a, b) => (b.compositeTrend20d ?? 0) - (a.compositeTrend20d ?? 0));
  const falling = themes
    .filter(t => (t.compositeTrend20d ?? 0) < -0.005)
    .sort((a, b) => (a.compositeTrend20d ?? 0) - (b.compositeTrend20d ?? 0));

  const sentences: string[] = [];

  if (buy.length > 0) {
    const names = buy.map(t => t.name).join(", ");
    sentences.push(`${buy.length === 1 ? buy[0].name : `${buy.length} themes (${names})`} ${buy.length === 1 ? "is" : "are"} in full BUY.`);
  }
  if (watch.length > 0) {
    sentences.push(`${watch.map(t => t.name).join(", ")} ${watch.length === 1 ? "is" : "are"} building toward BUY.`);
  }
  if (reduce.length > 0) {
    sentences.push(`${reduce.map(t => t.name).join(", ")} ${reduce.length === 1 ? "is" : "are"} in REDUCE.`);
  }
  if (rising.length > 0 && falling.length > 0) {
    sentences.push(`${rising[0].name} is the fastest accelerating (+${Math.round((rising[0].compositeTrend20d ?? 0) * 1000)}‰/day); ${falling[0].name} is decelerating fastest.`);
  } else if (rising.length > 0) {
    sentences.push(`${rising[0].name} is the strongest momentum play right now.`);
  }
  if (topTheme && bottomTheme && topTheme.id !== bottomTheme.id) {
    const spread = Math.round(((topTheme.compositeScore ?? 0) - (bottomTheme.compositeScore ?? 0)) * 100);
    if (spread > 15) {
      sentences.push(`${spread}pt spread between ${topTheme.name} and ${bottomTheme.name} — widest divergence in the current cohort.`);
    }
  }

  if (sentences.length === 0) return null;

  return (
    <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg px-4 py-3 mb-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Market Narrative</div>
      <p className="text-slate-300 text-xs leading-relaxed">{sentences.join(" ")}</p>
    </div>
  );
}

function ThemeRelativeStrengthPlot({ themes }: { themes: ThemeSummary[] }) {
  const plotThemes = themes.filter(
    t => t.divergenceFromParentSectors != null && t.compositeTrend20d != null
  );
  if (plotThemes.length < 2) return null;

  const W = 420, H = 140;
  const padX = 40, padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const divValues = plotThemes.map(t => t.divergenceFromParentSectors!);
  const velValues = plotThemes.map(t => t.compositeTrend20d!);
  const maxAbsDiv = Math.max(0.12, ...divValues.map(Math.abs)) * 1.15;
  const maxAbsVel = Math.max(0.008, ...velValues.map(Math.abs)) * 1.15;

  const toX = (div: number) => padX + ((div + maxAbsDiv) / (2 * maxAbsDiv)) * chartW;
  const toY = (vel: number) => padY + ((maxAbsVel - vel) / (2 * maxAbsVel)) * chartH;
  const midX = toX(0);
  const midY = toY(0);

  const FILL: Record<string, string> = {
    BUY:    "#34d39990",
    WATCH:  "#22d3ee90",
    HOLD:   "#64748b80",
    REDUCE: "#f8717190",
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">theme positioning · divergence vs velocity</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          <span>← lagging sectors</span>
          <span>leading sectors →</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Quadrant backgrounds */}
        <rect x={midX} y={padY} width={padX + chartW - midX} height={midY - padY} fill="#34d39905" />
        <rect x={padX} y={midY} width={midX - padX} height={padY + chartH - midY} fill="#f8717105" />
        {/* Axes */}
        <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="#334155" strokeWidth="1" />
        <line x1={midX} y1={padY} x2={midX} y2={H - padY} stroke="#334155" strokeWidth="1" />
        {/* Axis labels */}
        <text x={padX} y={midY - 3} fill="#475569" fontSize="7" fontFamily="monospace">velocity</text>
        <text x={W - padX - 2} y={midY + 10} fill="#475569" fontSize="7" textAnchor="end" fontFamily="monospace">vs sectors</text>
        {/* Dots */}
        {plotThemes.map(t => {
          const cx = toX(t.divergenceFromParentSectors!);
          const cy = toY(t.compositeTrend20d!);
          const fill = FILL[t.dominantSignal] ?? FILL.HOLD;
          const scorePct = t.compositeScore != null ? t.compositeScore : 0.5;
          const r = 4 + scorePct * 5;
          const label = themeShortLabel(t);
          const labelRight = cx > W * 0.7;
          return (
            <g key={t.id}>
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={fill.slice(0, 7)} strokeWidth="1" strokeOpacity="0.8" />
              <text
                x={labelRight ? cx - r - 2 : cx + r + 2}
                y={cy + 3}
                fill="#94a3b8"
                fontSize="7"
                textAnchor={labelRight ? "end" : "start"}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
        {/* Quadrant corner labels */}
        <text x={W - padX - 2} y={padY + 10} fill="#34d39930" fontSize="6" textAnchor="end" fontFamily="monospace">LEADING ↑</text>
        <text x={padX + 2} y={H - padY - 3} fill="#f8717130" fontSize="6" fontFamily="monospace">LAGGING ↓</text>
      </svg>
    </div>
  );
}

const SIGNAL_STROKE: Record<string, string> = {
  BUY:    "#34d399",
  WATCH:  "#22d3ee",
  HOLD:   "#64748b",
  REDUCE: "#f87171",
};

function ThemePositioningMatrix({ themes }: { themes: ThemeSummary[] }) {
  const plotThemes = themes.filter(
    t => t.compositeScore != null && t.flow20d != null
  );
  if (plotThemes.length < 2) return null;

  const W = 420, H = 160;
  const padX = 36, padY = 18;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const maxAbsFlow = Math.max(2.0, ...plotThemes.map(t => Math.abs(t.flow20d!))) * 1.1;
  const minScore = Math.max(0, Math.min(...plotThemes.map(t => t.compositeScore!)) - 0.08);
  const maxScore = Math.min(1, Math.max(...plotThemes.map(t => t.compositeScore!)) + 0.08);
  const scoreRange = maxScore - minScore || 0.5;

  const toX = (score: number) => padX + ((score - minScore) / scoreRange) * chartW;
  const toY = (flow: number) => padY + ((maxAbsFlow - flow) / (2 * maxAbsFlow)) * chartH;

  const midY = toY(0);
  const buyX = toX(0.65);

  const FILL: Record<string, string> = {
    BUY:    "#34d39990",
    WATCH:  "#22d3ee90",
    HOLD:   "#64748b80",
    REDUCE: "#f8717190",
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">positioning matrix · score vs flow</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          <span>score →</span>
          <span>flow ↕</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Quadrant fills */}
        <rect x={buyX} y={padY} width={W - padX - buyX} height={midY - padY} fill="#34d39904" />
        <rect x={buyX} y={midY} width={W - padX - buyX} height={padY + chartH - midY} fill="#f8717103" />
        {/* BUY threshold line */}
        <line x1={buyX} y1={padY} x2={buyX} y2={H - padY} stroke="#34d39930" strokeWidth="1" strokeDasharray="3 2" />
        <text x={buyX + 2} y={padY + 8} fill="#34d39940" fontSize="6" fontFamily="monospace">BUY 65</text>
        {/* Zero flow axis */}
        <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="#334155" strokeWidth="1" />
        {/* Left axis */}
        <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="#1e293b" strokeWidth="1" />
        {/* Quadrant corner labels */}
        <text x={buyX + 4} y={padY + 8} fill="#34d39928" fontSize="6" fontFamily="monospace"> </text>
        <text x={W - padX - 2} y={padY + 10} fill="#34d39935" fontSize="6" textAnchor="end" fontFamily="monospace">LEADERS</text>
        <text x={W - padX - 2} y={H - padY - 3} fill="#f8717125" fontSize="6" textAnchor="end" fontFamily="monospace">DISTRIBUTION</text>
        <text x={padX + 2} y={padY + 10} fill="#22d3ee25" fontSize="6" fontFamily="monospace">ACCUMULATORS</text>
        <text x={padX + 2} y={H - padY - 3} fill="#64748b40" fontSize="6" fontFamily="monospace">AVOID</text>
        {/* Flow axis labels */}
        <text x={padX - 2} y={padY + 8} fill="#475569" fontSize="6" textAnchor="end" fontFamily="monospace">+{maxAbsFlow.toFixed(1)}σ</text>
        <text x={padX - 2} y={H - padY + 1} fill="#475569" fontSize="6" textAnchor="end" fontFamily="monospace">-{maxAbsFlow.toFixed(1)}σ</text>
        {/* Dots */}
        {plotThemes.map(t => {
          const cx = toX(t.compositeScore!);
          const cy = toY(t.flow20d!);
          const fill = FILL[t.dominantSignal] ?? FILL.HOLD;
          const bullishRatio = t.constituentCount > 0 ? t.bullishCount / t.constituentCount : 0.5;
          const r = 3.5 + bullishRatio * 4.5;
          const label = themeShortLabel(t);
          const labelRight = cx > W * 0.75;
          return (
            <g key={t.id}>
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={fill.slice(0, 7)} strokeWidth="1" strokeOpacity="0.8" />
              <text
                x={labelRight ? cx - r - 2 : cx + r + 2}
                y={cy + 3}
                fill="#94a3b8"
                fontSize="7"
                textAnchor={labelRight ? "end" : "start"}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SECTOR_COLORS: Record<string, string> = {
  TECH: "text-blue-400 bg-blue-900/20 border-blue-700/30",
  HLTH: "text-emerald-400 bg-emerald-900/20 border-emerald-700/30",
  FINL: "text-amber-400 bg-amber-900/20 border-amber-700/30",
  DISR: "text-orange-400 bg-orange-900/20 border-orange-700/30",
  INDU: "text-slate-400 bg-slate-700/30 border-slate-600/30",
  ENRG: "text-yellow-400 bg-yellow-900/20 border-yellow-700/30",
  MATL: "text-lime-400 bg-lime-900/20 border-lime-700/30",
  UTIL: "text-cyan-400 bg-cyan-900/20 border-cyan-700/30",
  REIT: "text-purple-400 bg-purple-900/20 border-purple-700/30",
  STPL: "text-teal-400 bg-teal-900/20 border-teal-700/30",
  COMM: "text-pink-400 bg-pink-900/20 border-pink-700/30",
};

function getThemeUniqueSectors(theme: ThemeSummary): string[] {
  const seen = new Set<string>();
  for (const c of theme.topConstituents) {
    const sectorId = getParentSectorId(c.categoryId) ?? (c.parentCategoryId ? getParentSectorId(c.parentCategoryId) : null);
    if (sectorId) seen.add(sectorId);
  }
  return [...seen].slice(0, 3);
}

function SortLink({ label, sortKey, currentSort, title }: { label: string; sortKey: string; currentSort: string; title?: string }) {
  const isActive = currentSort === sortKey;
  return (
    <Link
      href={`/themes?sort=${sortKey}`}
      className={`hover:text-slate-300 transition-colors ${isActive ? "text-cyan-400" : "text-slate-600"}`}
      title={title}
    >
      {label}{isActive ? " ↓" : ""}
    </Link>
  );
}

function ThemeScreener({
  themes,
  historiesByThemeId,
  alertsByThemeId,
  sort,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
  alertsByThemeId: Record<string, number>;
  sort: string;
}) {
  if (themes.length === 0) return null;

  const sortedByScore = [...themes].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const scoreRankById: Record<string, number> = {};
  sortedByScore.forEach((t, i) => { scoreRankById[t.id] = i + 1; });

  const sorted: ThemeSummary[] = (() => {
    if (sort === "delta5d") {
      return [...themes].sort((a, b) => {
        const histA = historiesByThemeId[a.id] ?? [];
        const histB = historiesByThemeId[b.id] ?? [];
        const dA = histA.length >= 6 ? histA[histA.length - 1].compositeScore - histA[histA.length - 6].compositeScore : -Infinity;
        const dB = histB.length >= 6 ? histB[histB.length - 1].compositeScore - histB[histB.length - 6].compositeScore : -Infinity;
        return dB - dA;
      });
    }
    if (sort === "alerts") {
      return [...themes].sort((a, b) => (alertsByThemeId[b.id] ?? 0) - (alertsByThemeId[a.id] ?? 0) || (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
    }
    if (sort === "rs60") {
      return [...themes].sort((a, b) => (b.rs60 ?? -Infinity) - (a.rs60 ?? -Infinity));
    }
    if (sort === "velocity") {
      const accel = (t: ThemeSummary) =>
        t.compositeTrend5d != null && t.compositeTrend20d != null
          ? t.compositeTrend5d - t.compositeTrend20d : -Infinity;
      return [...themes].sort((a, b) => accel(b) - accel(a));
    }
    return sortedByScore;
  })();

  // Rank from 5 days ago: sort by score at history[length - 6] (index 0 = oldest when 30 fetched)
  const LOOKBACK = 5;
  const priorRankById: Record<string, number> = {};
  const priorSorted = [...themes]
    .map(t => {
      const hist = historiesByThemeId[t.id] ?? [];
      const idx = hist.length - 1 - LOOKBACK;
      const score = idx >= 0 ? hist[idx].compositeScore : null;
      return { id: t.id, score };
    })
    .filter(x => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  priorSorted.forEach((x, rank) => { priorRankById[x.id] = rank + 1; });

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Theme Screener · Live Rankings</span>
        <span className="text-[10px] font-mono text-slate-600">{themes.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-700/40">
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">#</th>
              <th className="py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Δ</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Theme</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Sector</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Signal</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Score" sortKey="score" currentSort={sort} title="Sort by composite score" /></th>
              <th className="py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="5d Δ" sortKey="delta5d" currentSort={sort} title="Sort by 5-day score momentum" /></th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="RS-60" sortKey="rs60" currentSort={sort} title="Sort by 60-day relative strength vs SPY" /></th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Flow</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">vs Sectors</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Phase</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Bullish</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Trend" sortKey="velocity" currentSort={sort} title="Sort by momentum acceleration (5d trend vs 20d)" /></th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Alerts" sortKey="alerts" currentSort={sort} title="Sort by active alert count" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const rank = i + 1;
              const priorRank = priorRankById[t.id];
              const rankDelta = priorRank != null ? priorRank - rank : null;
              const signal = SIGNAL_CONFIG[t.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
              const pct = t.compositeScore != null ? Math.round(t.compositeScore * 100) : null;
              const scoreClr = t.compositeScore == null ? "text-slate-500"
                : t.compositeScore >= 0.65 ? "text-emerald-400"
                : t.compositeScore >= 0.50 ? "text-cyan-400"
                : t.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
              const barClr = t.compositeScore == null ? "bg-slate-700"
                : t.compositeScore >= 0.65 ? "bg-emerald-500"
                : t.compositeScore >= 0.50 ? "bg-cyan-500"
                : t.compositeScore >= 0.35 ? "bg-amber-500" : "bg-red-500";
              const rsClr = t.rs60 == null ? "text-slate-500"
                : t.rs60 > 0.05 ? "text-emerald-400" : t.rs60 > 0 ? "text-green-400"
                : t.rs60 < -0.05 ? "text-red-400" : "text-amber-400";
              const flowClr = t.flow20d == null ? "text-slate-500"
                : t.flow20d > 0.3 ? "text-emerald-400" : t.flow20d < -0.3 ? "text-red-400" : "text-slate-400";
              const flowArrow = t.flow20d == null ? "—" : t.flow20d > 0.3 ? "↑" : t.flow20d < -0.3 ? "↓" : "→";
              const trendClr = t.compositeTrend20d == null ? "text-slate-500"
                : t.compositeTrend20d > 0.005 ? "text-emerald-400"
                : t.compositeTrend20d < -0.005 ? "text-red-400" : "text-slate-500";
              const trendArrow = t.compositeTrend20d == null ? "—"
                : t.compositeTrend20d > 0.005 ? "↑" : t.compositeTrend20d < -0.005 ? "↓" : "→";
              const accel = t.compositeTrend5d != null && t.compositeTrend20d != null
                ? t.compositeTrend5d - t.compositeTrend20d : null;
              const divPts = t.divergenceFromParentSectors != null ? Math.round(t.divergenceFromParentSectors * 100) : null;
              const bullishPct = t.constituentCount > 0 ? Math.round((t.bullishCount / t.constituentCount) * 100) : 0;
              const themeHistory = historiesByThemeId[t.id] ?? [];
              const ageDays = signalAgeDays(themeHistory, t.dominantSignal);
              const phaseAge = phaseAgeDays(themeHistory, t.themePhase ?? null);
              const scoreDelta5d = themeHistory.length >= 6
                ? Math.round((themeHistory[themeHistory.length - 1].compositeScore - themeHistory[themeHistory.length - 1 - 5].compositeScore) * 100)
                : null;
              const alertCount = alertsByThemeId[t.id] ?? 0;
              return (
                <tr key={t.id} className={`border-t border-slate-700/30 hover:bg-slate-800/50 transition-colors ${alertCount > 0 ? "border-l-2 border-l-amber-500/40" : ""}`}>
                  <td className="py-2 px-3 text-[10px] text-slate-600 font-mono tabular-nums">{rank}</td>
                  <td className="py-2 px-2 text-[9px] font-mono tabular-nums w-8">
                    {rankDelta == null || rankDelta === 0 ? (
                      <span className="text-slate-700">—</span>
                    ) : rankDelta > 0 ? (
                      <span className="text-emerald-400" title={`Moved up ${rankDelta} place${rankDelta !== 1 ? "s" : ""} in 5 days`}>↑{rankDelta}</span>
                    ) : (
                      <span className="text-red-400" title={`Moved down ${Math.abs(rankDelta)} place${Math.abs(rankDelta) !== 1 ? "s" : ""} in 5 days`}>↓{Math.abs(rankDelta)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Link href={`/themes/${t.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors">
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {getThemeUniqueSectors(t).map(sectorId => (
                        <Link
                          key={sectorId}
                          href={`/sectors/${sectorId}`}
                          className={`text-[8px] font-mono px-1 py-0.5 rounded border transition-colors hover:brightness-125 ${SECTOR_COLORS[sectorId] ?? "text-slate-500 bg-slate-800/40 border-slate-700/30"}`}
                          title={`${SECTOR_SHORT_NAMES[sectorId] ?? sectorId} sector`}
                        >
                          {SECTOR_SHORT_NAMES[sectorId]?.slice(0, 5) ?? sectorId.slice(0, 4)}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${signal.bg} ${signal.color}`}>{signal.label}</span>
                      {ageDays > 0 && ageDays <= 10 && (
                        <span
                          className={`text-[8px] font-mono px-1 py-0.5 rounded ${ageDays <= 3 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-slate-800/60 text-slate-600"}`}
                          title={`In ${t.dominantSignal} for ${ageDays} day${ageDays !== 1 ? "s" : ""}`}
                        >
                          {ageDays <= 3 ? "new " : ""}{ageDays}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barClr}`} style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <span className={`text-[10px] font-mono tabular-nums ${scoreClr}`}>{pct ?? "—"}</span>
                      {themeHistory.length >= 5 && (() => {
                        const vals = themeHistory.slice(-14).map(h => h.compositeScore);
                        const lo = Math.min(...vals), hi = Math.max(...vals);
                        const rng = hi - lo;
                        const w = 40, h = 12;
                        const pts = vals.map((v, i) => {
                          const x = (i / (vals.length - 1)) * w;
                          const y = rng > 0 ? h - ((v - lo) / rng) * (h - 2) - 1 : h / 2;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(" ");
                        const latest = vals[vals.length - 1];
                        const clr = latest >= 0.65 ? "#34d399" : latest >= 0.50 ? "#22d3ee" : latest >= 0.35 ? "#fbbf24" : "#f87171";
                        return (
                          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60 shrink-0">
                            <polyline points={pts} fill="none" stroke={clr} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-[9px] font-mono tabular-nums w-10">
                    {scoreDelta5d == null ? (
                      <span className="text-slate-700">—</span>
                    ) : scoreDelta5d > 0 ? (
                      <span className={scoreDelta5d >= 5 ? "text-emerald-400" : "text-emerald-700"} title={`Score gained +${scoreDelta5d}pt over 5 trading days`}>+{scoreDelta5d}</span>
                    ) : scoreDelta5d < 0 ? (
                      <span className={Math.abs(scoreDelta5d) >= 5 ? "text-red-400" : "text-red-700"} title={`Score lost ${scoreDelta5d}pt over 5 trading days`}>{scoreDelta5d}</span>
                    ) : (
                      <span className="text-slate-700">0</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[10px] font-mono tabular-nums ${rsClr}`}>
                      {t.rs60 != null ? `${t.rs60 > 0 ? "+" : ""}${(t.rs60 * 100).toFixed(1)}%` : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[10px] font-mono tabular-nums ${flowClr}`}>
                      {t.flow20d != null ? `${flowArrow} ${Math.abs(t.flow20d).toFixed(1)}σ` : "—"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {divPts != null ? (
                      <span className={`text-[10px] font-mono tabular-nums ${divPts > 2 ? "text-emerald-400" : divPts < -2 ? "text-red-400" : "text-slate-400"}`}>
                        {divPts > 0 ? "+" : ""}{divPts}pt
                      </span>
                    ) : <span className="text-slate-600 text-[10px]">—</span>}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <ThemePhaseBadge phase={t.themePhase ?? null} />
                      {phaseAge > 0 && (
                        <span
                          className={`text-[8px] font-mono tabular-nums shrink-0 ${
                            phaseAge <= 2 ? "text-emerald-400 font-semibold"
                            : phaseAge <= 5 ? "text-slate-400"
                            : "text-slate-700"
                          }`}
                          title={`In ${t.themePhase} phase for ${phaseAge} day${phaseAge !== 1 ? "s" : ""}`}
                        >
                          {phaseAge}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5" title={`${t.bullishCount}/${t.constituentCount} ETFs bullish (BUY or WATCH)`}>
                      <div className="flex h-2 w-10 rounded-full overflow-hidden bg-slate-700 gap-px">
                        {t.constituentCount > 0 && Array.from({ length: t.constituentCount }, (_, j) => (
                          <div
                            key={j}
                            className={`flex-1 ${j < t.bullishCount ? (bullishPct >= 80 ? "bg-emerald-400" : "bg-cyan-500") : "bg-slate-600/40"}`}
                          />
                        ))}
                      </div>
                      <span className={`text-[9px] font-mono tabular-nums ${bullishPct >= 60 ? "text-emerald-400" : bullishPct >= 40 ? "text-amber-400" : "text-slate-600"}`}>
                        {t.bullishCount}/{t.constituentCount}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[10px] font-mono ${trendClr}`}>
                      {trendArrow}{t.compositeTrend20d != null ? ` ${t.compositeTrend20d > 0 ? "+" : ""}${(t.compositeTrend20d * 100).toFixed(1)}pt` : ""}
                      {accel != null && Math.abs(accel) > 0.002 && (
                        <span className={`ml-1 text-[9px] ${accel > 0 ? "text-emerald-300" : "text-red-300"}`}
                          title={`5d vs 20d: ${accel > 0 ? "accelerating" : "decelerating"} ${accel > 0 ? "+" : ""}${(accel * 100).toFixed(1)}pt`}
                        >
                          {accel > 0 ? "⬆" : "⬇"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {alertCount > 0 ? (
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        title={`${alertCount} active alert${alertCount !== 1 ? "s" : ""}`}
                      >
                        {alertCount}!
                      </span>
                    ) : (
                      <span className="text-slate-700 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function themeShortLabel(theme: ThemeSummary): string {
  const words = theme.name.split(/[\s_]+/);
  if (words.length === 1) return theme.name.slice(0, 5).toUpperCase();
  return words.slice(0, 2).map(w => w.slice(0, 4)).join(" ");
}

function ThemeScoreHeatmap({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const DAYS = 20;

  // Collect all unique dates across all themes, take latest DAYS
  const allDates = Array.from(
    new Set(
      Object.values(historiesByThemeId)
        .flat()
        .map(h => h.date)
    )
  ).sort().slice(-DAYS);

  if (allDates.length < 5) return null;

  const sortedThemes = [...themes]
    .filter(t => (historiesByThemeId[t.id]?.length ?? 0) >= 3)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (sortedThemes.length === 0) return null;

  const scoreByThemeDate: Record<string, Record<string, number>> = {};
  for (const t of sortedThemes) {
    scoreByThemeDate[t.id] = {};
    for (const h of historiesByThemeId[t.id] ?? []) {
      scoreByThemeDate[t.id][h.date] = h.compositeScore;
    }
  }

  const cellColor = (score: number | undefined): string => {
    if (score == null) return "bg-slate-800/40";
    if (score >= 0.70) return "bg-emerald-500";
    if (score >= 0.65) return "bg-emerald-600/80";
    if (score >= 0.55) return "bg-cyan-600/70";
    if (score >= 0.50) return "bg-cyan-700/60";
    if (score >= 0.40) return "bg-amber-700/60";
    if (score >= 0.35) return "bg-red-700/60";
    return "bg-red-800/50";
  };

  // Show column labels every 5 days
  const dateLabels = allDates.map((d, i) => {
    const showLabel = i === 0 || i === allDates.length - 1 || (allDates.length - 1 - i) % 5 === 0;
    if (!showLabel) return null;
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Score Heatmap</span>
        <span className="text-[10px] text-slate-600 font-mono">last {allDates.length} trading days · red→amber→green = 0→100</span>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="text-[9px] font-mono w-full" style={{ minWidth: `${allDates.length * 14 + 120}px` }}>
          <thead>
            <tr>
              <th className="text-left text-slate-600 font-normal pb-1 pr-2 w-28">Theme</th>
              {allDates.map((d, i) => (
                <th key={d} className="text-center text-slate-600 font-normal pb-1 w-3" style={{ minWidth: "12px" }}>
                  {dateLabels[i] ? (
                    <span className="block" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", lineHeight: 1 }}>
                      {dateLabels[i]}
                    </span>
                  ) : null}
                </th>
              ))}
              <th className="text-center text-slate-600 font-normal pb-1 pl-2">Now</th>
            </tr>
          </thead>
          <tbody>
            {sortedThemes.map(t => {
              const scores = scoreByThemeDate[t.id];
              const currentPct = t.compositeScore != null ? Math.round(t.compositeScore * 100) : null;
              const currentClr = t.compositeScore == null ? "text-slate-600"
                : t.compositeScore >= 0.65 ? "text-emerald-400"
                : t.compositeScore >= 0.50 ? "text-cyan-400"
                : t.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
              return (
                <tr key={t.id}>
                  <td className="py-0.5 pr-2 text-slate-400 truncate max-w-[112px]" style={{ maxWidth: "112px" }}>
                    <a href={`/themes/${t.id}`} className="hover:text-cyan-300 transition-colors truncate block">
                      {t.name.length > 16 ? t.name.slice(0, 15) + "…" : t.name}
                    </a>
                  </td>
                  {allDates.map(d => {
                    const score = scores[d];
                    return (
                      <td key={d} className="py-0.5 px-px" title={score != null ? `${t.name}: ${Math.round(score * 100)} (${d})` : `${t.name}: no data (${d})`}>
                        <div className={`w-2.5 h-2.5 rounded-sm ${cellColor(score)}`} />
                      </td>
                    );
                  })}
                  <td className={`py-0.5 pl-2 font-semibold ${currentClr} text-center`}>{currentPct ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThemeRaceChart({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const validThemes = themes.filter(t => (historiesByThemeId[t.id]?.length ?? 0) >= 3);
  if (validThemes.length < 2) return null;

  const width = 600, height = 100;
  const padLeft = 4, padRight = 90, padTop = 8, padBottom = 16;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const allPoints = validThemes.flatMap(t => historiesByThemeId[t.id].map(h => h.compositeScore));
  const globalMin = Math.max(0, Math.min(...allPoints) - 0.05);
  const globalMax = Math.min(1, Math.max(...allPoints) + 0.05);
  const yRange = globalMax - globalMin;

  const toY = (v: number) => padTop + chartHeight - ((v - globalMin) / yRange) * chartHeight;
  const buyY = toY(0.65);
  const reduceY = toY(0.35);

  const sortedByLatestScore = [...validThemes].sort((a, b) => {
    const aHist = historiesByThemeId[a.id];
    const bHist = historiesByThemeId[b.id];
    const aLast = aHist[aHist.length - 1]?.compositeScore ?? 0;
    const bLast = bHist[bHist.length - 1]?.compositeScore ?? 0;
    return bLast - aLast;
  });

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">30-day theme race · composite score</span>
        <span className="text-[10px] font-mono text-slate-600">all themes overlaid</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        {/* BUY threshold */}
        <line x1={padLeft} y1={buyY} x2={width - padRight} y2={buyY} stroke="#34d39920" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft} y={buyY - 2} fill="#34d39950" fontSize="6" fontFamily="monospace">BUY 65</text>
        {/* REDUCE threshold */}
        <line x1={padLeft} y1={reduceY} x2={width - padRight} y2={reduceY} stroke="#f8717120" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft} y={reduceY - 2} fill="#f8717150" fontSize="6" fontFamily="monospace">REDUCE 35</text>

        {validThemes.map(t => {
          const hist = historiesByThemeId[t.id];
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? "#64748b";
          const points = hist.map((h, i) => {
            const x = padLeft + (i / (hist.length - 1)) * chartWidth;
            const y = toY(h.compositeScore);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          const lastX = (padLeft + chartWidth).toFixed(1);
          const lastY = toY(hist[hist.length - 1].compositeScore).toFixed(1);
          return (
            <g key={t.id}>
              <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.2" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} fillOpacity="0.9" />
            </g>
          );
        })}

        {/* End-point labels stacked on right, sorted by score */}
        {sortedByLatestScore.map((t, rank) => {
          const hist = historiesByThemeId[t.id];
          const score = hist[hist.length - 1]?.compositeScore ?? 0;
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? "#64748b";
          const labelY = padTop + (rank * (chartHeight / (sortedByLatestScore.length - 1 || 1)));
          const lastX = padLeft + chartWidth;
          const lastY = toY(score);
          return (
            <g key={`label-${t.id}`}>
              <line x1={lastX + 2} y1={lastY} x2={lastX + 8} y2={labelY + 3} stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
              <text x={lastX + 10} y={labelY + 4} fill={stroke} fontSize="7" fontFamily="monospace" fontWeight="500">
                {themeShortLabel(t)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortParam } = await searchParams;
  const screenerSort = ["score", "delta5d", "alerts", "rs60", "velocity"].includes(sortParam ?? "") ? sortParam as string : "score";

  const [themes, alertsResponse, recentAlerts] = await Promise.all([
    fetchThemes(),
    fetchAlerts().catch(() => ({ activeCount: 0, alerts: [] })),
    fetchRecentAlerts().catch(() => [] as AlertDto[]),
  ]);

  const historyResults = await Promise.allSettled(
    themes.map(t => fetchThemeHistory(t.id, 30))
  );
  const historyByThemeId: Record<string, ThemeHistoryPoint[]> = {};
  themes.forEach((t, i) => {
    const result = historyResults[i];
    historyByThemeId[t.id] = result.status === "fulfilled" ? result.value : [];
  });

  const themeAlerts = alertsResponse.alerts.filter(a => a.themeId != null && a.status === "ACTIVE");
  const alertsByThemeId: Record<string, number> = {};
  for (const alert of themeAlerts) {
    if (alert.themeId) alertsByThemeId[alert.themeId] = (alertsByThemeId[alert.themeId] ?? 0) + 1;
  }
  const buyThemes = themes.filter(t => t.dominantSignal === "BUY").length;
  const watchThemes = themes.filter(t => t.dominantSignal === "WATCH").length;
  const activeThemes = themes.filter(t => t.dominantSignal === "BUY" || t.dominantSignal === "WATCH").length;

  const phaseGroups: { phase: string; count: number; cls: string }[] = [
    { phase: "BREAKOUT", count: themes.filter(t => t.themePhase === "BREAKOUT").length,  cls: "text-emerald-400" },
    { phase: "MOMENTUM", count: themes.filter(t => t.themePhase === "MOMENTUM").length,  cls: "text-cyan-400" },
    { phase: "SETUP",    count: themes.filter(t => t.themePhase === "SETUP").length,     cls: "text-sky-400" },
    { phase: "FADING",   count: themes.filter(t => t.themePhase === "FADING").length,    cls: "text-amber-400" },
    { phase: "WEAK",     count: themes.filter(t => t.themePhase === "WEAK").length,      cls: "text-red-400" },
  ].filter(g => g.count > 0);

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
            <div className="flex gap-3 mt-2 flex-wrap">
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
              {themeAlerts.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  {themeAlerts.length} alert{themeAlerts.length !== 1 ? "s" : ""}
                </span>
              )}
              {activeThemes === 0 && (
                <span className="text-[11px] font-mono text-slate-500">No active signals</span>
              )}
              {phaseGroups.length > 0 && (
                <span className="text-[11px] font-mono text-slate-400">
                  {phaseGroups.map((g, i) => (
                    <span key={g.phase}>
                      {i > 0 && <span className="text-slate-600"> · </span>}
                      <span className={g.cls}>{g.count} {g.phase}</span>
                    </span>
                  ))}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-600">
                {themes.length} themes · {themes.reduce((a, t) => a + t.constituentCount, 0)} ETFs tracked
              </span>
            </div>
          )}
        </div>

        {themes.length > 0 && <TopOpportunitiesPanel themes={themes} />}
        {themeAlerts.length > 0 && <ThemeAlertFeed alerts={themeAlerts} themes={themes} />}
        {recentAlerts.length > 0 && <ThemeEventsFeed events={recentAlerts} />}
        {themes.length > 0 && <ThemeTippingPoints themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <ThemePlaybook themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <PreBuySetupPanel themes={themes} />}
        {themes.length > 0 && <ThemeNarrative themes={themes} />}
        {themes.length > 0 && <ActiveRotationBanner themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <RotationMomentumStrip themes={themes} />}
        {themes.length > 1 && <ThemeRelativeStrengthPlot themes={themes} />}
        {themes.length > 1 && <ThemePositioningMatrix themes={themes} />}
        {themes.length > 1 && <ThemeRaceChart themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 1 && <ThemeAlertRiskMap themes={themes} />}
        {themes.length > 0 && <ThemeScreener themes={themes} historiesByThemeId={historyByThemeId} alertsByThemeId={alertsByThemeId} sort={screenerSort} />}
        {themes.length > 1 && <ThemeScoreHeatmap themes={themes} historiesByThemeId={historyByThemeId} />}

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
