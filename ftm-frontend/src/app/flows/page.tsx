import {
  fetchRotation,
  fetchCategories,
  RotationLeaderEntry,
  RotationEventEntry,
  CategorySummary,
} from "@/lib/api";

export const dynamic = "force-dynamic";

const QUADRANT_CONFIG: Record<string, { label: string; colorClass: string; badgeClass: string }> = {
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

function formatRs(value: number | null): string {
  if (value === null) return "—";
  const pct = (value * 100).toFixed(1);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}

function LeaderRow({ entry, isLeader }: { entry: RotationLeaderEntry; isLeader: boolean }) {
  const qKey = entry.relativeRotationGraphQuadrant?.toString() ?? null;
  const qConfig = qKey ? QUADRANT_CONFIG[qKey] : null;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-700/30 last:border-0">
      <span className="flex-1 text-sm text-slate-200 truncate">{entry.categoryName}</span>
      {qConfig && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${qConfig.badgeClass}`}
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
        >
          {qConfig.label}
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
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {formatRs(entry.relativeStrength60Day)}
      </span>
    </div>
  );
}

function RsBarRow({ category, maxAbs }: { category: CategorySummary; maxAbs: number }) {
  const pct = category.rs60 !== null ? category.rs60 * 100 : null;
  const pct120 = category.rs120 !== null ? category.rs120 * 100 : null;
  const barWidth = pct !== null && maxAbs > 0 ? Math.min(Math.abs(pct) / maxAbs, 1) * 100 : 0;
  const bar120Width = pct120 !== null && maxAbs > 0 ? Math.min(Math.abs(pct120) / maxAbs, 1) * 100 : null;
  const isPositive = pct !== null && pct > 0;
  const qConfig = category.rrgQuadrant ? QUADRANT_CONFIG[category.rrgQuadrant] : null;
  const accel = pct !== null && pct120 !== null ? pct - pct120 : null;
  const accelClass = accel === null ? "" : accel > 0.1 ? "text-emerald-400" : accel < -0.1 ? "text-red-400" : "text-slate-500";

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-700/20 last:border-0">
      <div className="w-44 shrink-0">
        <span className="text-sm text-slate-300 truncate block">{category.name}</span>
      </div>
      <span
        className="text-[10px] text-cyan-400 w-10 shrink-0"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {category.etfTicker}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="relative flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden"
          title={`RS-60: ${pct != null ? (pct > 0 ? "+" : "") + pct.toFixed(1) + "%" : "—"}${pct120 != null ? " · RS-120: " + (pct120 > 0 ? "+" : "") + pct120.toFixed(1) + "%" : ""}${accel != null ? " · Accel: " + (accel > 0 ? "+" : "") + accel.toFixed(1) + "pts" : ""}`}>
          {/* RS-60 primary bar */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              pct === null ? "bg-slate-600" : isPositive ? "bg-emerald-500" : "bg-red-500"
            }`}
            style={{ width: `${barWidth}%` }}
          />
          {/* RS-120 reference tick */}
          {bar120Width !== null && (
            <div
              className="absolute inset-y-0 w-0.5 bg-white/30 rounded-full"
              style={{ left: `${bar120Width}%` }}
            />
          )}
        </div>
        <span
          className={`text-xs tabular-nums w-14 text-right shrink-0 ${
            pct === null ? "text-slate-600" : isPositive ? "text-emerald-400" : "text-red-400"
          }`}
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {pct === null ? "—" : `${isPositive ? "+" : ""}${pct.toFixed(1)}%`}
        </span>
        {accel !== null && (
          <span className={`text-[9px] tabular-nums w-10 text-right shrink-0 ${accelClass}`}
            title="RS acceleration: RS-60 minus RS-120 (positive = improving vs long-term)"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {accel > 0 ? "↗" : accel < 0 ? "↘" : "→"}{Math.abs(accel) >= 0.1 ? Math.abs(accel).toFixed(1) : ""}
          </span>
        )}
      </div>
      {qConfig && (
        <span
          className={`text-[10px] shrink-0 w-24 text-right ${qConfig.colorClass}`}
          style={{ fontFamily: "var(--font-rajdhani)" }}
        >
          {qConfig.label}
        </span>
      )}
    </div>
  );
}

function FlowSignalRow({ category, maxAbsZ }: { category: CategorySummary; maxAbsZ: number }) {
  const z = category.flow20d;
  const persist = category.persistence20d;
  if (z === null && persist === null) return null;

  const absZ = Math.abs(z ?? 0);
  const barWidth = maxAbsZ > 0 ? Math.min(absZ / maxAbsZ, 1) * 100 : 0;
  const isPos = (z ?? 0) >= 0;
  const persistPct = persist != null ? Math.round((persist / 20) * 100) : null;

  const zColor = z == null ? "text-slate-600" : Math.abs(z) < 0.5 ? "text-slate-400" : isPos ? "text-emerald-400" : "text-red-400";
  const barColor = z == null ? "bg-slate-700" : isPos ? "bg-emerald-500" : "bg-red-500";
  const persistColor = persist == null ? "text-slate-600" : persist >= 14 ? "text-emerald-400" : persist >= 8 ? "text-slate-400" : "text-red-400";

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-700/20 last:border-0">
      <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {category.etfTicker}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
        <span className={`text-xs tabular-nums w-12 text-right shrink-0 ${zColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          {z == null ? "—" : `${isPos ? "+" : ""}${z.toFixed(2)}σ`}
        </span>
      </div>
      <span className={`text-xs tabular-nums w-16 text-right shrink-0 ${persistColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        title="Positive-flow days out of last 20">
        {persist != null ? `${persist}/20` : "—"}
        {persistPct != null && <span className="text-slate-600 text-[9px] ml-0.5">({persistPct}%)</span>}
      </span>
    </div>
  );
}

function EventRow({ event }: { event: RotationEventEntry }) {
  const config = EVENT_LABELS[event.eventType];
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-700/30 last:border-0">
      <span
        className="text-slate-500 text-[11px] tabular-nums shrink-0 pt-0.5 w-24"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {event.detectedDate}
      </span>
      <span
        className={`text-[11px] shrink-0 font-semibold ${config?.colorClass ?? "text-slate-400"}`}
        style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
      >
        {config?.label ?? event.eventType}
      </span>
      <span className="text-sm text-slate-300 shrink-0">{event.categoryName}</span>
      {event.notes && (
        <span className="text-xs text-slate-500 ml-auto text-right max-w-xs">{event.notes}</span>
      )}
    </div>
  );
}

type Props = {
  searchParams: Promise<{ timeframe?: string }>;
};

export default async function CapitalFlowsPage({ searchParams }: Props) {
  const { timeframe = "MONTH" } = await searchParams;
  const [rotation, categories] = await Promise.all([
    fetchRotation().catch(() => null),
    fetchCategories(timeframe).catch(() => null),
  ]);

  const allRanked = (categories?.categories ?? [])
    .filter((c) => c.rs60 !== null)
    .sort((a, b) => (b.rs60 ?? -999) - (a.rs60 ?? -999));

  const maxAbs = allRanked.reduce((m, c) => Math.max(m, Math.abs(c.rs60 ?? 0) * 100), 0) || 10;

  const flowRanked = (categories?.categories ?? [])
    .filter((c) => c.flow20d !== null || c.persistence20d !== null)
    .sort((a, b) => (b.flow20d ?? 0) - (a.flow20d ?? 0));

  const maxAbsZ = flowRanked.reduce((m, c) => Math.max(m, Math.abs(c.flow20d ?? 0)), 0) || 2;

  const hasData = allRanked.length > 0 || (rotation?.topLeaders.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Capital Flows
          </h1>
          <span
            className="text-[11px] text-slate-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {rotation?.asOfDate ?? categories?.asOfDate ?? "—"}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-xl">
          {timeframe === "DAY" || timeframe === "WEEK" ? "20" : timeframe === "QUARTER" || timeframe === "YEAR" ? "120" : "60"}-day relative strength vs SPY — a proxy for capital rotation. Positive = money flowing
          into a sector relative to the broad market. Leaders and laggards derived from composite
          rotation signals.
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {!hasData && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No data yet — trigger ingestion to populate signals.</p>
          </div>
        )}

        {rotation && (rotation.topLeaders.length > 0 || rotation.bottomLaggards.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900/40 border border-emerald-700/25 rounded-xl p-4">
              <h2
                className="text-emerald-400 text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
              >
                ↑ Top Leaders
              </h2>
              {rotation.topLeaders.map((e) => (
                <LeaderRow key={e.categoryId} entry={e} isLeader={true} />
              ))}
            </div>
            <div className="bg-gradient-to-br from-red-900/20 to-slate-900/40 border border-red-700/25 rounded-xl p-4">
              <h2
                className="text-red-400 text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
              >
                ↓ Bottom Laggards
              </h2>
              {rotation.bottomLaggards.map((e) => (
                <LeaderRow key={e.categoryId} entry={e} isLeader={false} />
              ))}
            </div>
          </div>
        )}

        {allRanked.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2
                className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
                style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
              >
                All categories — RS {timeframe === "DAY" || timeframe === "WEEK" ? "20d" : timeframe === "QUARTER" || timeframe === "YEAR" ? "120d" : "60d"} vs SPY
              </h2>
              <span
                className="text-[10px] text-slate-500"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                bars scaled to ±{maxAbs.toFixed(1)}%
              </span>
            </div>
            {allRanked.map((c) => (
              <RsBarRow key={c.id} category={c} maxAbs={maxAbs} />
            ))}
          </div>
        )}

        {flowRanked.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2
                className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
                style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
              >
                Flow Z-Score (20d)
              </h2>
              <span className="text-[10px] text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                Z-score · Persistence (n/20 positive days)
              </span>
            </div>
            <div className="flex items-center gap-3 px-0 mb-1">
              <span className="w-10 shrink-0" />
              <span className="flex-1 text-[9px] text-slate-600 text-center">
                flow z-score (σ from 0 = mean)
              </span>
              <span className="w-16 text-right text-[9px] text-slate-600 shrink-0">
                positive days
              </span>
            </div>
            {flowRanked.map((c) => (
              <FlowSignalRow key={c.id} category={c} maxAbsZ={maxAbsZ} />
            ))}
            <div className="mt-3 text-[10px] text-slate-600">
              Z-score: σ &gt; +1 = unusual inflow · σ &lt; −1 = unusual outflow · Persistence ≥14/20 = sustained buying
            </div>
          </div>
        )}

        {rotation?.recentEvents && rotation.recentEvents.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <h2
              className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
            >
              Recent Rotation Events
            </h2>
            {rotation.recentEvents.map((evt, i) => (
              <EventRow key={i} event={evt} />
            ))}
          </div>
        )}

        <div className="mt-2 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Note on flow data:</span>{" "}
          AUM-weighted dollar flows (million USD) require real-time ETF.com or VettaFi data, which is
          not yet integrated. RS-60 relative strength is a reliable price-based proxy for institutional
          capital rotation — rising RS means a sector is attracting more buying pressure than SPY.
        </div>
      </main>
    </div>
  );
}
