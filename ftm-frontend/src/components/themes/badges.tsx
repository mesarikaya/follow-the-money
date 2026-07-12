import { ThemeConstituent, ThemeHistoryPoint } from "@/lib/api";
import { scoreColor, signalAgeDays } from "@/lib/themes/themeMetrics";


export const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY:    { label: "BUY",    color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { label: "WATCH",  color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40" },
  REDUCE: { label: "REDUCE", color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30" },
};

export const PHASE_CONFIG: Record<string, { label: string; className: string; priority: number }> = {
  BREAKOUT: { label: "↗ BREAKOUT", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30", priority: 1 },
  MOMENTUM: { label: "↑ MOMENTUM", className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",         priority: 2 },
  SETUP:    { label: "⬆ SETUP",    className: "bg-sky-500/15 text-sky-400 border border-sky-500/25",             priority: 3 },
  BUILDING: { label: "→ BUILDING", className: "bg-slate-700/60 text-slate-400 border border-slate-600/40",       priority: 4 },
  HOLDING:  { label: "■ HOLDING",  className: "bg-slate-700/40 text-slate-500 border border-slate-700/40",       priority: 5 },
  FADING:   { label: "↓ FADING",   className: "bg-amber-500/15 text-amber-400 border border-amber-500/25",       priority: 6 },
  DISTRIBUTE: { label: "↘ DIST",   className: "bg-orange-500/15 text-orange-400 border border-orange-500/25",    priority: 7 },
  WEAK:     { label: "↓ WEAK",     className: "bg-red-500/15 text-red-400 border border-red-500/25",             priority: 8 },
};

export const TRANSITION_CONFIG: Record<string, { label: string; className: string; title: string }> = {
  APPROACHING_BUY:  { label: "→ BUY",   className: "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40", title: "Approaching BUY — rising momentum, streak holding" },
  BREAKOUT_AT_RISK: { label: "⚠ RISK",  className: "bg-amber-500/25 text-amber-300 border border-amber-400/40",     title: "Breakout at risk — momentum fading with elevated alerts" },
  EARLY_RECOVERY:   { label: "↑ RECOV", className: "bg-sky-500/20 text-sky-300 border border-sky-400/30",           title: "Early recovery — score rebuilding with accelerating 5d trend" },
  DISTRIBUTION:     { label: "↘ DIST",  className: "bg-orange-500/20 text-orange-300 border border-orange-400/30",  title: "Distribution signal — high score with outflow and declining trend" },
};

export const RISK_CONFIG: Record<string, { label: string; className: string; title: string }> = {
  LOW:     { label: "LOW RISK",     className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25", title: "Low risk — low volatility, positive trends, stable phase" },
  MEDIUM:  { label: "MED RISK",    className: "bg-slate-600/30 text-slate-300 border border-slate-500/30",      title: "Medium risk — balanced signals" },
  HIGH:    { label: "HIGH RISK",    className: "bg-amber-500/20 text-amber-300 border border-amber-500/30",      title: "High risk — fading trend, elevated alerts or unstable phase" },
  EXTREME: { label: "EXTR RISK",   className: "bg-red-500/20 text-red-300 border border-red-500/30",            title: "Extreme risk — severe volatility, dual trend decline or weak phase" },
};

export const ALIGNMENT_CONFIG: Record<string, { label: string; className: string; icon: string; tooltip: string }> = {
  ALIGNED_BULLISH: { label: "↑↑", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35", icon: "↑↑", tooltip: "5d and 20d momentum both positive — sustained uptrend" },
  RECOVERING:      { label: "↪↑", className: "bg-teal-500/15 text-teal-300 border border-teal-500/30",         icon: "↪↑", tooltip: "Short-term dip in healthy long-term uptrend — potential buy-the-dip" },
  FADING:          { label: "↗↓", className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",       icon: "↗↓", tooltip: "Short-term bounce in declining long-term trend — momentum fading" },
  ALIGNED_BEARISH: { label: "↓↓", className: "bg-red-500/15 text-red-400 border border-red-500/25",             icon: "↓↓", tooltip: "Both timeframes declining — sustained downward pressure" },
  NEUTRAL:         { label: "→",  className: "bg-slate-700/60 text-slate-400 border border-slate-600/40",       icon: "→",  tooltip: "No clear momentum direction" },
};

export const ENTRY_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  ENTER:    { label: "ENTER",    className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35", icon: "↗" },
  SCALE_IN: { label: "SCALE IN", className: "bg-teal-500/20 text-teal-300 border border-teal-500/35",         icon: "↗" },
  WATCH:    { label: "WATCH",    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",       icon: "◉" },
  AVOID:    { label: "AVOID",    className: "bg-red-500/15 text-red-400 border border-red-500/25",             icon: "✕" },
};

export const CONFIDENCE_CONFIG: Record<string, { label: string; className: string }> = {
  HIGH_CONFIDENCE: { label: "⬆ HIGH",    className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35" },
  MODERATE:        { label: "◆ MOD",     className: "bg-slate-700/60 text-slate-300 border border-slate-600/40" },
  CAUTIOUS:        { label: "▼ CAUT",    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  AVOID:           { label: "✕ AVOID",   className: "bg-red-500/15 text-red-400 border border-red-500/25" },
};

export function ScoreArc({ score }: { score: number | null }) {
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

export function FlowChip({ flow }: { flow: number | null }) {
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

export function TrendChip({ trend }: { trend: number | null }) {
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

export function EtfBubble({ c }: { c: ThemeConstituent }) {
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

export function DivergenceChip({ divergence }: { divergence: number | null }) {
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

export function ThemeSparkline({ history }: { history: ThemeHistoryPoint[] }) {
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

export function ScoreDeltaBadge({ history }: { history: ThemeHistoryPoint[] }) {
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

export function ThemePhaseBadge({ phase }: { phase: string | null }) {
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

export function PhaseTransitionBadge({ signal }: { signal: string | null }) {
  if (!signal) return null;
  const cfg = TRANSITION_CONFIG[signal];
  if (!cfg) return null;
  return (
    <span
      className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${cfg.className}`}
      title={cfg.title}
    >
      {cfg.label}
    </span>
  );
}

export function RiskLevelBadge({ riskLevel }: { riskLevel: string | null }) {
  if (!riskLevel) return null;
  const cfg = RISK_CONFIG[riskLevel];
  if (!cfg) return null;
  return (
    <span
      className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${cfg.className}`}
      title={cfg.title}
    >
      {cfg.label}
    </span>
  );
}

export function MomentumAlignmentBadge({ alignment }: { alignment: string | null }) {
  if (!alignment) return null;
  const cfg = ALIGNMENT_CONFIG[alignment];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${cfg.className}`}
      title={cfg.tooltip}
    >
      {cfg.icon}
    </span>
  );
}

export function EntryActionBadge({
  action,
  rationale,
}: {
  action: string | null;
  rationale: string | null;
}) {
  if (!action) return null;
  const cfg = ENTRY_CONFIG[action];
  if (!cfg) return null;
  return (
    <span
      className={`text-[8px] font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5 ${cfg.className}`}
      title={rationale ?? action}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function ConfluenceBadge({
  confluenceScore,
  confidenceLabel,
}: {
  confluenceScore: number;
  confidenceLabel: string;
}) {
  const cfg = CONFIDENCE_CONFIG[confidenceLabel];
  if (!cfg) return null;
  return (
    <span
      className={`text-[8px] font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5 ${cfg.className}`}
      title={`Signal confluence: ${confluenceScore}/100 — combines entry timing, risk level, momentum alignment, and phase transition signals`}
    >
      {cfg.label} {confluenceScore}
    </span>
  );
}

export function SignalFreshnessBadge({
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

export function BullishBar({ bullish, total }: { bullish: number; total: number }) {
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

