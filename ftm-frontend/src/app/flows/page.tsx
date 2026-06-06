import {
  fetchRotation,
  fetchCategories,
  fetchCategoryScoreHistory,
  fetchSeasonalReturns,
  RotationLeaderEntry,
  RotationEventEntry,
  CategorySummary,
  SeasonalReturn,
} from "@/lib/api";
import RSFlowScatterPanel from "@/components/RSFlowScatterPanel";

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
  const persist5d = category.persistence5d;
  if (z === null && persist === null) return null;

  const absZ = Math.abs(z ?? 0);
  const barWidth = maxAbsZ > 0 ? Math.min(absZ / maxAbsZ, 1) * 100 : 0;
  const isPos = (z ?? 0) >= 0;
  const persistPct = persist != null ? Math.round((persist / 20) * 100) : null;

  const zColor = z == null ? "text-slate-600" : Math.abs(z) < 0.5 ? "text-slate-400" : isPos ? "text-emerald-400" : "text-red-400";
  const barColor = z == null ? "bg-slate-700" : isPos ? "bg-emerald-500" : "bg-red-500";
  const persistColor = persist == null ? "text-slate-600" : persist >= 14 ? "text-emerald-400" : persist >= 8 ? "text-slate-400" : "text-red-400";

  let velocityEl: React.ReactNode = null;
  if (persist5d != null && persist != null) {
    const rate5d = persist5d / 5;
    const prior15 = persist - persist5d;
    const rate15 = prior15 / 15;
    const velocityPct = Math.round((rate5d - rate15) * 100);
    if (Math.abs(velocityPct) >= 5) {
      const isAccel = velocityPct > 0;
      velocityEl = (
        <span
          className={`text-[9px] shrink-0 ${isAccel ? "text-emerald-400" : "text-red-400"}`}
          title={`Breadth velocity: recent-5d ${Math.round(rate5d * 100)}% vs prior-15d ${Math.round(rate15 * 100)}% (${velocityPct > 0 ? "+" : ""}${velocityPct}pp)`}
        >
          {isAccel ? "⚡" : "⬇"}
        </span>
      );
    }
  }

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
      <span className={`text-xs tabular-nums shrink-0 ${persistColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        title={`Breadth: ${persist != null ? `${persist}/20 days outperformed benchmark` : "n/a"}`}>
        {persist != null ? `${persist}/20` : "—"}
        {persistPct != null && <span className="text-slate-600 text-[9px] ml-0.5">({persistPct}%)</span>}
      </span>
      {velocityEl ?? <span className="w-3 shrink-0" />}
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

const SIGNAL_DOT: Record<string, { fill: string; stroke: string }> = {
  BUY:    { fill: "#16a34a", stroke: "#4ade80" },
  WATCH:  { fill: "#0e7490", stroke: "#22d3ee" },
  HOLD:   { fill: "#374151", stroke: "#6b7280" },
  REDUCE: { fill: "#991b1b", stroke: "#f87171" },
};

function RsScoreScatter({ categories }: { categories: CategorySummary[] }) {
  const pts = categories.filter(c => c.rs60 != null && c.compositeScore != null);
  if (pts.length < 3) return null;

  const W = 480, H = 280, padL = 40, padR = 16, padT = 24, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const rs60Vals = pts.map(p => p.rs60! * 100);
  const scoreVals = pts.map(p => p.compositeScore! * 100);
  const xMin = Math.min(-8, Math.min(...rs60Vals) - 1);
  const xMax = Math.max(8, Math.max(...rs60Vals) + 1);
  const yMin = 0, yMax = 100;

  const toX = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * innerW;
  const toY = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const zeroX = toX(0);
  const midY  = toY(50);

  // Quadrant labels (positioned at center of each quadrant)
  const qLabels = [
    { x: (zeroX + padL + innerW) / 2, y: (padT + midY) / 2,          text: "High RS · High Score",  color: "#22c55e",  opacity: 0.5 },
    { x: (padL + zeroX) / 2,          y: (padT + midY) / 2,          text: "Low RS · High Score",   color: "#fbbf24",  opacity: 0.4 },
    { x: (zeroX + padL + innerW) / 2, y: (midY + padT + innerH) / 2, text: "High RS · Low Score",   color: "#22d3ee",  opacity: 0.4 },
    { x: (padL + zeroX) / 2,          y: (midY + padT + innerH) / 2, text: "Low RS · Low Score",    color: "#f87171",  opacity: 0.35 },
  ];

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4" title="RS-60 vs Composite Score scatter. X=relative strength vs SPY (60d), Y=composite signal score (0-100). Top-right = strongest buy candidates.">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">RS-60 vs Score — Positioning Map</div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {(["BUY","WATCH","HOLD","REDUCE"] as const).map(sig => (
            <span key={sig} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: SIGNAL_DOT[sig].stroke }} />
              {sig}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: "360px" }}>
          {/* Background quadrant fills */}
          <rect x={zeroX}    y={padT}  width={padL + innerW - zeroX} height={midY - padT}  fill="#16a34a" opacity="0.04" />
          <rect x={padL}     y={padT}  width={zeroX - padL}          height={midY - padT}  fill="#fbbf24" opacity="0.03" />
          <rect x={zeroX}    y={midY}  width={padL + innerW - zeroX} height={padT + innerH - midY} fill="#06b6d4" opacity="0.03" />
          <rect x={padL}     y={midY}  width={zeroX - padL}          height={padT + innerH - midY} fill="#ef4444" opacity="0.03" />

          {/* Quadrant labels */}
          {qLabels.map((q, i) => (
            <text key={i} x={q.x.toFixed(1)} y={q.y.toFixed(1)} fill={q.color} fontSize="8.5" textAnchor="middle" opacity={q.opacity}>{q.text}</text>
          ))}

          {/* Grid lines */}
          <line x1={zeroX.toFixed(1)} y1={padT} x2={zeroX.toFixed(1)} y2={padT + innerH} stroke="#334155" strokeWidth="0.8" />
          <line x1={padL} y1={midY.toFixed(1)} x2={padL + innerW} y2={midY.toFixed(1)} stroke="#334155" strokeWidth="0.8" />

          {/* X-axis ticks */}
          {[-6,-4,-2,0,2,4,6].map(v => {
            const x = toX(v);
            if (x < padL || x > padL + innerW) return null;
            return (
              <g key={v}>
                <line x1={x.toFixed(1)} y1={(padT + innerH).toFixed(1)} x2={x.toFixed(1)} y2={(padT + innerH + 3).toFixed(1)} stroke="#475569" strokeWidth="0.5" />
                <text x={x.toFixed(1)} y={H - 6} fill="#64748b" fontSize="8" textAnchor="middle">{v > 0 ? `+${v}` : v}%</text>
              </g>
            );
          })}

          {/* Y-axis ticks */}
          {[0,25,50,75,100].map(v => {
            const y = toY(v);
            return (
              <g key={v}>
                <line x1={(padL - 3).toFixed(1)} y1={y.toFixed(1)} x2={padL.toFixed(1)} y2={y.toFixed(1)} stroke="#475569" strokeWidth="0.5" />
                <text x={(padL - 5).toFixed(1)} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">{v}</text>
              </g>
            );
          })}

          {/* Axis labels */}
          <text x={(padL + innerW / 2 + padL / 2).toFixed(1)} y={H - 1} fill="#475569" fontSize="8" textAnchor="middle">RS-60 vs SPY →</text>
          <text x="8" y={(padT + innerH / 2).toFixed(1)} fill="#475569" fontSize="8" textAnchor="middle" transform={`rotate(-90,8,${(padT + innerH / 2).toFixed(1)})`}>Score</text>

          {/* Data points */}
          {pts.map(cat => {
            const x = toX(cat.rs60! * 100);
            const y = toY(cat.compositeScore! * 100);
            if (x < padL || x > padL + innerW || y < padT || y > padT + innerH) return null;
            const sig = cat.tradeSignal ?? "HOLD";
            const dot = SIGNAL_DOT[sig] ?? SIGNAL_DOT.HOLD;
            const isLarge = sig === "BUY" || sig === "REDUCE";
            const r = isLarge ? 5 : 4;
            return (
              <g key={cat.id}>
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={r} fill={dot.fill} stroke={dot.stroke} strokeWidth="0.8" opacity="0.85" />
                <text x={x.toFixed(1)} y={(y - r - 2).toFixed(1)} fill="#e2e8f0" fontSize="7.5" textAnchor="middle" opacity="0.85">
                  {cat.etfTicker}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Top-right = strongest buy zone (high RS + high score) · Bottom-left = avoid · Size = signal strength
      </div>
    </div>
  );
}

function scoreToColor(s: number | null | undefined): string {
  if (s == null) return "#1e293b";
  if (s >= 0.7) return "#15803d";
  if (s >= 0.6) return "#16a34a";
  if (s >= 0.5) return "#22c55e";
  if (s >= 0.4) return "#ca8a04";
  if (s >= 0.3) return "#d97706";
  return "#b91c1c";
}

type ScoreHistoryMap = Record<string, number[]>;

function ScoreHistoryHeatmap({
  categories,
  scoreHistory,
}: {
  categories: CategorySummary[];
  scoreHistory: ScoreHistoryMap;
}) {
  const rows = categories
    .filter(c => scoreHistory[c.id]?.length >= 5)
    .sort((a, b) => {
      const aLast = scoreHistory[a.id]?.slice(-1)[0] ?? 0;
      const bLast = scoreHistory[b.id]?.slice(-1)[0] ?? 0;
      return bLast - aLast;
    });

  if (rows.length === 0) return null;

  const DAYS = 30;
  const cellW = 12, cellH = 14, gap = 1;
  const labelW = 44, scoreW = 32, padL = 8, padR = 8, padT = 24, padB = 20;
  const innerW = DAYS * (cellW + gap) - gap;
  const W = padL + labelW + 4 + innerW + 4 + scoreW + padR;
  const H = padT + rows.length * (cellH + gap) - gap + padB;

  const colDates: string[] = [];
  if (rows[0]) {
    const hist = scoreHistory[rows[0].id] ?? [];
    for (let i = Math.max(0, hist.length - DAYS); i < hist.length; i++) colDates.push("");
    while (colDates.length < DAYS) colDates.unshift("");
  }

  const colX = (col: number) => padL + labelW + 4 + col * (cellW + gap);
  const rowY = (row: number) => padT + row * (cellH + gap);

  const tickCols = [0, 6, 13, 20, DAYS - 1];
  const tickLabels = ["-30d", "-23d", "-16d", "-9d", "now"];

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
        >
          Score Momentum — 30-Day Heatmap
        </h2>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />Strong
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-600" />Mid
          <span className="inline-block w-3 h-3 rounded-sm bg-red-700" />Weak
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: "340px", height: `${H}px` }}>
          {/* Column tick labels */}
          {tickCols.map((col, i) => (
            <text key={col} x={colX(col) + cellW / 2} y={padT - 6}
              fontSize="7" fill="#475569" textAnchor="middle">{tickLabels[i]}</text>
          ))}
          {rows.map((cat, ri) => {
            const hist = scoreHistory[cat.id] ?? [];
            const slice = hist.slice(-DAYS);
            const padded = Array(DAYS - slice.length).fill(null).concat(slice);
            const latest = slice[slice.length - 1] ?? null;
            const trend5 = slice.length >= 5 ? latest! - slice[slice.length - 5] : null;
            const trendColor = trend5 == null ? "#64748b" : trend5 > 0.03 ? "#4ade80" : trend5 < -0.03 ? "#f87171" : "#94a3b8";
            void colDates;

            return (
              <g key={cat.id}>
                {/* Category ticker label */}
                <text x={padL + labelW - 2} y={rowY(ri) + cellH * 0.72}
                  fontSize="8" fill="#94a3b8" textAnchor="end"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  {cat.etfTicker}
                </text>
                {/* Score cells */}
                {padded.map((score, ci) => (
                  <rect
                    key={ci}
                    x={colX(ci)} y={rowY(ri)}
                    width={cellW} height={cellH}
                    rx="1"
                    fill={scoreToColor(score)}
                    opacity={score == null ? 0.3 : 0.85}
                    {...{ title: score != null ? `${cat.etfTicker} · ${Math.round(score * 100)}/100` : "no data" }}
                  />
                ))}
                {/* Current score */}
                <text x={colX(DAYS) + 4} y={rowY(ri) + cellH * 0.72}
                  fontSize="8" fill={trendColor} textAnchor="start"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  {latest != null ? Math.round(latest * 100) : "—"}
                </text>
              </g>
            );
          })}
          {/* Bottom axis */}
          <line x1={colX(0)} x2={colX(DAYS - 1) + cellW} y1={H - padB + 2} y2={H - padB + 2}
            stroke="#334155" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Each column = 1 trading day · Score 0–100 · Score rising right = momentum building
      </div>
    </div>
  );
}

function RiskAdjustedRanking({ categories }: { categories: CategorySummary[] }) {
  const DEFAULT_VOL = 0.20;
  const ranked = categories
    .filter(c => c.rs60 != null)
    .map(c => {
      const vol = c.realizedVol20d ?? DEFAULT_VOL;
      const sharpeProxy = (c.rs60! * 100) / (vol * 100 || DEFAULT_VOL * 100);
      return { ...c, vol, sharpeProxy };
    })
    .sort((a, b) => b.sharpeProxy - a.sharpeProxy);

  if (ranked.length === 0) return null;

  const absMax = Math.max(Math.abs(ranked[0].sharpeProxy), Math.abs(ranked[ranked.length - 1].sharpeProxy), 0.5);

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
        >
          Risk-Adjusted Strength (RS-60 ÷ Vol)
        </h2>
        <span className="text-[10px] text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          Sharpe proxy · default vol 20% if unavailable
        </span>
      </div>
      {ranked.map((c, i) => {
        const isPos = c.sharpeProxy >= 0;
        const barW = Math.min(Math.abs(c.sharpeProxy) / absMax, 1) * 100;
        const barColor = isPos ? "bg-violet-500" : "bg-rose-700";
        const valColor = isPos ? "text-violet-400" : "text-rose-400";
        const rankColor = i === 0 ? "text-green-400" : i === ranked.length - 1 ? "text-red-400" : "text-slate-500";
        const volKnown = c.realizedVol20d != null;
        return (
          <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-slate-700/20 last:border-0">
            <span className={`text-[10px] font-bold tabular-nums w-4 shrink-0 ${rankColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              #{i + 1}
            </span>
            <span className="text-xs text-slate-300 w-44 truncate shrink-0">{c.name}</span>
            <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{c.etfTicker}</span>
            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
            </div>
            <span className={`text-xs tabular-nums w-14 text-right shrink-0 ${valColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {c.sharpeProxy >= 0 ? "+" : ""}{c.sharpeProxy.toFixed(2)}
            </span>
            <span
              className={`text-[9px] tabular-nums w-12 text-right shrink-0 ${volKnown ? "text-slate-500" : "text-slate-700"}`}
              title={volKnown ? `Realized 20d vol: ${(c.vol * 100).toFixed(1)}%` : "Vol unavailable — default 20% used"}
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {volKnown ? `σ${(c.vol * 100).toFixed(0)}%` : "~σ20%"}
            </span>
          </div>
        );
      })}
      <div className="mt-3 text-[10px] text-slate-600">
        Formula: RS-60 ÷ Realized Vol (20d annualized). Positive = outperforming per unit of risk. Higher = better risk-adjusted rotation signal.
      </div>
    </div>
  );
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function SeasonalTailwindsPanel({
  seasonalReturns,
  categories,
}: {
  seasonalReturns: SeasonalReturn[];
  categories: CategorySummary[];
}) {
  if (seasonalReturns.length === 0 || categories.length === 0) return null;

  const currentMonth = new Date().getMonth() + 1;
  const monthLabel = MONTH_LABELS[currentMonth - 1];

  // Build lookup: categoryId → current month avg return
  const monthReturn: Record<string, SeasonalReturn> = {};
  for (const sr of seasonalReturns) {
    if (sr.month === currentMonth) monthReturn[sr.categoryId] = sr;
  }

  const catMap: Record<string, CategorySummary> = {};
  for (const c of categories) catMap[c.id] = c;

  const entries = Object.entries(monthReturn)
    .map(([catId, sr]) => ({ cat: catMap[catId], sr }))
    .filter(e => e.cat != null)
    .sort((a, b) => b.sr.avgReturn - a.sr.avgReturn);

  const tailwinds = entries.filter(e => e.sr.avgReturn > 0.005).slice(0, 5);
  const headwinds = entries.filter(e => e.sr.avgReturn < -0.005).slice(0, 4);

  if (tailwinds.length === 0 && headwinds.length === 0) return null;

  function EntryRow({ e, isGood }: { e: { cat: CategorySummary; sr: SeasonalReturn }; isGood: boolean }) {
    const retPct = (e.sr.avgReturn * 100).toFixed(1);
    const signal = e.cat.tradeSignal;
    const signalAligned = isGood ? (signal === "BUY" || signal === "WATCH") : (signal === "REDUCE");
    const retColor = isGood ? "text-emerald-400" : "text-red-400";
    return (
      <div className="flex items-center gap-2 py-1 border-b border-slate-700/20 last:border-0">
        <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          {e.cat.etfTicker}
        </span>
        <span className="text-[10px] text-slate-400 flex-1 truncate">{e.cat.name}</span>
        <span className={`text-[10px] tabular-nums shrink-0 font-mono ${retColor}`}>
          {isGood ? "+" : ""}{retPct}%
        </span>
        <span className="text-[9px] text-slate-600 shrink-0">n={e.sr.sampleCount}</span>
        {signal && (
          <span className={`text-[9px] shrink-0 font-bold px-1 rounded ${
            signalAligned
              ? (isGood ? "text-emerald-300 bg-emerald-900/30" : "text-red-300 bg-red-900/30")
              : "text-slate-500 bg-slate-800/60"
          }`} style={{ fontFamily: "var(--font-rajdhani)" }}>
            {signal}
            {signalAligned && " ✓"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
        >
          {monthLabel} Seasonal Tailwinds &amp; Headwinds
        </h2>
        <span className="text-[9px] text-slate-600">avg monthly return · ✓ = signal aligned</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tailwinds.length > 0 && (
          <div>
            <div className="text-[9px] text-emerald-500 uppercase tracking-wider mb-1.5 font-semibold">
              ↑ Seasonal Tailwinds
            </div>
            {tailwinds.map(e => <EntryRow key={e.cat.id} e={e} isGood={true} />)}
          </div>
        )}
        {headwinds.length > 0 && (
          <div>
            <div className="text-[9px] text-red-500 uppercase tracking-wider mb-1.5 font-semibold">
              ↓ Seasonal Headwinds
            </div>
            {headwinds.map(e => <EntryRow key={e.cat.id} e={e} isGood={false} />)}
          </div>
        )}
      </div>
      <div className="text-[9px] text-slate-600 mt-2">
        Historical average for {monthLabel} across all available years (min 2 samples) · ✓ means current signal aligns with seasonal pattern
      </div>
    </div>
  );
}

function returnToColor(r: number, maxAbs: number): string {
  if (maxAbs === 0) return "#1e293b";
  const t = Math.min(Math.abs(r) / maxAbs, 1);
  if (r > 0) {
    const g = Math.round(60 + t * 130);
    const b = Math.round(40 + t * 40);
    return `rgb(20,${g},${b})`;
  } else {
    const red = Math.round(80 + t * 130);
    return `rgb(${red},20,20)`;
  }
}

function SeasonalHeatmap({
  seasonalReturns,
  categories,
}: {
  seasonalReturns: SeasonalReturn[];
  categories: CategorySummary[];
}) {
  if (seasonalReturns.length === 0) return null;

  // Build a map: categoryId → month → SeasonalReturn
  const byCategory: Record<string, Record<number, SeasonalReturn>> = {};
  for (const sr of seasonalReturns) {
    if (!byCategory[sr.categoryId]) byCategory[sr.categoryId] = {};
    byCategory[sr.categoryId][sr.month] = sr;
  }

  const catIds = categories.filter(c => byCategory[c.id]).slice(0, 18);
  if (catIds.length === 0) return null;

  const allAbsReturns = seasonalReturns.map(r => Math.abs(r.avgReturn));
  const maxAbs = Math.max(...allAbsReturns, 0.01);
  const currentMonth = new Date().getMonth() + 1;

  const cellW = 32, cellH = 18, gap = 2;
  const labelW = 48, padL = 8, padR = 8, padT = 28, padB = 20;
  const innerW = 12 * (cellW + gap) - gap;
  const W = padL + labelW + 4 + innerW + padR;
  const H = padT + catIds.length * (cellH + gap) - gap + padB;

  const colX = (col: number) => padL + labelW + 4 + col * (cellW + gap);
  const rowY = (row: number) => padT + row * (cellH + gap);

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
        >
          Seasonal Monthly Returns
        </h2>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-700" />+ve
          <span className="inline-block w-3 h-3 rounded-sm bg-red-800" />-ve
          <span className="text-slate-700">· sample ≥2yr</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: "480px", height: `${H}px` }}>
          {/* Month header labels */}
          {MONTH_LABELS.map((m, mi) => (
            <text
              key={m}
              x={colX(mi) + cellW / 2} y={padT - 8}
              fontSize="8" fill={mi + 1 === currentMonth ? "#22d3ee" : "#475569"}
              textAnchor="middle"
              fontWeight={mi + 1 === currentMonth ? "bold" : "normal"}
            >{m}</text>
          ))}
          {catIds.map((cat, ri) => {
            const monthMap = byCategory[cat.id] ?? {};
            return (
              <g key={cat.id}>
                <text
                  x={padL + labelW - 2} y={rowY(ri) + cellH * 0.72}
                  fontSize="8" fill="#94a3b8" textAnchor="end"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >{cat.etfTicker}</text>
                {MONTH_LABELS.map((_, mi) => {
                  const month = mi + 1;
                  const sr = monthMap[month];
                  const ret = sr ? sr.avgReturn : null;
                  const fill = ret != null ? returnToColor(ret, maxAbs) : "#1e293b";
                  const isCurrentMonth = month === currentMonth;
                  return (
                    <g key={mi}>
                      <rect
                        x={colX(mi)} y={rowY(ri)}
                        width={cellW} height={cellH}
                        rx="2"
                        fill={fill}
                        opacity={ret == null ? 0.3 : 0.9}
                        stroke={isCurrentMonth ? "#22d3ee" : "none"}
                        strokeWidth={isCurrentMonth ? "1" : "0"}
                      />
                      {ret != null && (
                        <text
                          x={colX(mi) + cellW / 2} y={rowY(ri) + cellH * 0.72}
                          fontSize="7" fill={Math.abs(ret) > 0.02 ? "#e2e8f0" : "#94a3b8"}
                          textAnchor="middle"
                          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                        >{ret >= 0 ? "+" : ""}{(ret * 100).toFixed(1)}</text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <line x1={colX(0)} x2={colX(11) + cellW} y1={H - padB + 2} y2={H - padB + 2}
            stroke="#334155" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Average monthly return by calendar month · current month highlighted in cyan · values in %
      </div>
    </div>
  );
}

type Props = {
  searchParams: Promise<{ timeframe?: string }>;
};

export default async function CapitalFlowsPage({ searchParams }: Props) {
  const { timeframe = "MONTH" } = await searchParams;
  const [rotation, categories, scoreHistoryRaw, seasonalRaw] = await Promise.all([
    fetchRotation().catch(() => null),
    fetchCategories(timeframe).catch(() => null),
    fetchCategoryScoreHistory(30).catch(() => null),
    fetchSeasonalReturns().catch(() => null),
  ]);
  const scoreHistory: ScoreHistoryMap = scoreHistoryRaw ?? {};
  const seasonalReturns: SeasonalReturn[] = seasonalRaw ?? [];

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

        {(categories?.categories ?? []).some(c => c.rs60 != null && c.flow20d != null) && (
          <RSFlowScatterPanel categories={categories!.categories} />
        )}

        {(categories?.categories ?? []).length >= 3 && (
          <RsScoreScatter categories={categories!.categories} />
        )}

        {(categories?.categories ?? []).length > 0 && Object.keys(scoreHistory).length > 0 && (
          <ScoreHistoryHeatmap
            categories={categories!.categories}
            scoreHistory={scoreHistory}
          />
        )}

        {allRanked.length > 0 && (
          <RiskAdjustedRanking categories={allRanked} />
        )}

        {seasonalReturns.length > 0 && (categories?.categories ?? []).length > 0 && (
          <SeasonalTailwindsPanel
            seasonalReturns={seasonalReturns}
            categories={categories!.categories}
          />
        )}

        {seasonalReturns.length > 0 && (categories?.categories ?? []).length > 0 && (
          <SeasonalHeatmap
            seasonalReturns={seasonalReturns}
            categories={categories!.categories}
          />
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
