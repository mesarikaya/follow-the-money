import Link from "next/link";
import { AlertDto, CategorySummary } from "@/lib/api";
import { SubSectorBreakdown, rsHorizonAlignment, worstSeverity } from "@/lib/sectors/sectorMetrics";
import { TradeSignal, computeBreadthVelocity, deriveTradeSignal } from "@/lib/signals";
import Sparkline from "@/components/Sparkline";

/** One sector tile on the sectors hub: headline signal, stats, breadth and drill-down link. */

const MONO = { fontFamily: "var(--font-jetbrains-mono)" };
const DISPLAY = { fontFamily: "var(--font-rajdhani)" };

export const QUADRANT_CONFIG: Record<string, { label: string; badgeClass: string; leftBorderClass: string }> = {
  "4": { label: "↗ Leading",   badgeClass: "bg-green-500/10 text-green-400 border border-green-500/25",   leftBorderClass: "border-l-green-500"  },
  "3": { label: "↖ Improving", badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25",      leftBorderClass: "border-l-cyan-500"   },
  "2": { label: "↘ Weakening", badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/25", leftBorderClass: "border-l-orange-500" },
  "1": { label: "↙ Lagging",   badgeClass: "bg-slate-500/15 text-slate-400 border border-slate-500/30",   leftBorderClass: "border-l-slate-600"  },
};

const TRADE_SIGNAL_BADGE: Record<TradeSignal, { label: string; className: string }> = {
  BUY:    { label: "BUY",    className: "bg-green-900/60 text-green-300 border-green-700/60" },
  WATCH:  { label: "WATCH",  className: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50"   },
  HOLD:   { label: "HOLD",   className: "bg-slate-700/60 text-slate-400 border-slate-600/60" },
  REDUCE: { label: "REDUCE", className: "bg-red-900/50 text-red-400 border-red-700/50"      },
};

const ALERT_SEVERITY_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  URGENT:  { dot: "bg-red-400",   text: "text-red-300",   bg: "bg-red-900/30 border-red-700/50"     },
  ACTION:  { dot: "bg-red-500",   text: "text-red-400",   bg: "bg-red-900/20 border-red-800/40"     },
  WARNING: { dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-900/20 border-amber-700/40" },
  INFO:    { dot: "bg-blue-400",  text: "text-blue-300",  bg: "bg-blue-900/20 border-blue-700/40"   },
};

const VELOCITY_SURGE_THRESHOLD = 0.12;

const StatLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-widest" style={MONO}>
    {children}
  </div>
);

const NoStat = ({ label }: { label: string }) => (
  <div className="text-center">
    <StatLabel>{label}</StatLabel>
    <div className="text-xs text-slate-600" style={MONO}>—</div>
  </div>
);

const RsStat = ({ label, value, rs120 }: { label: string; value: number | null; rs120?: number | null }) => {
  if (value == null) return <NoStat label={label} />;
  const colorClass = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const acceleration = rs120 != null ? value - rs120 : null;
  const isAccelerating = acceleration != null && acceleration > 0.001;
  const isDecelerating = acceleration != null && acceleration < -0.001;
  return (
    <div className="text-center">
      <StatLabel>{label}</StatLabel>
      <div className="flex items-center justify-center gap-1">
        <span className={`text-sm font-medium tabular-nums ${colorClass}`} style={MONO}>
          {value > 0 ? "+" : ""}{(value * 100).toFixed(1)}%
        </span>
        {acceleration != null && Math.abs(acceleration) > 0.001 && (
          <span
            className={`text-[10px] ${isAccelerating ? "text-emerald-400" : "text-red-400"}`}
            title={`RS acceleration vs 120d: ${acceleration > 0 ? "+" : ""}${(acceleration * 100).toFixed(1)}pts`}
          >
            {isAccelerating ? "↗" : isDecelerating ? "↘" : "→"}
          </span>
        )}
      </div>
    </div>
  );
};

const TrendPip = ({ value, label }: { value: number | null; label: string }) => {
  if (value == null) return null;
  const magnitude = Math.round(Math.abs(value * 100));
  const isUp = value > 0.005;
  const isDown = value < -0.005;
  return (
    <span
      className={`text-[9px] ${isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500"} tabular-nums`}
      style={MONO}
      title={`${label}: ${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}pt`}
    >
      {isUp ? "↑" : isDown ? "↓" : "→"}{magnitude > 0 ? magnitude : ""}
    </span>
  );
};

const ScoreStat = ({ value, trend5d, trend20d }: { value: number | null; trend5d: number | null; trend20d: number | null }) => {
  if (value == null) return <NoStat label="Score" />;
  const colorClass = value >= 0.7 ? "text-green-400" : value >= 0.4 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="text-center">
      <StatLabel>Score</StatLabel>
      <div className={`text-sm font-medium tabular-nums ${colorClass}`} style={MONO}>
        {Math.round(value * 100)}/100
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        <TrendPip value={trend5d} label="5d trend" />
        <TrendPip value={trend20d} label="20d trend" />
      </div>
    </div>
  );
};

const RankStat = ({ rank }: { rank: number }) => (
  <div className="text-center">
    <StatLabel>Rank</StatLabel>
    <div
      className={`text-sm font-medium tabular-nums ${rank <= 3 ? "text-green-400" : rank <= 8 ? "text-yellow-400" : "text-slate-400"}`}
      style={MONO}
    >
      #{rank}
    </div>
  </div>
);

const MacroFitBar = ({ macroFit }: { macroFit: number }) => {
  const percent = Math.round(macroFit * 100);
  const isStrong = macroFit >= 0.6;
  const isModerate = macroFit >= 0.4;
  return (
    <div
      className="flex items-center gap-2 flex-1"
      title={`Macro Fit: ${percent}% — historical RS win rate in the current macro regime`}
    >
      <span className="text-[9px] text-slate-600 uppercase tracking-widest shrink-0" style={MONO}>Regime</span>
      <div className="flex-1 h-1 rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${isStrong ? "bg-violet-500" : isModerate ? "bg-violet-400/60" : "bg-slate-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`text-[9px] tabular-nums shrink-0 ${isStrong ? "text-violet-400" : isModerate ? "text-violet-500" : "text-slate-600"}`}
        style={MONO}
      >
        {percent}%
      </span>
    </div>
  );
};

const PersistenceChip = ({ sector }: { sector: CategorySummary }) => {
  const breadth = sector.persistence20d;
  if (breadth == null) return null;
  const velocity = computeBreadthVelocity(sector.persistence5d, breadth);
  const velocityIcon = velocity ? (velocity.changeInPercentagePoints > 0 ? "⚡" : "⬇") : null;
  const velocityTitle = velocity
    ? ` · ${velocity.changeInPercentagePoints > 0 ? "+" : ""}${velocity.changeInPercentagePoints}pp breadth velocity`
    : "";
  const strength = breadth >= 12 ? "strong" : breadth >= 7 ? "moderate" : "weak";
  return (
    <span
      className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
        breadth >= 12 ? "text-cyan-400 bg-cyan-900/20"
        : breadth >= 7 ? "text-slate-500 bg-slate-700/20"
        : "text-orange-400 bg-orange-900/20"
      }`}
      title={`Persistence: ${breadth}/20 trading days beat benchmark (${strength})${velocityTitle}`}
    >
      P{breadth}/20{velocityIcon && <span className="ml-0.5">{velocityIcon}</span>}
    </span>
  );
};

const FlowChip = ({ flow20d }: { flow20d: number }) => (
  <span
    className={`text-[10px] tabular-nums px-1 py-0.5 rounded ${
      Math.abs(flow20d) < 0.5 ? "text-slate-500"
      : flow20d > 0 ? "text-emerald-400 bg-emerald-900/20"
      : "text-red-400 bg-red-900/20"
    }`}
    title={`Flow z-score (20d): ${flow20d > 0 ? "+" : ""}${flow20d.toFixed(2)}σ`}
    style={MONO}
  >
    {flow20d > 0 ? "⊕" : "⊖"}{Math.abs(flow20d).toFixed(1)}σ
  </span>
);

const RsAlignmentChip = ({ sector }: { sector: CategorySummary }) => {
  const alignment = rsHorizonAlignment(sector);
  if (!alignment) return null;
  const isBullish = alignment === "BULLISH";
  return (
    <span
      className={`text-[10px] font-mono px-1 py-0.5 rounded ${isBullish ? "text-emerald-400 bg-emerald-900/20" : "text-red-400 bg-red-900/20"}`}
      title={
        isBullish
          ? "RS-20 > RS-60 > RS-120 — all horizons bullishly aligned"
          : "RS-20 < RS-60 < RS-120 — all horizons bearishly aligned"
      }
    >
      {isBullish ? "⊕RS" : "⊖RS"}
    </span>
  );
};

const ScoreVelocityChip = ({ trend5d }: { trend5d: number | null }) => {
  const velocity = trend5d ?? 0;
  const isSurge = velocity >= VELOCITY_SURGE_THRESHOLD;
  const isCrash = velocity <= -VELOCITY_SURGE_THRESHOLD;
  if (!isSurge && !isCrash) return null;
  return (
    <span
      className={`text-[10px] font-bold px-1 py-0.5 rounded ${
        isSurge
          ? "text-emerald-300 bg-emerald-900/30 border border-emerald-700/40"
          : "text-red-300 bg-red-900/30 border border-red-700/40"
      }`}
      title={`Score velocity ${isSurge ? "SURGE" : "CRASH"}: ${isSurge ? "+" : ""}${Math.round(velocity * 100)}pts in 5 days`}
    >
      {isSurge ? "⚡" : "⚠"}
    </span>
  );
};

const AlertChip = ({ alerts }: { alerts: AlertDto[] }) => {
  const severity = worstSeverity(alerts);
  const style = severity ? ALERT_SEVERITY_COLORS[severity] : null;
  if (alerts.length === 0 || !style) return null;
  return (
    <span
      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${style.bg}`}
      title={`${alerts.length} active alert${alerts.length > 1 ? "s" : ""} (worst: ${severity}) — click to see on alerts page`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className={style.text}>{alerts.length}</span>
    </span>
  );
};

const SubSectorBreadthBar = ({ breakdown }: { breakdown: SubSectorBreakdown }) => {
  const { leading, improving, weakening, lagging, noData, total } = breakdown;
  if (total === 0) return null;
  const withData = total - noData;
  const bullish = leading + improving;
  const bullishPercent = withData > 0 ? Math.round((bullish / withData) * 100) : null;

  const segments = [
    { count: leading,   color: "bg-green-500",     label: `↗ Leading: ${leading}` },
    { count: improving, color: "bg-cyan-500",      label: `↖ Improving: ${improving}` },
    { count: weakening, color: "bg-orange-500/70", label: `↘ Weakening: ${weakening}` },
    { count: lagging,   color: "bg-slate-600",     label: `↙ Lagging: ${lagging}` },
    { count: noData,    color: "bg-slate-800",     label: `No signal: ${noData}` },
  ].filter(segment => segment.count > 0);

  const title =
    `Sub-sector breadth: ${bullish}/${withData > 0 ? withData : total} bullish` +
    `${bullishPercent != null ? ` (${bullishPercent}%)` : ""}` +
    ` · Leading: ${leading} Improving: ${improving} Weakening: ${weakening} Lagging: ${lagging}` +
    `${noData > 0 ? ` No signal: ${noData}` : ""}`;

  const breadthColor =
    bullishPercent == null ? "text-slate-600"
    : bullishPercent >= 60 ? "text-green-400"
    : bullishPercent >= 40 ? "text-amber-400"
    : "text-red-400";

  return (
    <div className="mt-1" title={title}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[9px] text-slate-600 uppercase tracking-wider shrink-0" style={MONO}>Sub-breadth</span>
        {bullishPercent != null && (
          <span className={`text-[9px] tabular-nums font-semibold ${breadthColor}`} style={MONO}>
            {bullishPercent}% bullish
          </span>
        )}
        {noData === total && <span className="text-[9px] text-slate-600">no signals yet</span>}
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-slate-900" title={title}>
        {segments.map(segment => (
          <div
            key={segment.label}
            className={`${segment.color} transition-all`}
            style={{ width: `${((segment.count / total) * 100).toFixed(1)}%` }}
            title={segment.label}
          />
        ))}
      </div>
    </div>
  );
};

export const SectorCard = ({
  sector,
  history,
  subSectorCount,
  sectorAlerts,
  subSectorBreakdown,
}: {
  sector: CategorySummary;
  history: number[];
  subSectorCount: number;
  sectorAlerts: AlertDto[];
  subSectorBreakdown: SubSectorBreakdown;
}) => {
  const quadrant = sector.rrgQuadrant ? QUADRANT_CONFIG[sector.rrgQuadrant] : null;
  const signal = (sector.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(sector);
  const signalBadge = signal ? TRADE_SIGNAL_BADGE[signal] : null;

  return (
    <Link
      href={`/sectors/${sector.id}`}
      className={`group block rounded-xl border border-slate-700/60 border-l-4 ${quadrant?.leftBorderClass ?? "border-l-slate-700"} bg-gradient-to-br from-slate-800/80 to-slate-900/60 hover:from-slate-800 hover:to-slate-900 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 p-4`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-white text-base leading-tight font-semibold" style={{ ...DISPLAY, letterSpacing: "0.02em" }}>
            {sector.name}
          </h3>
          <span
            className="mt-1 inline-block text-xs text-cyan-400 bg-cyan-500/8 border border-cyan-500/20 px-1.5 py-0.5 rounded"
            style={MONO}
          >
            {sector.etfTicker}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {signalBadge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${signalBadge.className}`}
              style={{ ...DISPLAY, letterSpacing: "0.06em" }}
              title={`Trade signal: ${signal}`}
            >
              {signalBadge.label}
            </span>
          )}
          {quadrant ? (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${quadrant.badgeClass}`}
              style={{ ...DISPLAY, letterSpacing: "0.02em" }}
            >
              {quadrant.label}
            </span>
          ) : (
            <span className="text-slate-600 text-[10px]">—</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2 py-2 border-y border-slate-700/40">
        <ScoreStat value={sector.compositeScore} trend5d={sector.compositeTrend5d} trend20d={sector.compositeTrend20d} />
        <RsStat label="RS 60d" value={sector.rs60} rs120={sector.rs120} />
        <RankStat rank={sector.rank} />
      </div>

      {(sector.macroFit != null || sector.persistence20d != null) && (
        <div className="flex items-center gap-3 mb-2 pt-1">
          {sector.macroFit != null && <MacroFitBar macroFit={sector.macroFit} />}
          <PersistenceChip sector={sector} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {history.length >= 2 && <Sparkline values={history} width={48} height={16} />}
          <span className="text-[11px] text-slate-500" style={MONO}>
            {subSectorCount} sub-sectors
          </span>
          {sector.flow20d != null && <FlowChip flow20d={sector.flow20d} />}
          <RsAlignmentChip sector={sector} />
          <ScoreVelocityChip trend5d={sector.compositeTrend5d} />
          <AlertChip alerts={sectorAlerts} />
        </div>
        <span className="text-[11px] text-slate-600 group-hover:text-cyan-400 transition-colors" style={MONO}>
          → drill down
        </span>
      </div>

      <SubSectorBreadthBar breakdown={subSectorBreakdown} />
    </Link>
  );
};
