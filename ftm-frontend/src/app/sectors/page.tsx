import Link from "next/link";
import { fetchCategories, fetchCategoryScoreHistory, CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import Sparkline from "@/components/Sparkline";

const SUB_SECTOR_COUNTS: Record<string, number> = {
  TECH: 8,
  HLTH: 6,
  FINL: 6,
  DISR: 6,
  INDU: 5,
  ENRG: 8,
  MATL: 7,
  UTIL: 3,
  REIT: 5,
  STPL: 3,
  COMM: 5,
};

const QUADRANT_CONFIG: Record<string, {
  label: string;
  badgeClass: string;
  leftBorderClass: string;
}> = {
  "1": {
    label: "↗ Leading",
    badgeClass: "bg-green-500/10 text-green-400 border border-green-500/25",
    leftBorderClass: "border-l-green-500",
  },
  "2": {
    label: "↖ Improving",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25",
    leftBorderClass: "border-l-cyan-500",
  },
  "3": {
    label: "↘ Weakening",
    badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/25",
    leftBorderClass: "border-l-orange-500",
  },
  "4": {
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

function SectorCard({ sector, history }: { sector: CategorySummary; history: number[] }) {
  const quadrant = sector.rrgQuadrant ?? null;
  const qConfig = quadrant ? QUADRANT_CONFIG[quadrant] : null;
  const leftBorderClass = qConfig?.leftBorderClass ?? "border-l-slate-700";
  const subSectorCount = SUB_SECTOR_COUNTS[sector.id] ?? 0;

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
        {qConfig ? (
          <span
            className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded ${qConfig.badgeClass}`}
            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
          >
            {qConfig.label}
          </span>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )}
      </div>

      {/* Signal stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3 py-2 border-y border-slate-700/40">
        <ScoreStat value={sector.compositeScore} trend5d={sector.compositeTrend5d} trend20d={sector.compositeTrend20d} />
        <RsStat label="RS 60d" value={sector.rs60} rs120={sector.rs120} />
        <RankStat rank={sector.rank} />
      </div>

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
        </div>
        <span
          className="text-[11px] text-slate-600 group-hover:text-cyan-400 transition-colors"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          → drill down
        </span>
      </div>
    </Link>
  );
}

export default async function SectorsHubPage() {
  let sectors: CategorySummary[] = [];
  let scoreHistory: Record<string, number[]> = {};
  let error: string | null = null;

  try {
    const [categoriesResponse, historyResponse] = await Promise.all([
      fetchCategories("MONTH"),
      fetchCategoryScoreHistory(30).catch(() => ({})),
    ]);
    sectors = categoriesResponse.categories.filter((c) => SECTOR_DRILLDOWN_IDS.has(c.id));
    scoreHistory = historyResponse;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sectors";
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Sector Sub-Sectors
          </h1>
          <span
            className="text-[11px] text-slate-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            11 GICS sectors · ~85 sub-sector ETFs
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-xl">
          Each sub-sector is benchmarked against its parent sector ETF — not the S&amp;P 500.
          A positive RS score means capital is rotating into that sub-sector <em>within</em> its sector.
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors.map((sector) => (
            <SectorCard key={sector.id} sector={sector} history={scoreHistory[sector.id] ?? []} />
          ))}
        </div>

        {sectors.length === 0 && !error && (
          <p className="text-slate-500 text-sm">No sector data available. Trigger ingestion first.</p>
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
