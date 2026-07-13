import { CategorySummary, RotationEventEntry, RotationLeaderEntry } from "@/lib/api";
import { formatRs } from "@/lib/flows/flowMetrics";
import { computeBreadthVelocity } from "@/lib/signals";

/** The row types the capital-flows page stacks inside its panels. */

export const QUADRANT_CONFIG: Record<string, { label: string; colorClass: string; badgeClass: string }> = {
  "4": { label: "↗ Leading",   colorClass: "text-green-400",  badgeClass: "bg-green-500/10 text-green-400 border border-green-500/25" },
  "3": { label: "↖ Improving", colorClass: "text-cyan-400",   badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25" },
  "2": { label: "↘ Weakening", colorClass: "text-orange-400", badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/25" },
  "1": { label: "↙ Lagging",   colorClass: "text-slate-400",  badgeClass: "bg-slate-500/15 text-slate-400 border border-slate-500/30" },
};

const EVENT_LABELS: Record<string, { label: string; colorClass: string }> = {
  ENTERING_IMPROVING:  { label: "↑ Lagging→Improving",  colorClass: "text-cyan-400"   },
  ENTERING_LEADING:    { label: "↗ Improving→Leading",  colorClass: "text-green-400"  },
  ENTERING_WEAKENING:  { label: "↘ Leading→Weakening",  colorClass: "text-orange-400" },
  ENTERING_LAGGING:    { label: "↙ Weakening→Lagging",  colorClass: "text-slate-400"  },
  COMPOSITE_BREAKOUT:  { label: "★ Composite Breakout",  colorClass: "text-yellow-400" },
  COMPOSITE_BREAKDOWN: { label: "▼ Composite Breakdown", colorClass: "text-red-400"    },
  FLOW_SURGE:          { label: "⚡ Flow Surge",          colorClass: "text-blue-400"   },
};

const MONO = { fontFamily: "var(--font-jetbrains-mono)" };
const DISPLAY = { fontFamily: "var(--font-rajdhani)" };

export const LeaderRow = ({ entry, isLeader }: { entry: RotationLeaderEntry; isLeader: boolean }) => {
  const quadrantKey = entry.relativeRotationGraphQuadrant?.toString() ?? null;
  const quadrant = quadrantKey ? QUADRANT_CONFIG[quadrantKey] : null;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-700/30 last:border-0">
      <span className="flex-1 text-sm text-slate-200 truncate">{entry.categoryName}</span>
      {quadrant && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${quadrant.badgeClass}`}
          style={{ ...DISPLAY, letterSpacing: "0.02em" }}
        >
          {quadrant.label}
        </span>
      )}
      <span
        className={`text-xs tabular-nums shrink-0 w-14 text-right ${
          entry.relativeStrength60Day === null
            ? "text-slate-600"
            : isLeader
            ? "text-green-400"
            : "text-red-400"
        }`}
        style={MONO}
      >
        {formatRs(entry.relativeStrength60Day)}
      </span>
    </div>
  );
};

const rsBarTitle = (rs60: number | null, rs120: number | null, acceleration: number | null) =>
  `RS-60: ${rs60 != null ? (rs60 > 0 ? "+" : "") + rs60.toFixed(1) + "%" : "—"}` +
  `${rs120 != null ? " · RS-120: " + (rs120 > 0 ? "+" : "") + rs120.toFixed(1) + "%" : ""}` +
  `${acceleration != null ? " · Accel: " + (acceleration > 0 ? "+" : "") + acceleration.toFixed(1) + "pts" : ""}`;

export const RsBarRow = ({ category, maxAbs }: { category: CategorySummary; maxAbs: number }) => {
  const rs60 = category.rs60 !== null ? category.rs60 * 100 : null;
  const rs120 = category.rs120 !== null ? category.rs120 * 100 : null;
  const barWidth = rs60 !== null && maxAbs > 0 ? Math.min(Math.abs(rs60) / maxAbs, 1) * 100 : 0;
  const referenceTickWidth = rs120 !== null && maxAbs > 0 ? Math.min(Math.abs(rs120) / maxAbs, 1) * 100 : null;
  const isPositive = rs60 !== null && rs60 > 0;
  const quadrant = category.rrgQuadrant ? QUADRANT_CONFIG[category.rrgQuadrant] : null;
  const acceleration = rs60 !== null && rs120 !== null ? rs60 - rs120 : null;
  const accelerationClass =
    acceleration === null ? "" : acceleration > 0.1 ? "text-emerald-400" : acceleration < -0.1 ? "text-red-400" : "text-slate-500";

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-700/20 last:border-0">
      <div className="w-44 shrink-0">
        <span className="text-sm text-slate-300 truncate block">{category.name}</span>
      </div>
      <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={MONO}>
        {category.etfTicker}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div
          className="relative flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden"
          title={rsBarTitle(rs60, rs120, acceleration)}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              rs60 === null ? "bg-slate-600" : isPositive ? "bg-emerald-500" : "bg-red-500"
            }`}
            style={{ width: `${barWidth}%` }}
          />
          {referenceTickWidth !== null && (
            <div
              className="absolute inset-y-0 w-0.5 bg-white/30 rounded-full"
              style={{ left: `${referenceTickWidth}%` }}
            />
          )}
        </div>
        <span
          className={`text-xs tabular-nums w-14 text-right shrink-0 ${
            rs60 === null ? "text-slate-600" : isPositive ? "text-emerald-400" : "text-red-400"
          }`}
          style={MONO}
        >
          {rs60 === null ? "—" : `${isPositive ? "+" : ""}${rs60.toFixed(1)}%`}
        </span>
        {acceleration !== null && (
          <span
            className={`text-[9px] tabular-nums w-10 text-right shrink-0 ${accelerationClass}`}
            title="RS acceleration: RS-60 minus RS-120 (positive = improving vs long-term)"
            style={MONO}
          >
            {acceleration > 0 ? "↗" : acceleration < 0 ? "↘" : "→"}
            {Math.abs(acceleration) >= 0.1 ? Math.abs(acceleration).toFixed(1) : ""}
          </span>
        )}
      </div>
      {quadrant && (
        <span className={`text-[10px] shrink-0 w-24 text-right ${quadrant.colorClass}`} style={DISPLAY}>
          {quadrant.label}
        </span>
      )}
    </div>
  );
};

const BreadthVelocityMark = ({ category }: { category: CategorySummary }) => {
  const velocity = computeBreadthVelocity(category.persistence5d, category.persistence20d);
  if (!velocity) return <span className="w-3 shrink-0" />;
  const { recentRate, priorRate, changeInPercentagePoints } = velocity;
  const isAccelerating = changeInPercentagePoints > 0;
  return (
    <span
      className={`text-[9px] shrink-0 ${isAccelerating ? "text-emerald-400" : "text-red-400"}`}
      title={`Breadth velocity: recent-5d ${Math.round(recentRate * 100)}% vs prior-15d ${Math.round(priorRate * 100)}% (${changeInPercentagePoints > 0 ? "+" : ""}${changeInPercentagePoints}pp)`}
    >
      {isAccelerating ? "⚡" : "⬇"}
    </span>
  );
};

export const FlowSignalRow = ({ category, maxAbsZ }: { category: CategorySummary; maxAbsZ: number }) => {
  const flowZScore = category.flow20d;
  const breadth = category.persistence20d;
  if (flowZScore === null && breadth === null) return null;

  const barWidth = maxAbsZ > 0 ? Math.min(Math.abs(flowZScore ?? 0) / maxAbsZ, 1) * 100 : 0;
  const isInflow = (flowZScore ?? 0) >= 0;
  const breadthPercent = breadth != null ? Math.round((breadth / 20) * 100) : null;

  const flowColor =
    flowZScore == null ? "text-slate-600"
    : Math.abs(flowZScore) < 0.5 ? "text-slate-400"
    : isInflow ? "text-emerald-400" : "text-red-400";
  const barColor = flowZScore == null ? "bg-slate-700" : isInflow ? "bg-emerald-500" : "bg-red-500";
  const breadthColor =
    breadth == null ? "text-slate-600"
    : breadth >= 14 ? "text-emerald-400"
    : breadth >= 8 ? "text-slate-400" : "text-red-400";

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-700/20 last:border-0">
      <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={MONO}>
        {category.etfTicker}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
        <span className={`text-xs tabular-nums w-12 text-right shrink-0 ${flowColor}`} style={MONO}>
          {flowZScore == null ? "—" : `${isInflow ? "+" : ""}${flowZScore.toFixed(2)}σ`}
        </span>
      </div>
      <span
        className={`text-xs tabular-nums shrink-0 ${breadthColor}`}
        style={MONO}
        title={`Breadth: ${breadth != null ? `${breadth}/20 days outperformed benchmark` : "n/a"}`}
      >
        {breadth != null ? `${breadth}/20` : "—"}
        {breadthPercent != null && <span className="text-slate-600 text-[9px] ml-0.5">({breadthPercent}%)</span>}
      </span>
      <BreadthVelocityMark category={category} />
    </div>
  );
};

export const EventRow = ({ event }: { event: RotationEventEntry }) => {
  const config = EVENT_LABELS[event.eventType];
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-700/30 last:border-0">
      <span className="text-slate-500 text-[11px] tabular-nums shrink-0 pt-0.5 w-24" style={MONO}>
        {event.detectedDate}
      </span>
      <span
        className={`text-[11px] shrink-0 font-semibold ${config?.colorClass ?? "text-slate-400"}`}
        style={{ ...DISPLAY, letterSpacing: "0.02em" }}
      >
        {config?.label ?? event.eventType}
      </span>
      <span className="text-sm text-slate-300 shrink-0">{event.categoryName}</span>
      {event.notes && <span className="text-xs text-slate-500 ml-auto text-right max-w-xs">{event.notes}</span>}
    </div>
  );
};
