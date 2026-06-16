import Link from "next/link";
import { fetchTheme, fetchThemeHistory, fetchThemes, fetchAlerts, fetchThemeAlertHistory, AlertDto, ThemeConstituent, ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import { notFound } from "next/navigation";
import { SECTOR_DRILLDOWN_IDS, SECTOR_SHORT_NAMES, getParentSectorId } from "@/lib/sectors";
import ThemeScoreGauge from "@/components/ThemeScoreGauge";

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY:    { label: "BUY",    color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { label: "WATCH",  color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40" },
  REDUCE: { label: "REDUCE", color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30" },
};

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-slate-600 text-xs">—</span>;
  const cfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG.HOLD;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.65 ? "bg-emerald-500" : score >= 0.50 ? "bg-cyan-500" : score >= 0.35 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 0.65 ? "text-emerald-400" : score >= 0.50 ? "text-cyan-400" : score >= 0.35 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums ${textColor}`}>{pct}</span>
    </div>
  );
}

function RsCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const color = value > 0.05 ? "text-emerald-400" : value > 0 ? "text-green-400" : value < -0.05 ? "text-red-400" : "text-amber-400";
  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {value > 0 ? "+" : ""}{(value * 100).toFixed(1)}%
    </span>
  );
}

function FlowCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const isIn = value > 0.3;
  const isOut = value < -0.3;
  const color = isIn ? "text-emerald-400" : isOut ? "text-red-400" : "text-slate-400";
  const arrow = isIn ? "↑" : isOut ? "↓" : "→";
  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {arrow} {value.toFixed(2)}σ
    </span>
  );
}

function TrendCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const isUp = value > 0.005;
  const isDown = value < -0.005;
  const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return <span className={`text-xs font-mono ${color}`}>{arrow} {(value * 100).toFixed(1)}pt</span>;
}

function ConvictionDots({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-700 text-xs">—</span>;
  const filled = Math.round(score / 20);
  return (
    <div className="flex gap-0.5" title={`Conviction: ${score}/100`}>
      {[1,2,3,4,5].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= filled ? "bg-blue-400" : "bg-slate-700"}`}
        />
      ))}
    </div>
  );
}

function SectorChip({ categoryId, parentCategoryId }: { categoryId: string; parentCategoryId: string | null }) {
  const parentId = parentCategoryId ?? getParentSectorId(categoryId);
  if (!parentId || !SECTOR_DRILLDOWN_IDS.has(parentId)) return <span className="text-slate-600 text-xs">—</span>;
  const shortName = SECTOR_SHORT_NAMES[parentId] ?? parentId;
  const isSelf = SECTOR_DRILLDOWN_IDS.has(categoryId);
  return (
    <Link
      href={`/sectors/${parentId}`}
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors hover:border-cyan-500/50 hover:text-cyan-300 ${
        isSelf
          ? "text-blue-300 bg-blue-900/20 border-blue-700/40"
          : "text-slate-400 bg-slate-800/60 border-slate-600/40"
      }`}
      title={`View ${parentId} sector drilldown`}
    >
      {shortName}
    </Link>
  );
}

function ConstituentRow({ c, index }: { c: ThemeConstituent; index: number }) {
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(c.categoryId);
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors">
      <td className="py-2.5 px-3 text-xs text-slate-500 font-mono tabular-nums">{index + 1}</td>
      <td className="py-2.5 px-3">
        {hasDrilldown ? (
          <Link href={`/sectors/${c.categoryId}`} className="text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-colors">
            {c.name}
          </Link>
        ) : (
          <div className="text-xs font-semibold text-slate-200">{c.name}</div>
        )}
      </td>
      <td className="py-2.5 px-3">
        {hasDrilldown ? (
          <Link href={`/sectors/${c.categoryId}`} className="text-[11px] font-mono text-blue-300 bg-blue-900/20 px-1.5 py-0.5 rounded hover:text-cyan-300 transition-colors">
            {c.etfTicker}
          </Link>
        ) : (
          <span className="text-[11px] font-mono text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
            {c.etfTicker}
          </span>
        )}
      </td>
      <td className="py-2.5 px-3"><SectorChip categoryId={c.categoryId} parentCategoryId={c.parentCategoryId} /></td>
      <td className="py-2.5 px-3"><ScoreBar score={c.compositeScore} /></td>
      <td className="py-2.5 px-3"><RsCell value={c.rs60} /></td>
      <td className="py-2.5 px-3"><FlowCell value={c.flow20d} /></td>
      <td className="py-2.5 px-3"><TrendCell value={c.compositeTrend5d} /></td>
      <td className="py-2.5 px-3"><TrendCell value={c.compositeTrend20d} /></td>
      <td className="py-2.5 px-3"><SignalBadge signal={c.tradeSignal} /></td>
      <td className="py-2.5 px-3"><ConvictionDots score={c.convictionScore} /></td>
    </tr>
  );
}

function ThemeHistoryChart({ history, days }: { history: ThemeHistoryPoint[]; days: number }) {
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
}

function HistoryChartSection({
  history,
  days,
  themeId,
}: {
  history: ThemeHistoryPoint[];
  days: number;
  themeId: string;
}) {
  const periods = HISTORY_PERIODS;
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">composite trend</span>
        <div className="flex items-center gap-1">
          {periods.map(p => (
            <Link
              key={p}
              href={`/themes/${themeId}?days=${p}`}
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                p === days
                  ? "bg-slate-600 text-slate-200"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              {p}d
            </Link>
          ))}
        </div>
      </div>
      <ThemeHistoryChart history={history} days={days} />
    </div>
  );
}

function SignalDistributionBar({ constituents }: { constituents: ThemeConstituent[] }) {
  const total = constituents.length;
  if (total === 0) return null;
  const buy = constituents.filter(c => c.tradeSignal === "BUY").length;
  const watch = constituents.filter(c => c.tradeSignal === "WATCH").length;
  const reduce = constituents.filter(c => c.tradeSignal === "REDUCE").length;
  const hold = total - buy - watch - reduce;
  const segments: { count: number; color: string; label: string }[] = [
    { count: buy,    color: "#34d399", label: "BUY" },
    { count: watch,  color: "#22d3ee", label: "WATCH" },
    { count: hold,   color: "#475569", label: "HOLD" },
    { count: reduce, color: "#f87171", label: "REDUCE" },
  ].filter(s => s.count > 0);
  return (
    <div className="mt-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Signal Distribution</div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color + "cc" }}
            title={`${s.label}: ${s.count}/${total}`}
          />
        ))}
      </div>
      <div className="flex gap-3 mt-1">
        {segments.map(s => (
          <span key={s.label} className="text-[9px] font-mono" style={{ color: s.color }}>
            {s.count} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConstituentScoreSpread({ constituents }: { constituents: ThemeConstituent[] }) {
  const scored = constituents
    .filter(c => c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  if (scored.length < 2) return null;

  const scores = scored.map(c => c.compositeScore!);
  const maxScore = scores[0];
  const minScore = scores[scores.length - 1];
  const spread = Math.round((maxScore - minScore) * 100);
  const spreadColor = spread >= 30 ? "#f87171" : spread >= 20 ? "#fbbf24" : "#34d399";

  const toX = (s: number) => `${(s * 100).toFixed(1)}%`;

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/40">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Constituent Score Spread</span>
        <span className="text-[10px] font-mono" style={{ color: spreadColor }}>
          {spread}pt spread
        </span>
        {spread >= 30 && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            peer divergence
          </span>
        )}
      </div>
      <div className="relative h-8">
        {/* Background zones */}
        <div className="absolute inset-0 rounded overflow-hidden flex">
          <div className="h-full bg-red-500/5" style={{ width: "35%" }} />
          <div className="h-full bg-amber-500/5" style={{ width: "15%" }} />
          <div className="h-full bg-slate-700/20" style={{ width: "15%" }} />
          <div className="h-full bg-emerald-500/5" style={{ width: "35%" }} />
        </div>
        {/* Threshold lines */}
        <div className="absolute top-0 bottom-0 w-px bg-emerald-500/30" style={{ left: "65%" }} title="BUY 65" />
        <div className="absolute top-0 bottom-0 w-px bg-red-500/30" style={{ left: "35%" }} title="REDUCE 35" />
        {/* Spread range bar */}
        <div
          className="absolute top-3 h-0.5 rounded-full opacity-40"
          style={{
            left: toX(minScore),
            width: `${spread}%`,
            backgroundColor: spreadColor,
          }}
        />
        {/* Constituent dots */}
        {scored.map((c, i) => {
          const isLeader = i === 0;
          const isLaggard = i === scored.length - 1;
          const pct = Math.round((c.compositeScore ?? 0) * 100);
          const dotColor = (c.compositeScore ?? 0) >= 0.65 ? "#34d399"
            : (c.compositeScore ?? 0) >= 0.50 ? "#22d3ee"
            : (c.compositeScore ?? 0) >= 0.35 ? "#fbbf24" : "#f87171";
          return (
            <div
              key={c.categoryId}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: toX(c.compositeScore!), transform: "translateX(-50%)" }}
              title={`${c.name}: ${pct}`}
            >
              <div
                className="w-2 h-2 rounded-full border border-slate-900"
                style={{ backgroundColor: dotColor }}
              />
              {(isLeader || isLaggard) && (
                <span
                  className="absolute text-[8px] font-mono whitespace-nowrap"
                  style={{
                    color: dotColor,
                    top: isLeader ? "-12px" : "20px",
                  }}
                >
                  {c.etfTicker} {pct}
                </span>
              )}
            </div>
          );
        })}
        {/* Axis labels */}
        <div className="absolute bottom-0 left-0 text-[7px] font-mono text-slate-700">0</div>
        <div className="absolute bottom-0 right-0 text-[7px] font-mono text-slate-700">100</div>
        <div className="absolute bottom-0 text-[7px] font-mono text-emerald-700/60" style={{ left: "65%", transform: "translateX(-50%)" }}>65</div>
        <div className="absolute bottom-0 text-[7px] font-mono text-red-700/60" style={{ left: "35%", transform: "translateX(-50%)" }}>35</div>
      </div>
    </div>
  );
}

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

function ThemeDetailAlerts({ alerts }: { alerts: AlertDto[] }) {
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
          const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
          const ruleLabel = RULE_LABELS[alert.ruleId] ?? alert.ruleId;
          return (
            <div key={alert.id} className="px-3 py-2 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sev.badge}`}>{alert.severity}</span>
                  <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">{ruleLabel}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{alert.message}</p>
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

const STATUS_CONFIG: Record<string, { label: string; dot: string; row: string }> = {
  ACTIVE:       { label: "ACTIVE",       dot: "bg-amber-400 animate-pulse", row: "" },
  RESOLVED:     { label: "RESOLVED",     dot: "bg-slate-500",               row: "opacity-60" },
  ACKNOWLEDGED: { label: "ACK",          dot: "bg-slate-600",               row: "opacity-50" },
};

function ThemeAlertHistory({ alerts }: { alerts: AlertDto[] }) {
  const resolved = alerts.filter(a => a.status !== "ACTIVE");
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
          const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
          const status = STATUS_CONFIG[alert.status] ?? STATUS_CONFIG.RESOLVED;
          const ruleLabel = RULE_LABELS[alert.ruleId] ?? alert.ruleId;
          const closedAt = alert.resolvedAt ?? alert.acknowledgedAt;
          return (
            <div key={alert.id} className={`px-3 py-2 flex items-start gap-3 ${status.row}`}>
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${status.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sev.badge}`}>{alert.severity}</span>
                  <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">{ruleLabel}</span>
                  <span className="text-[9px] font-mono text-slate-700 px-1.5 py-0.5 rounded bg-slate-800/40">{status.label}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{alert.message}</p>
              </div>
              <div className="text-right shrink-0 mt-0.5">
                <div className="text-[9px] font-mono text-slate-700">
                  {new Date(alert.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                </div>
                {closedAt && (
                  <div className="text-[9px] font-mono text-slate-800">
                    → {new Date(closedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelatedThemesPanel({
  currentThemeId,
  currentConstituents,
  allThemes,
}: {
  currentThemeId: string;
  currentConstituents: ThemeConstituent[];
  allThemes: ThemeSummary[];
}) {
  const currentTickers = new Set(currentConstituents.map(c => c.etfTicker));
  const related = allThemes
    .filter(t => t.id !== currentThemeId)
    .map(t => {
      const shared = t.topConstituents.filter(c => currentTickers.has(c.etfTicker));
      return { theme: t, sharedTickers: shared.map(c => c.etfTicker) };
    })
    .filter(r => r.sharedTickers.length > 0)
    .sort((a, b) => b.sharedTickers.length - a.sharedTickers.length);

  if (related.length === 0) return null;

  const SIGNAL_CONFIG_LOCAL: Record<string, string> = {
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
          const sigCls = SIGNAL_CONFIG_LOCAL[r.theme.dominantSignal] ?? SIGNAL_CONFIG_LOCAL.HOLD;
          const score = r.theme.compositeScore != null ? Math.round(r.theme.compositeScore * 100) : null;
          const scoreClr = r.theme.compositeScore == null ? "text-slate-500"
            : r.theme.compositeScore >= 0.65 ? "text-emerald-400"
            : r.theme.compositeScore >= 0.50 ? "text-cyan-400"
            : r.theme.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
          return (
            <div key={r.theme.id} className="flex items-center gap-3 flex-wrap">
              <Link href={`/themes/${r.theme.id}`} className="text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-colors min-w-0 shrink-0 max-w-[200px] truncate">
                {r.theme.name}
              </Link>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${sigCls}`}>{r.theme.dominantSignal}</span>
              {score != null && <span className={`text-[10px] font-mono shrink-0 ${scoreClr}`}>{score}</span>}
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
}

function AggMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const PHASE_CONFIG_DETAIL: Record<string, { label: string; className: string }> = {
  BREAKOUT:  { label: "↗ BREAKOUT",  className: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" },
  MOMENTUM:  { label: "↑ MOMENTUM",  className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25" },
  SETUP:     { label: "⬆ SETUP",     className: "bg-sky-500/15 text-sky-400 border border-sky-500/25" },
  BUILDING:  { label: "→ BUILDING",  className: "bg-slate-700/60 text-slate-400 border border-slate-600/40" },
  HOLDING:   { label: "■ HOLDING",   className: "bg-slate-700/40 text-slate-500 border border-slate-700/40" },
  FADING:    { label: "↓ FADING",    className: "bg-amber-500/15 text-amber-400 border border-amber-500/25" },
  DISTRIBUTE: { label: "↘ DISTRIBUTING", className: "bg-orange-500/15 text-orange-400 border border-orange-500/25" },
  WEAK:      { label: "↓ WEAK",      className: "bg-red-500/15 text-red-400 border border-red-500/25" },
};

interface ThemeData {
  compositeScore: number | null;
  flow20d: number | null;
  compositeTrend5d: number | null;
  compositeTrend20d: number | null;
  divergenceFromParentSectors: number | null;
  dominantSignal: string;
  themePhase: string | null;
}

function computeWatchGuidance(theme: ThemeData): string | null {
  const score = theme.compositeScore;
  const phase = theme.themePhase;
  if (!score || !phase) return null;

  const buyDistance = score < 0.65 ? Math.round((0.65 - score) * 100) : null;
  const accel = theme.compositeTrend5d != null && theme.compositeTrend20d != null
    ? ((theme.compositeTrend5d - theme.compositeTrend20d) * 100).toFixed(1)
    : null;

  switch (phase) {
    case "BREAKOUT":
      return `In BREAKOUT — accelerating above BUY threshold. Watch for score to hold above 65 on any pullback. Flow of ${theme.flow20d != null ? theme.flow20d.toFixed(1) + "σ" : "—"} must stay positive to confirm regime.`;
    case "MOMENTUM":
      return `In sustained MOMENTUM. Watch divergence from sectors (currently ${theme.divergenceFromParentSectors != null ? (theme.divergenceFromParentSectors * 100).toFixed(0) + "pt" : "—"}) — a drop below 0 may signal rotation out.`;
    case "SETUP":
      return `SETUP phase — ${buyDistance}pt from BUY trigger at 65. 5d is accelerating vs 20d (${accel ? "+" + accel + "pt/day" : "—"}). Watch for score to break through 65 with sustained flow.`;
    case "BUILDING":
      return buyDistance != null
        ? `Building conviction — ${buyDistance}pt from BUY trigger. Needs flow surge or catalyst to break through.`
        : `Building toward next level. Monitor for flow and trend direction change.`;
    case "HOLDING":
      return `Holding BUY territory but momentum is flat. Watch for re-acceleration (5d > 20d) or a flow increase before adding exposure.`;
    case "DISTRIBUTE":
      return `Potentially topping — score in BUY but flow is turning negative. Consider trimming or tightening stops. Distribution phase often precedes a pullback to 50-60.`;
    case "FADING":
      return `Momentum is fading. Watch the 50 level — if score breaks below, signal may downgrade to HOLD or REDUCE. Avoid new entries until trend stabilizes.`;
    case "WEAK":
      return `Weak conviction zone (below 35). Avoid new exposure. Watch for a score base above 35 before reconsidering.`;
    default:
      return null;
  }
}

const HISTORY_PERIODS = [30, 60, 90, 120, 180] as const;

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

function phaseFromHistory(score: number, trend5d: number, trend20d: number): string {
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

function PhaseTimelineStrip({ history }: { history: ThemeHistoryPoint[] }) {
  if (history.length < 22) return null;
  const scores = history.map(h => h.compositeScore);
  const phases: string[] = [];
  for (let i = 0; i < scores.length; i++) {
    if (i < 20) { phases.push("NEUTRAL"); continue; }
    // Prefer actual backend trends; fall back to derived slopes if absent
    const trend5d = history[i].trend5d ?? (scores[i] - scores[i - 5]) / 5;
    const trend20d = history[i].trend20d ?? (scores[i] - scores[i - 20]) / 20;
    phases.push(phaseFromHistory(scores[i], trend5d, trend20d));
  }

  // Build contiguous segments from the valid range (index 20+)
  const segments: { phase: string; start: number; end: number; date: string }[] = [];
  let seg = { phase: phases[20], start: 20, end: 20, date: history[20].date };
  for (let i = 21; i < phases.length; i++) {
    if (phases[i] === seg.phase) {
      seg.end = i;
    } else {
      segments.push({ ...seg });
      seg = { phase: phases[i], start: i, end: i, date: history[i].date };
    }
  }
  segments.push({ ...seg });

  const totalDays = phases.length - 20;
  const lastThreeSegments = segments.slice(-4);

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Phase Timeline</div>
      <div className="flex h-4 rounded overflow-hidden gap-px mb-2">
        {segments.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${((s.end - s.start + 1) / totalDays) * 100}%`,
              backgroundColor: (PHASE_COLORS[s.phase] ?? "#334155") + "99",
            }}
            title={`${s.phase}: ${s.date} (${s.end - s.start + 1} days)`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {lastThreeSegments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-700 text-[9px]">→</span>}
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: PHASE_COLORS[s.phase] ?? "#64748b",
                backgroundColor: (PHASE_COLORS[s.phase] ?? "#334155") + "22",
                border: `1px solid ${(PHASE_COLORS[s.phase] ?? "#334155")}44`,
              }}
            >
              {s.phase}
            </span>
            <span className="text-[9px] text-slate-600 font-mono">{s.end - s.start + 1}d</span>
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
}

export default async function ThemeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const { days: daysParam } = await searchParams;
  const days = HISTORY_PERIODS.includes(Number(daysParam) as typeof HISTORY_PERIODS[number])
    ? Number(daysParam)
    : 30;

  let theme;
  try {
    theme = await fetchTheme(id.toUpperCase());
  } catch {
    notFound();
  }

  const [history, allThemes, alertsResponse, alertHistory] = await Promise.all([
    fetchThemeHistory(id.toUpperCase(), days).catch(() => []),
    fetchThemes().catch(() => []),
    fetchAlerts().catch(() => ({ activeCount: 0, alerts: [] })),
    fetchThemeAlertHistory(id.toUpperCase()).catch(() => []),
  ]);

  const themeAlerts = alertsResponse.alerts.filter(
    a => a.themeId === id.toUpperCase() && a.status === "ACTIVE"
  );

  const signal = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;

  const isCrowded =
    theme.dominantSignal === "BUY" &&
    (theme.compositeScore ?? 0) >= 0.65 &&
    (theme.flow20d ?? 0) >= 1.5 &&
    (theme.divergenceFromParentSectors ?? 0) >= 0.08;

  const watchGuidance = computeWatchGuidance(theme);

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-1">
          <Link href="/themes" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">
            ← Themes
          </Link>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h1 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
                {theme.name}
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{theme.thesis}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <ThemeScoreGauge score={theme.compositeScore} signal={theme.dominantSignal} />
              <span className={`text-xs font-semibold px-2.5 py-1 rounded ${signal.bg} ${signal.color}`}>
                {signal.label}
              </span>
              {theme.themePhase && PHASE_CONFIG_DETAIL[theme.themePhase] && (
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${PHASE_CONFIG_DETAIL[theme.themePhase].className}`}>
                  {PHASE_CONFIG_DETAIL[theme.themePhase].label}
                </span>
              )}
              {isCrowded && (
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30"
                  title="Score ≥65, flow ≥1.5σ, divergence ≥+8pt — all signals agree: potentially crowded. Consider sizing conservatively."
                >
                  ⚠ Crowded Trade
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-6 flex-wrap">
            <AggMetric label="Composite">
              {theme.compositeScore != null ? (
                <span className={`text-base font-bold font-mono ${
                  theme.compositeScore >= 0.65 ? "text-emerald-400"
                  : theme.compositeScore >= 0.50 ? "text-cyan-400"
                  : theme.compositeScore >= 0.35 ? "text-amber-400"
                  : "text-red-400"
                }`}>
                  {Math.round(theme.compositeScore * 100)}
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Avg RS-60">
              {theme.rs60 != null ? (
                <span className={`text-base font-bold font-mono ${theme.rs60 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {theme.rs60 > 0 ? "+" : ""}{(theme.rs60 * 100).toFixed(1)}%
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Flow 20d">
              {theme.flow20d != null ? (
                <span className={`text-base font-bold font-mono ${theme.flow20d > 0.3 ? "text-emerald-400" : theme.flow20d < -0.3 ? "text-red-400" : "text-slate-400"}`}>
                  {theme.flow20d > 0 ? "+" : ""}{theme.flow20d.toFixed(2)}σ
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Momentum">
              {theme.compositeTrend20d != null ? (
                <span className={`text-base font-bold font-mono ${theme.compositeTrend20d > 0.005 ? "text-emerald-400" : theme.compositeTrend20d < -0.005 ? "text-red-400" : "text-slate-400"}`}>
                  {theme.compositeTrend20d > 0 ? "↑" : theme.compositeTrend20d < 0 ? "↓" : "→"}
                  {" "}<span className="text-[11px]">{Math.round(Math.abs(theme.compositeTrend20d) * 1000)}‰</span>
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            {theme.compositeTrend5d != null && theme.compositeTrend20d != null && (
              <AggMetric label="Velocity">
                {(() => {
                  const delta = theme.compositeTrend5d - theme.compositeTrend20d;
                  const isAccel = delta > 0.002;
                  const isDecel = delta < -0.002;
                  return (
                    <span className={`text-base font-bold font-mono ${isAccel ? "text-emerald-400" : isDecel ? "text-red-400" : "text-slate-400"}`}
                      title={`5d trend ${theme.compositeTrend5d > 0 ? "+" : ""}${(theme.compositeTrend5d * 100).toFixed(1)}pt vs 20d ${theme.compositeTrend20d > 0 ? "+" : ""}${(theme.compositeTrend20d * 100).toFixed(1)}pt`}
                    >
                      {isAccel ? "⬆" : isDecel ? "⬇" : "◆"}
                    </span>
                  );
                })()}
              </AggMetric>
            )}
            <AggMetric label="Bullish">
              <span className="text-base font-bold font-mono text-slate-300">
                {theme.bullishCount}/{theme.constituentCount}
              </span>
            </AggMetric>
            {theme.divergenceFromParentSectors != null && (
              <AggMetric label="vs Sectors">
                <span
                  className={`text-base font-bold font-mono ${
                    theme.divergenceFromParentSectors > 0.02 ? "text-emerald-400"
                    : theme.divergenceFromParentSectors < -0.02 ? "text-red-400"
                    : "text-slate-400"
                  }`}
                  title="Theme composite minus average parent-sector composite. Positive = theme sub-sectors outpacing their broad sector — early rotation signal."
                >
                  {theme.divergenceFromParentSectors > 0 ? "+" : ""}
                  {Math.round(theme.divergenceFromParentSectors * 100)}pt
                </span>
              </AggMetric>
            )}
          </div>
          <SignalDistributionBar constituents={theme.constituents} />
          <ConstituentScoreSpread constituents={theme.constituents} />
          {watchGuidance && (
            <div className="mt-3 pt-3 border-t border-slate-700/40">
              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mr-2">What to watch</span>
              <span className="text-[11px] text-slate-400 leading-relaxed">{watchGuidance}</span>
            </div>
          )}
        </div>

        {themeAlerts.length > 0 && <ThemeDetailAlerts alerts={themeAlerts} />}
        <ThemeAlertHistory alerts={alertHistory} />

        <HistoryChartSection history={history} days={days} themeId={id.toUpperCase()} />
        <PhaseTimelineStrip history={history} />

        {allThemes.length > 1 && (
          <RelatedThemesPanel
            currentThemeId={id.toUpperCase()}
            currentConstituents={theme.constituents}
            allThemes={allThemes}
          />
        )}

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">#</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">ETF</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sector</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Score</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">RS-60</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Flow</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500" title="5-day composite trend">5d</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500" title="20-day composite trend">20d</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Signal</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Conv</th>
              </tr>
            </thead>
            <tbody>
              {[...theme.constituents]
                .sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1))
                .map((c, i) => (
                  <ConstituentRow key={c.categoryId} c={c} index={i} />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
