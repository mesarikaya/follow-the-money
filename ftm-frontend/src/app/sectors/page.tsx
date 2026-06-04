import Link from "next/link";
import { fetchCategories, fetchCategoryScoreHistory, fetchSubSectors, fetchAlerts, AlertDto, CategorySummary, SubSectorSummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import Sparkline from "@/components/Sparkline";

const QUADRANT_CONFIG: Record<string, {
  label: string;
  badgeClass: string;
  leftBorderClass: string;
}> = {
  "4": {
    label: "↗ Leading",
    badgeClass: "bg-green-500/10 text-green-400 border border-green-500/25",
    leftBorderClass: "border-l-green-500",
  },
  "3": {
    label: "↖ Improving",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25",
    leftBorderClass: "border-l-cyan-500",
  },
  "2": {
    label: "↘ Weakening",
    badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/25",
    leftBorderClass: "border-l-orange-500",
  },
  "1": {
    label: "↙ Lagging",
    badgeClass: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
    leftBorderClass: "border-l-slate-600",
  },
};

function RsStat({ label, value, rs120 }: { label: string; value: number | null; rs120?: number | null }) {
  if (value == null) {
    return (
      <div className="text-center">
        <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          {label}
        </div>
        <div className="text-xs text-slate-600" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>—</div>
      </div>
    );
  }
  const pct = (value * 100).toFixed(1);
  const colorClass = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const accel = rs120 != null ? value - rs120 : null;
  const accelClass = accel == null ? "" : accel > 0.001 ? "text-emerald-400" : accel < -0.001 ? "text-red-400" : "text-slate-500";
  const accelArrow = accel == null ? "" : accel > 0.001 ? "↗" : accel < -0.001 ? "↘" : "→";
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {label}
      </div>
      <div className="flex items-center justify-center gap-1">
        <span className={`text-sm font-medium tabular-nums ${colorClass}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          {value > 0 ? "+" : ""}{pct}%
        </span>
        {accel != null && Math.abs(accel) > 0.001 && (
          <span className={`text-[10px] ${accelClass}`} title={`RS acceleration vs 120d: ${accel > 0 ? "+" : ""}${(accel * 100).toFixed(1)}pts`}>
            {accelArrow}
          </span>
        )}
      </div>
    </div>
  );
}

function TrendPip({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const delta = Math.round(Math.abs(value * 100));
  const isUp = value > 0.005;
  const isDown = value < -0.005;
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  const colorClass = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500";
  return (
    <span className={`text-[9px] ${colorClass} tabular-nums`} style={{ fontFamily: "var(--font-jetbrains-mono)" }} title={`${label}: ${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}pt`}>
      {arrow}{delta > 0 ? delta : ""}
    </span>
  );
}

function ScoreStat({ value, trend5d, trend20d }: { value: number | null; trend5d: number | null; trend20d: number | null }) {
  if (value == null) {
    return (
      <div className="text-center">
        <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          Score
        </div>
        <div className="text-xs text-slate-600" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>—</div>
      </div>
    );
  }
  const score = Math.round(value * 100);
  const colorClass = value >= 0.7 ? "text-green-400" : value >= 0.4 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        Score
      </div>
      <div className={`text-sm font-medium tabular-nums ${colorClass}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {score}/100
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        <TrendPip value={trend5d} label="5d trend" />
        <TrendPip value={trend20d} label="20d trend" />
      </div>
    </div>
  );
}

function RankStat({ rank }: { rank: number }) {
  const colorClass = rank <= 3 ? "text-green-400" : rank <= 8 ? "text-yellow-400" : "text-slate-400";
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        Rank
      </div>
      <div className={`text-sm font-medium tabular-nums ${colorClass}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        #{rank}
      </div>
    </div>
  );
}

const TRADE_SIGNAL_BADGE: Record<TradeSignal, { label: string; cls: string }> = {
  BUY:    { label: "BUY",    cls: "bg-green-900/60 text-green-300 border-green-700/60" },
  WATCH:  { label: "WATCH",  cls: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50"   },
  HOLD:   { label: "HOLD",   cls: "bg-slate-700/60 text-slate-400 border-slate-600/60" },
  REDUCE: { label: "REDUCE", cls: "bg-red-900/50 text-red-400 border-red-700/50"      },
};

const ALERT_SEV_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  URGENT:  { dot: "bg-red-400",    text: "text-red-300",    bg: "bg-red-900/30 border-red-700/50"    },
  ACTION:  { dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-900/20 border-red-800/40"    },
  WARNING: { dot: "bg-amber-400",  text: "text-amber-300",  bg: "bg-amber-900/20 border-amber-700/40" },
  INFO:    { dot: "bg-blue-400",   text: "text-blue-300",   bg: "bg-blue-900/20 border-blue-700/40"  },
};
const SEV_ORDER = ["URGENT", "ACTION", "WARNING", "INFO"];

function worstSeverity(alerts: AlertDto[]): string | null {
  for (const sev of SEV_ORDER) {
    if (alerts.some(a => a.severity === sev)) return sev;
  }
  return null;
}

function SectorCard({ sector, history, subSectorCount, sectorAlerts, subSectorBreakdown }: { sector: CategorySummary; history: number[]; subSectorCount: number; sectorAlerts: AlertDto[]; subSectorBreakdown: SubSectorBreakdown }) {
  const quadrant = sector.rrgQuadrant ?? null;
  const qConfig = quadrant ? QUADRANT_CONFIG[quadrant] : null;
  const leftBorderClass = qConfig?.leftBorderClass ?? "border-l-slate-700";
  const signal = (sector.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(sector);
  const signalBadge = signal ? TRADE_SIGNAL_BADGE[signal] : null;
  const alertCount = sectorAlerts.length;
  const topSeverity = worstSeverity(sectorAlerts);
  const sevStyle = topSeverity ? ALERT_SEV_COLORS[topSeverity] : null;
  const velocitySurge = (sector.compositeTrend5d ?? 0) >= 0.12;
  const velocityCrash = (sector.compositeTrend5d ?? 0) <= -0.12;

  return (
    <Link
      href={`/sectors/${sector.id}`}
      className={`group block rounded-xl border border-slate-700/60 border-l-4 ${leftBorderClass} bg-gradient-to-br from-slate-800/80 to-slate-900/60 hover:from-slate-800 hover:to-slate-900 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 p-4`}
    >
      {/* Header: name + ETF ticker + quadrant badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3
            className="text-white text-base leading-tight font-semibold"
            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
          >
            {sector.name}
          </h3>
          <span
            className="mt-1 inline-block text-xs text-cyan-400 bg-cyan-500/8 border border-cyan-500/20 px-1.5 py-0.5 rounded"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {sector.etfTicker}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {signalBadge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${signalBadge.cls}`}
              style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.06em" }}
              title={`Trade signal: ${signal}`}
            >
              {signalBadge.label}
            </span>
          )}
          {qConfig ? (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${qConfig.badgeClass}`}
              style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
            >
              {qConfig.label}
            </span>
          ) : (
            <span className="text-slate-600 text-[10px]">—</span>
          )}
        </div>
      </div>

      {/* Signal stats row */}
      <div className="grid grid-cols-3 gap-2 mb-2 py-2 border-y border-slate-700/40">
        <ScoreStat value={sector.compositeScore} trend5d={sector.compositeTrend5d} trend20d={sector.compositeTrend20d} />
        <RsStat label="RS 60d" value={sector.rs60} rs120={sector.rs120} />
        <RankStat rank={sector.rank} />
      </div>
      {(sector.macroFit != null || sector.persistence20d != null) && (
        <div className="flex items-center gap-3 mb-2 pt-1">
          {sector.macroFit != null && (
            <div className="flex items-center gap-2 flex-1" title={`Macro Fit: ${Math.round(sector.macroFit * 100)}% — historical RS win rate in the current macro regime`}>
              <span className="text-[9px] text-slate-600 uppercase tracking-widest shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Regime</span>
              <div className="flex-1 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className={`h-full rounded-full ${sector.macroFit >= 0.6 ? "bg-violet-500" : sector.macroFit >= 0.4 ? "bg-violet-400/60" : "bg-slate-600"}`}
                  style={{ width: `${Math.round(sector.macroFit * 100)}%` }}
                />
              </div>
              <span className={`text-[9px] tabular-nums shrink-0 ${sector.macroFit >= 0.6 ? "text-violet-400" : sector.macroFit >= 0.4 ? "text-violet-500" : "text-slate-600"}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                {Math.round(sector.macroFit * 100)}%
              </span>
            </div>
          )}
          {sector.persistence20d != null && (() => {
            const p20 = sector.persistence20d;
            const p5 = sector.persistence5d;
            let velocityIcon: string | null = null;
            let velocityTitle = "";
            if (p5 != null) {
              const rate5d = p5 / 5;
              const prior15 = p20 - p5;
              const rate15 = prior15 / 15;
              const delta = Math.round((rate5d - rate15) * 100);
              if (Math.abs(delta) >= 5) {
                velocityIcon = delta > 0 ? "⚡" : "⬇";
                velocityTitle = ` · ${delta > 0 ? "+" : ""}${delta}pp breadth velocity`;
              }
            }
            return (
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${p20 >= 12 ? "text-cyan-400 bg-cyan-900/20" : p20 >= 7 ? "text-slate-500 bg-slate-700/20" : "text-orange-400 bg-orange-900/20"}`}
                title={`Persistence: ${p20}/20 trading days beat benchmark (${p20 >= 12 ? "strong" : p20 >= 7 ? "moderate" : "weak"})${velocityTitle}`}
              >
                P{p20}/20{velocityIcon && <span className="ml-0.5">{velocityIcon}</span>}
              </span>
            );
          })()}
        </div>
      )}

      {/* Footer: sparkline + sub-sector count + flow indicator + drill-down hint */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {history.length >= 2 && (
            <Sparkline values={history} width={48} height={16} />
          )}
          <span
            className="text-[11px] text-slate-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {subSectorCount} sub-sectors
          </span>
          {sector.flow20d != null && (
            <span
              className={`text-[10px] tabular-nums px-1 py-0.5 rounded ${Math.abs(sector.flow20d) < 0.5 ? "text-slate-500" : sector.flow20d > 0 ? "text-emerald-400 bg-emerald-900/20" : "text-red-400 bg-red-900/20"}`}
              title={`Flow z-score (20d): ${sector.flow20d > 0 ? "+" : ""}${sector.flow20d.toFixed(2)}σ`}
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {sector.flow20d > 0 ? "⊕" : "⊖"}{Math.abs(sector.flow20d).toFixed(1)}σ
            </span>
          )}
          {(() => {
            const { rs20, rs60, rs120 } = sector;
            if (rs20 == null || rs60 == null || rs120 == null) return null;
            const allBull = rs20 > rs60 && rs60 > rs120;
            const allBear = rs20 < rs60 && rs60 < rs120;
            if (!allBull && !allBear) return null;
            return (
              <span
                className={`text-[10px] font-mono px-1 py-0.5 rounded ${allBull ? "text-emerald-400 bg-emerald-900/20" : "text-red-400 bg-red-900/20"}`}
                title={allBull ? "RS-20 > RS-60 > RS-120 — all horizons bullishly aligned" : "RS-20 < RS-60 < RS-120 — all horizons bearishly aligned"}
              >
                {allBull ? "⊕RS" : "⊖RS"}
              </span>
            );
          })()}
          {(velocitySurge || velocityCrash) && (
            <span
              className={`text-[10px] font-bold px-1 py-0.5 rounded ${velocitySurge ? "text-emerald-300 bg-emerald-900/30 border border-emerald-700/40" : "text-red-300 bg-red-900/30 border border-red-700/40"}`}
              title={`Score velocity ${velocitySurge ? "SURGE" : "CRASH"}: ${velocitySurge ? "+" : ""}${Math.round((sector.compositeTrend5d ?? 0) * 100)}pts in 5 days`}
            >
              {velocitySurge ? "⚡" : "⚠"}
            </span>
          )}
          {alertCount > 0 && sevStyle && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${sevStyle.bg}`}
              title={`${alertCount} active alert${alertCount > 1 ? "s" : ""} (worst: ${topSeverity}) — click to see on alerts page`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sevStyle.dot}`} />
              <span className={sevStyle.text}>{alertCount}</span>
            </span>
          )}
        </div>
        <span
          className="text-[11px] text-slate-600 group-hover:text-cyan-400 transition-colors"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          → drill down
        </span>
      </div>

      {subSectorBreakdown.total > 0 && (
        <SubSectorBreadthBar breakdown={subSectorBreakdown} />
      )}
    </Link>
  );
}

type SubSectorBreakdown = { q4: number; q3: number; q2: number; q1: number; noData: number; total: number };

function buildBreakdown(subSectors: SubSectorSummary[]): SubSectorBreakdown {
  const counts = { q4: 0, q3: 0, q2: 0, q1: 0, noData: 0, total: subSectors.length };
  for (const s of subSectors) {
    if (s.rrgQuadrant === "4") counts.q4++;
    else if (s.rrgQuadrant === "3") counts.q3++;
    else if (s.rrgQuadrant === "2") counts.q2++;
    else if (s.rrgQuadrant === "1") counts.q1++;
    else counts.noData++;
  }
  return counts;
}

function SubSectorBreadthBar({ breakdown }: { breakdown: SubSectorBreakdown }) {
  const { q4, q3, q2, q1, noData, total } = breakdown;
  if (total === 0) return null;
  const withData = total - noData;
  const bullish = q4 + q3;
  const bullishPct = withData > 0 ? Math.round((bullish / withData) * 100) : null;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  const segments: Array<{ n: number; color: string; label: string }> = [
    { n: q4, color: "bg-green-500", label: `↗ Leading: ${q4}` },
    { n: q3, color: "bg-cyan-500", label: `↖ Improving: ${q3}` },
    { n: q2, color: "bg-orange-500/70", label: `↘ Weakening: ${q2}` },
    { n: q1, color: "bg-slate-600", label: `↙ Lagging: ${q1}` },
    { n: noData, color: "bg-slate-800", label: `No signal: ${noData}` },
  ].filter(s => s.n > 0);

  const title = `Sub-sector breadth: ${bullish}/${withData > 0 ? withData : total} bullish${bullishPct != null ? ` (${bullishPct}%)` : ""} · Leading: ${q4} Improving: ${q3} Weakening: ${q2} Lagging: ${q1}${noData > 0 ? ` No signal: ${noData}` : ""}`;
  const breadthColor = bullishPct == null ? "text-slate-600"
    : bullishPct >= 60 ? "text-green-400"
    : bullishPct >= 40 ? "text-amber-400"
    : "text-red-400";

  return (
    <div className="mt-1" title={title}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[9px] text-slate-600 uppercase tracking-wider shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Sub-breadth</span>
        {bullishPct != null && (
          <span className={`text-[9px] tabular-nums font-semibold ${breadthColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {bullishPct}% bullish
          </span>
        )}
        {noData === total && <span className="text-[9px] text-slate-600">no signals yet</span>}
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-slate-900" title={title}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: pct(seg.n) }}
            title={seg.label}
          />
        ))}
      </div>
    </div>
  );
}

const PARENT_SHORT: Record<string, string> = {
  TECH: "XLK", HLTH: "XLV", FINL: "XLF", DISR: "XLY",
  INDU: "XLI", ENRG: "XLE", MATL: "XLB", UTIL: "XLU",
  REIT: "XLRE", STPL: "XLP", COMM: "XLC",
};

function SubSectorLeaderboard({ leaders }: { leaders: SubSectorLeader[] }) {
  if (leaders.length === 0) return null;

  const rs20Sorted = [...leaders]
    .filter(s => s.rs20 != null)
    .sort((a, b) => (b.rs20 ?? 0) - (a.rs20 ?? 0))
    .slice(0, 6);

  const accelSorted = [...leaders]
    .filter(s => s.rs20 != null && s.rs120 != null)
    .sort((a, b) => {
      const accelA = (a.rs20 ?? 0) - (a.rs120 ?? 0);
      const accelB = (b.rs20 ?? 0) - (b.rs120 ?? 0);
      return accelB - accelA;
    })
    .slice(0, 6);

  if (rs20Sorted.length === 0) return null;

  function Row({ s, metric, value }: { s: SubSectorLeader; metric: "rs" | "accel"; value: number }) {
    const qColor = s.rrgQuadrant === "4" ? "text-green-400" : s.rrgQuadrant === "3" ? "text-cyan-400" : s.rrgQuadrant === "2" ? "text-orange-400" : "text-slate-500";
    const valColor = value > 0 ? "text-emerald-400" : "text-slate-500";
    const valStr = `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
    return (
      <Link href={`/sectors/${s.parentId}`} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/60 transition-colors group">
        <span className={`text-[9px] w-4 text-center ${qColor}`} title={`RRG Q${s.rrgQuadrant}`}>
          {s.rrgQuadrant === "4" ? "↗" : s.rrgQuadrant === "3" ? "↖" : s.rrgQuadrant === "2" ? "↘" : "↙"}
        </span>
        <span className="text-[10px] font-mono text-slate-200 w-10 shrink-0">{s.etfTicker}</span>
        <span className="text-[9px] text-slate-500 flex-1 truncate">{s.name}</span>
        <span className="text-[9px] text-slate-600 shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{PARENT_SHORT[s.parentId] ?? s.parentId}</span>
        <span className={`text-[10px] font-mono tabular-nums shrink-0 ${valColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{valStr}</span>
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
        <div
          className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.08em" }}
        >
          ↗ Top RS Leaders (RS-20)
        </div>
        <div className="space-y-0">
          {rs20Sorted.map(s => (
            <Row key={s.id} s={s} metric="rs" value={s.rs20 ?? 0} />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
        <div
          className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.08em" }}
        >
          ⚡ Fastest RS Accelerators (RS-20 minus RS-120)
        </div>
        <div className="space-y-0">
          {accelSorted.map(s => {
            const accel = (s.rs20 ?? 0) - (s.rs120 ?? 0);
            return <Row key={s.id} s={s} metric="accel" value={accel} />;
          })}
        </div>
      </div>
    </div>
  );
}

const QUADRANT_STRIP_CONFIG: Array<{ key: string; label: string; colorClass: string; dotClass: string }> = [
  { key: "4", label: "↗ Leading",   colorClass: "text-green-400",  dotClass: "bg-green-500"  },
  { key: "3", label: "↖ Improving", colorClass: "text-cyan-400",   dotClass: "bg-cyan-500"   },
  { key: "2", label: "↘ Weakening", colorClass: "text-orange-400", dotClass: "bg-orange-500" },
  { key: "1", label: "↙ Lagging",   colorClass: "text-slate-400",  dotClass: "bg-slate-500"  },
];

type SubSectorLeader = SubSectorSummary & { parentId: string };

export default async function SectorsHubPage() {
  let sectors: CategorySummary[] = [];
  let scoreHistory: Record<string, number[]> = {};
  let subSectorCounts: Record<string, number> = {};
  let subSectorBreakdowns: Record<string, SubSectorBreakdown> = {};
  let alertsBySectorId: Record<string, AlertDto[]> = {};
  let allSubSectors: SubSectorLeader[] = [];
  let error: string | null = null;

  const sectorIds = Array.from(SECTOR_DRILLDOWN_IDS);

  try {
    const [categoriesResponse, historyResponse, alertsResponse, ...subSectorResults] = await Promise.allSettled([
      fetchCategories("MONTH"),
      fetchCategoryScoreHistory(30),
      fetchAlerts(),
      ...sectorIds.map((id) => fetchSubSectors(id)),
    ]);

    if (categoriesResponse.status === "fulfilled") {
      sectors = categoriesResponse.value.categories.filter((c) => SECTOR_DRILLDOWN_IDS.has(c.id));
    } else {
      throw categoriesResponse.reason;
    }
    scoreHistory = historyResponse.status === "fulfilled" ? historyResponse.value : {};

    if (alertsResponse.status === "fulfilled") {
      const activeAlerts = (alertsResponse.value.alerts ?? []).filter((a: AlertDto) => a.status === "ACTIVE" && a.categoryId != null);
      for (const alert of activeAlerts) {
        const catId = alert.categoryId!;
        if (!alertsBySectorId[catId]) alertsBySectorId[catId] = [];
        alertsBySectorId[catId].push(alert);
      }
    }

    subSectorResults.forEach((result, i) => {
      const data = result.status === "fulfilled" ? result.value : [];
      subSectorCounts[sectorIds[i]] = data.length;
      subSectorBreakdowns[sectorIds[i]] = buildBreakdown(data);
      for (const s of data) allSubSectors.push({ ...s, parentId: sectorIds[i] });
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sectors";
  }

  const quadrantCounts: Record<string, string[]> = { "4": [], "3": [], "2": [], "1": [] };
  const signalCounts: Record<TradeSignal, string[]> = { BUY: [], WATCH: [], HOLD: [], REDUCE: [] };
  let crossHorizonDivCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  for (const s of sectors) {
    if (s.rrgQuadrant && quadrantCounts[s.rrgQuadrant]) {
      quadrantCounts[s.rrgQuadrant].push(s.etfTicker);
    }
    const sig = (s.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(s);
    if (sig && signalCounts[sig]) signalCounts[sig].push(s.etfTicker);
    if (s.rs20 != null && s.rs60 != null && s.rs120 != null) {
      const gap = 0.001;
      const shortBull = s.rs20 > s.rs60 + gap;
      const shortBear = s.rs20 < s.rs60 - gap;
      const medBull = s.rs60 > s.rs120 + gap;
      const medBear = s.rs60 < s.rs120 - gap;
      if ((shortBull && medBear) || (shortBear && medBull)) crossHorizonDivCount++;
    }
    if (s.compositeScore != null) { scoreSum += s.compositeScore; scoreCount++; }
  }
  const avgScore = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 100) : null;
  const hasQuadrantData = sectors.some(s => s.rrgQuadrant != null);
  const bullishCount = (quadrantCounts["4"]?.length ?? 0) + (quadrantCounts["3"]?.length ?? 0);
  const marketBias = bullishCount >= 7 ? "Broad Bull" : bullishCount >= 4 ? "Mixed" : "Broad Bear";

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Sub-Sector Rotation
          </h1>
          <span
            className="text-[11px] text-slate-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            11 GICS sectors · {Object.values(subSectorCounts).reduce((a, b) => a + b, 0)} sub-sector ETFs
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-xl">
          Each sub-sector is benchmarked against its parent sector ETF — not the S&amp;P 500.
          A positive RS score means capital is rotating into that sub-sector <em>within</em> its sector.
        </p>

        {hasQuadrantData && (
          <>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50 flex-wrap">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">
              Sector Rotation
            </span>
            {QUADRANT_STRIP_CONFIG.map(({ key, label, colorClass, dotClass }) => {
              const tickers = quadrantCounts[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                  <span className={`text-[11px] font-semibold ${colorClass}`} style={{ fontFamily: "var(--font-rajdhani)" }}>
                    {label}
                  </span>
                  <span className="text-[11px] text-slate-400" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {tickers.length > 0 ? `(${tickers.length})` : "—"}
                  </span>
                  {tickers.length > 0 && (
                    <span className="text-[10px] text-slate-600 hidden xl:inline" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                      {tickers.join(" · ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Signals + breadth stats row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">
              Signals
            </span>
            {(["BUY", "WATCH", "HOLD", "REDUCE"] as const).map(sig => {
              const count = signalCounts[sig].length;
              const color = sig === "BUY" ? "text-green-400" : sig === "WATCH" ? "text-cyan-400" : sig === "REDUCE" ? "text-red-400" : "text-slate-500";
              const bg = sig === "BUY" ? "bg-green-900/20" : sig === "WATCH" ? "bg-cyan-900/20" : sig === "REDUCE" ? "bg-red-900/20" : "bg-slate-800/40";
              return (
                <span
                  key={sig}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${color} ${bg}`}
                  style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.06em" }}
                  title={`${count} sector${count !== 1 ? "s" : ""} on ${sig}: ${signalCounts[sig].join(", ") || "none"}`}
                >
                  {sig} {count}
                </span>
              );
            })}
            <span className="text-slate-700 text-[10px] mx-1">·</span>
            {avgScore != null && (
              <span
                className={`text-[10px] font-mono tabular-nums ${avgScore >= 60 ? "text-emerald-400" : avgScore >= 40 ? "text-slate-400" : "text-red-400"}`}
                title={`Average composite score across all 11 sectors: ${avgScore}/100`}
              >
                Avg {avgScore}
              </span>
            )}
            <span
              className={`text-[10px] font-semibold ${bullishCount >= 7 ? "text-emerald-400" : bullishCount >= 4 ? "text-amber-400" : "text-red-400"}`}
              title={`${bullishCount} of ${sectors.length} sectors in Leading or Improving RRG phase — ${marketBias}`}
            >
              {marketBias}
            </span>
            {crossHorizonDivCount > 0 && (
              <span
                className="text-[10px] text-orange-400 font-mono"
                title={`${crossHorizonDivCount} sector${crossHorizonDivCount > 1 ? "s" : ""} with cross-horizon RS divergence (short-term direction contradicts medium-term)`}
              >
                ÷{crossHorizonDivCount} horizon div
              </span>
            )}
          </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors.map((sector) => (
            <SectorCard key={sector.id} sector={sector} history={scoreHistory[sector.id] ?? []} subSectorCount={subSectorCounts[sector.id] ?? 0} sectorAlerts={alertsBySectorId[sector.id] ?? []} subSectorBreakdown={subSectorBreakdowns[sector.id] ?? buildBreakdown([])} />
          ))}
        </div>

        {sectors.length === 0 && !error && (
          <p className="text-slate-500 text-sm">No sector data available. Trigger ingestion first.</p>
        )}

        {allSubSectors.some(s => s.rs20 != null) && (
          <SubSectorLeaderboard leaders={allSubSectors} />
        )}

        <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Signal methodology:</span>{" "}
          Rotation quadrant (Leading / Improving / Weakening / Lagging) is derived from the Relative Rotation Graph
          using 60-day RS ratio and momentum vs SPY. Within each sector, sub-sector signals measure rotation
          relative to the parent sector ETF — not SPY.
        </div>
      </main>
    </div>
  );
}
