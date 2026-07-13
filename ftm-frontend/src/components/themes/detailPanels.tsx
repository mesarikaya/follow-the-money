import Link from "next/link";
import { AlertDto, ThemeConstituent, ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import { HISTORY_PERIODS, buildPhaseTimeline } from "@/lib/themes/themeDetail";

/**
 * The panels stacked below the theme header: score history, phase timeline, alerts, entry
 * intelligence and related themes. Presentational only — every value arrives via props.
 *
 * The badge configs here are deliberately NOT the ones in `badges.tsx`: the detail page spells its
 * labels out in full ("MEDIUM RISK") where the screener abbreviates them ("MED RISK").
 */

const RULE_LABELS: Record<string, string> = {
  theme_5d_acceleration:            "5d Momentum Acceleration",
  theme_dominant_signal_transition: "Signal Transition",
  theme_momentum_surge:             "Momentum Surge",
  theme_momentum_collapse:          "Momentum Collapse",
  theme_distribute_warning:         "Distribution Warning",
  theme_phase_breakout_entry:       "Breakout Phase Entry",
  theme_setup_acceleration:         "Pre-Breakout Setup",
  theme_failed_breakout:            "Failed Breakout",
  theme_phase_fading:               "Phase Fading",
  theme_momentum_exhaustion:        "Momentum Exhaustion",
  theme_recovery_signal:            "Recovery Signal",
  theme_strong_breakout_confirmation: "Strong Breakout Confirmed",
  theme_peer_divergence:            "Peer Divergence",
  theme_score_price_divergence:     "Score-Price Divergence",
  pre_buy_flow_surge:               "Pre-Buy Flow Surge",
};

const SEVERITY_CONFIG: Record<string, { badge: string }> = {
  ACTION:  { badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" },
  WARNING: { badge: "bg-amber-500/15 text-amber-400 border border-amber-500/25" },
  URGENT:  { badge: "bg-red-500/15 text-red-400 border border-red-500/25" },
  INFO:    { badge: "bg-slate-700/60 text-slate-400 border border-slate-600/40" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; row: string }> = {
  ACTIVE:       { label: "ACTIVE",       dot: "bg-amber-400 animate-pulse", row: "" },
  RESOLVED:     { label: "RESOLVED",     dot: "bg-slate-500",               row: "opacity-60" },
  ACKNOWLEDGED: { label: "ACK",          dot: "bg-slate-600",               row: "opacity-50" },
};

const PHASE_COLORS: Record<string, string> = {
  BREAKOUT:  "#34d399",
  MOMENTUM:  "#22d3ee",
  SETUP:     "#38bdf8",
  BUILDING:  "#64748b",
  HOLDING:   "#475569",
  FADING:    "#fbbf24",
  DISTRIBUTE:"#fb923c",
  WEAK:      "#f87171",
  NEUTRAL:   "#334155",
};

const RISK_LEVEL_CONFIG: Record<string, { label: string; className: string }> = {
  LOW:     { label: "LOW RISK",     className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  MEDIUM:  { label: "MEDIUM RISK",  className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" },
  HIGH:    { label: "HIGH RISK",    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  EXTREME: { label: "EXTREME RISK", className: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

// Keys must match the backend EntryAction enum (themes/entry/EntryAction.java).
const ENTRY_ACTION_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  ENTER:    { icon: "↗", label: "ENTER",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  SCALE_IN: { icon: "↗", label: "SCALE IN", color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30" },
  WATCH:    { icon: "◎", label: "WATCH",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  AVOID:    { icon: "✕", label: "AVOID",    color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
};

const ALIGNMENT_CONFIG_DETAIL: Record<string, { icon: string; label: string; className: string }> = {
  ALIGNED_BULLISH: { icon: "↑↑", label: "Aligned Bullish", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  RECOVERING:      { icon: "↪↑", label: "Recovering",      className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" },
  FADING:          { icon: "↗↓", label: "Fading",          className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  ALIGNED_BEARISH: { icon: "↓↓", label: "Aligned Bearish", className: "bg-red-500/15 text-red-400 border border-red-500/30" },
  NEUTRAL:         { icon: "→",  label: "Neutral",          className: "bg-slate-700/60 text-slate-400 border border-slate-600/40" },
};

// Keys must match what the backend emits (themes/transition/*TransitionRule.java).
const PHASE_TRANSITION_CONFIG: Record<string, { label: string; className: string }> = {
  APPROACHING_BUY:  { label: "◉ Approaching Buy",  className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" },
  EARLY_RECOVERY:   { label: "↺ Early Recovery",   className: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  BREAKOUT_AT_RISK: { label: "⚠ Breakout at Risk", className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  DISTRIBUTION:     { label: "↘ Distribution",     className: "bg-orange-500/15 text-orange-400 border border-orange-500/30" },
};

const DETAIL_CONFIDENCE_CONFIG: Record<string, { label: string; bar: string; text: string }> = {
  HIGH_CONFIDENCE: { label: "HIGH CONFIDENCE", bar: "bg-emerald-500", text: "text-emerald-400" },
  MODERATE:        { label: "MODERATE",         bar: "bg-cyan-500",    text: "text-cyan-400" },
  CAUTIOUS:        { label: "CAUTIOUS",         bar: "bg-amber-500",   text: "text-amber-400" },
  AVOID:           { label: "AVOID",            bar: "bg-red-500",     text: "text-red-400" },
};

const alertDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { month: "short", day: "numeric" });

export const ThemeDetailAlerts = ({ alerts }: { alerts: AlertDto[] }) => {
  if (alerts.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-amber-800/20 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
          Active Alerts · {alerts.length}
        </span>
      </div>
      <div className="divide-y divide-amber-900/20">
        {alerts.map(alert => {
          const severity = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
          const ruleLabel = RULE_LABELS[alert.ruleId] ?? alert.ruleId;
          return (
            <div key={alert.id} className="px-3 py-2 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${severity.badge}`}>{alert.severity}</span>
                  <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">{ruleLabel}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{alert.message}</p>
              </div>
              <span className="text-[9px] font-mono text-slate-700 shrink-0 mt-0.5">{alertDate(alert.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ThemeAlertHistory = ({ alerts }: { alerts: AlertDto[] }) => {
  const resolved = alerts.filter(alert => alert.status !== "ACTIVE");
  if (resolved.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Alert History · {resolved.length}
        </span>
      </div>
      <div className="divide-y divide-slate-700/20">
        {resolved.map(alert => {
          const severity = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
          const status = STATUS_CONFIG[alert.status] ?? STATUS_CONFIG.RESOLVED;
          const ruleLabel = RULE_LABELS[alert.ruleId] ?? alert.ruleId;
          const closedAt = alert.resolvedAt ?? alert.acknowledgedAt;
          return (
            <div key={alert.id} className={`px-3 py-2 flex items-start gap-3 ${status.row}`}>
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${status.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${severity.badge}`}>{alert.severity}</span>
                  <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">{ruleLabel}</span>
                  <span className="text-[9px] font-mono text-slate-700 px-1.5 py-0.5 rounded bg-slate-800/40">{status.label}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{alert.message}</p>
              </div>
              <div className="text-right shrink-0 mt-0.5">
                <div className="text-[9px] font-mono text-slate-700">{alertDate(alert.createdAt)}</div>
                {closedAt && <div className="text-[9px] font-mono text-slate-800">→ {alertDate(closedAt)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ThemeHistoryChart = ({ history }: { history: ThemeHistoryPoint[] }) => {
  if (history.length < 3) return null;
  const width = 600, height = 72;
  const padLeft = 28, padRight = 8, padTop = 6, padBottom = 18;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const values = history.map(h => h.compositeScore);
  const minVal = Math.max(0, Math.min(...values) - 0.05);
  const maxVal = Math.min(1, Math.max(...values) + 0.05);
  const yRange = maxVal - minVal;

  const toX = (i: number) => padLeft + (i / (values.length - 1)) * chartWidth;
  const toY = (v: number) => padTop + chartHeight - ((v - minVal) / yRange) * chartHeight;

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${toX(values.length - 1).toFixed(1)} ${(padTop + chartHeight).toFixed(1)} L ${padLeft} ${(padTop + chartHeight).toFixed(1)} Z`;

  const latest = values[values.length - 1];
  const stroke = latest >= 0.65 ? "#34d399" : latest >= 0.50 ? "#22d3ee" : latest >= 0.35 ? "#fbbf24" : "#f87171";
  const fill = latest >= 0.65 ? "#34d39920" : latest >= 0.50 ? "#22d3ee20" : latest >= 0.35 ? "#fbbf2420" : "#f8717120";

  const buyY = toY(0.65);
  const reduceY = toY(0.35);
  const firstDate = history[0].date;
  const lastDate = history[history.length - 1].date;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <line x1={padLeft} y1={buyY} x2={width - padRight} y2={buyY} stroke="#34d39930" strokeWidth="1" strokeDasharray="3 3" />
      <text x={padLeft - 2} y={buyY + 3} fill="#34d39960" fontSize="7" textAnchor="end" fontFamily="monospace">65</text>
      <line x1={padLeft} y1={reduceY} x2={width - padRight} y2={reduceY} stroke="#f8717130" strokeWidth="1" strokeDasharray="3 3" />
      <text x={padLeft - 2} y={reduceY + 3} fill="#f8717160" fontSize="7" textAnchor="end" fontFamily="monospace">35</text>
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(values.length - 1)} cy={toY(latest)} r="3" fill={stroke} />
      <text x={padLeft} y={height} fill="#64748b" fontSize="7" fontFamily="monospace">{firstDate}</text>
      <text x={width - padRight} y={height} fill="#64748b" fontSize="7" textAnchor="end" fontFamily="monospace">{lastDate}</text>
    </svg>
  );
};

export const HistoryChartSection = ({
  history,
  days,
  themeId,
}: {
  history: ThemeHistoryPoint[];
  days: number;
  themeId: string;
}) => (
  <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">composite trend</span>
      <div className="flex items-center gap-1">
        {HISTORY_PERIODS.map(period => (
          <Link
            key={period}
            href={`/themes/${themeId}?days=${period}`}
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors ${
              period === days
                ? "bg-slate-600 text-slate-200"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            {period}d
          </Link>
        ))}
      </div>
    </div>
    <ThemeHistoryChart history={history} />
  </div>
);

const phaseColor = (phase: string) => PHASE_COLORS[phase] ?? "#334155";

export const PhaseTimelineStrip = ({
  history,
  backendPhases,
}: {
  history: ThemeHistoryPoint[];
  backendPhases?: string[];
}) => {
  const timeline = buildPhaseTimeline(history, backendPhases);
  if (!timeline) return null;
  const { segments, totalDays } = timeline;
  const recentSegments = segments.slice(-4);

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Phase Timeline</div>
      <div className="flex h-4 rounded overflow-hidden gap-px mb-2">
        {segments.map(segment => (
          <div
            key={segment.start}
            style={{
              width: `${((segment.end - segment.start + 1) / totalDays) * 100}%`,
              backgroundColor: phaseColor(segment.phase) + "99",
            }}
            title={`${segment.phase}: ${segment.date} (${segment.end - segment.start + 1} days)`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {recentSegments.map((segment, i) => (
          <div key={segment.start} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-700 text-[9px]">→</span>}
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: PHASE_COLORS[segment.phase] ?? "#64748b",
                backgroundColor: phaseColor(segment.phase) + "22",
                border: `1px solid ${phaseColor(segment.phase)}44`,
              }}
            >
              {segment.phase}
            </span>
            <span className="text-[9px] text-slate-600 font-mono">{segment.end - segment.start + 1}d</span>
          </div>
        ))}
        {segments.length > 4 && (
          <span className="text-[9px] text-slate-600 font-mono">
            (+ {segments.length - 4} earlier)
          </span>
        )}
      </div>
    </div>
  );
};

export const RelatedThemesPanel = ({
  currentThemeId,
  currentConstituents,
  allThemes,
}: {
  currentThemeId: string;
  currentConstituents: ThemeConstituent[];
  allThemes: ThemeSummary[];
}) => {
  const currentTickers = new Set(currentConstituents.map(c => c.etfTicker));
  const related = allThemes
    .filter(t => t.id !== currentThemeId)
    .map(t => ({
      theme: t,
      sharedTickers: t.topConstituents.filter(c => currentTickers.has(c.etfTicker)).map(c => c.etfTicker),
    }))
    .filter(r => r.sharedTickers.length > 0)
    .sort((a, b) => b.sharedTickers.length - a.sharedTickers.length);

  if (related.length === 0) return null;

  const SIGNAL_PILL: Record<string, string> = {
    BUY:    "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    WATCH:  "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
    HOLD:   "text-slate-400 bg-slate-700/60 border-slate-600/40",
    REDUCE: "text-red-400 bg-red-500/15 border-red-500/30",
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 mb-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Related Themes · Shared ETF Exposure</div>
      <div className="space-y-2">
        {related.map(r => {
          const signalClass = SIGNAL_PILL[r.theme.dominantSignal] ?? SIGNAL_PILL.HOLD;
          const score = r.theme.compositeScore != null ? Math.round(r.theme.compositeScore * 100) : null;
          const scoreClass = r.theme.compositeScore == null ? "text-slate-500"
            : r.theme.compositeScore >= 0.65 ? "text-emerald-400"
            : r.theme.compositeScore >= 0.50 ? "text-cyan-400"
            : r.theme.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
          return (
            <div key={r.theme.id} className="flex items-center gap-3 flex-wrap">
              <Link href={`/themes/${r.theme.id}`} className="text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-colors min-w-0 shrink-0 max-w-[200px] truncate">
                {r.theme.name}
              </Link>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${signalClass}`}>{r.theme.dominantSignal}</span>
              {score != null && <span className={`text-[10px] font-mono shrink-0 ${scoreClass}`}>{score}</span>}
              <div className="flex gap-1 flex-wrap">
                {r.sharedTickers.map(ticker => (
                  <span key={ticker} className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-900/30 text-blue-300 border border-blue-700/40 rounded">
                    {ticker}
                  </span>
                ))}
              </div>
              <span className="text-[9px] text-slate-600">
                {r.sharedTickers.length} shared ETF{r.sharedTickers.length > 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-slate-600 mt-2">
        Themes sharing ETF exposure move together — factor in correlation when sizing positions.
      </p>
    </div>
  );
};

const RiskLevelBadge = ({ riskLevel }: { riskLevel: string | null }) => {
  const cfg = riskLevel ? RISK_LEVEL_CONFIG[riskLevel] : undefined;
  if (!cfg) return null;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.className}`}>{cfg.label}</span>;
};

const PhaseTransitionBadge = ({ signal }: { signal: string | null }) => {
  const cfg = signal ? PHASE_TRANSITION_CONFIG[signal] : undefined;
  if (!cfg) return null;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.className}`}>{cfg.label}</span>;
};

const MomentumAlignmentRow = ({ momentumAlignment }: { momentumAlignment: string | null }) => {
  const cfg = momentumAlignment ? ALIGNMENT_CONFIG_DETAIL[momentumAlignment] : undefined;
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0">Momentum</span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.className}`} title={cfg.label}>
        {cfg.icon} {cfg.label}
      </span>
    </div>
  );
};

const EntryAdvisorCard = ({ entryAction, entryRationale }: { entryAction: string | null; entryRationale: string | null }) => {
  const cfg = entryAction ? ENTRY_ACTION_CONFIG[entryAction] : undefined;
  if (!cfg) return null;
  return (
    <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-sm font-bold ${cfg.color}`}>{cfg.icon}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
      </div>
      {entryRationale && <p className="text-[11px] text-slate-300 leading-relaxed">{entryRationale}</p>}
    </div>
  );
};

const ConfluenceScoreBar = ({ confluenceScore, confidenceLabel }: { confluenceScore: number; confidenceLabel: string }) => {
  const cfg = DETAIL_CONFIDENCE_CONFIG[confidenceLabel];
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${confluenceScore}%` }} />
      </div>
      <span className={`text-[11px] font-mono font-semibold tabular-nums shrink-0 ${cfg.text}`}>
        {confluenceScore}
      </span>
      <span className={`text-[9px] font-mono uppercase shrink-0 ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
};

export const IntelligencePanel = ({ theme }: { theme: ThemeSummary }) => {
  const hasAnything = theme.riskLevel || theme.entryAction || theme.momentumAlignment || theme.phaseTransitionSignal;
  if (!hasAnything) return null;
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Entry Intelligence</span>
        <ConfluenceScoreBar confluenceScore={theme.confluenceScore} confidenceLabel={theme.confidenceLabel} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <EntryAdvisorCard entryAction={theme.entryAction} entryRationale={theme.entryRationale} />
        <div className="flex flex-col gap-2 justify-center">
          <div className="flex items-center gap-2 flex-wrap">
            <RiskLevelBadge riskLevel={theme.riskLevel} />
            <PhaseTransitionBadge signal={theme.phaseTransitionSignal} />
          </div>
          <MomentumAlignmentRow momentumAlignment={theme.momentumAlignment} />
        </div>
      </div>
    </div>
  );
};
