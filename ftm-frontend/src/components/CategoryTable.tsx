"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { CategorySummary, SubSectorSummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import Sparkline from "@/components/Sparkline";
import GlossaryTooltip from "@/components/GlossaryTooltip";

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  EQUITY_SECTOR:  { label: "Equity",         className: "bg-blue-900/50 text-blue-300 border border-blue-800/40" },
  FIXED_INCOME:   { label: "Fixed Income",   className: "bg-purple-900/50 text-purple-300 border border-purple-800/40" },
  PRECIOUS_METAL: { label: "Precious Metal", className: "bg-yellow-900/50 text-yellow-300 border border-yellow-800/40" },
  CURRENCY:       { label: "Currency",       className: "bg-emerald-900/50 text-emerald-300 border border-emerald-800/40" },
  CASH:           { label: "Cash",           className: "bg-slate-700 text-slate-300 border border-slate-600" },
  ALTERNATIVE:    { label: "Alternative",    className: "bg-slate-700 text-slate-300 border border-slate-600" },
};

const TYPE_SECTION_LABELS: Record<string, string> = {
  PRECIOUS_METAL: "Precious Metals",
  FIXED_INCOME:   "Fixed Income",
  CASH:           "Cash",
};

const RRG_QUADRANT_CONFIG: Record<number, { label: string; color: string; borderClass: string }> = {
  4: { label: "↗ Leading",   color: "text-green-400",  borderClass: "border-l-green-500"  },
  3: { label: "↖ Improving", color: "text-cyan-400",   borderClass: "border-l-cyan-500"   },
  2: { label: "↘ Weakening", color: "text-orange-400", borderClass: "border-l-orange-500" },
  1: { label: "↙ Lagging",   color: "text-slate-400",  borderClass: "border-l-slate-600"  },
};

function TrendPip({
  trend,
  label,
}: {
  trend: number | null;
  label: string;
}) {
  if (trend == null) return null;
  const pts = Math.round(trend * 100);
  const abs = Math.abs(pts);
  if (abs < 1) return null;
  const color = pts > 0 ? "text-emerald-400" : "text-red-400";
  const arrow = pts > 0 ? "↑" : "↓";
  return (
    <span
      className={`text-[9px] tabular-nums ${color}`}
      title={`${label} composite score trend: ${pts > 0 ? "+" : ""}${pts} pts`}
    >
      {arrow}{abs}
    </span>
  );
}

function computeStreak(history: number[]): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const direction = last > prev ? 1 : last < prev ? -1 : 0;
  if (direction === 0) return 0;
  let count = 1;
  for (let i = history.length - 2; i > 0; i--) {
    if (direction === 1 && history[i] > history[i - 1]) count++;
    else if (direction === -1 && history[i] < history[i - 1]) count++;
    else break;
  }
  return direction * count;
}

function StreakBadge({ streak }: { streak: number }) {
  if (Math.abs(streak) < 3) return null;
  const isUp = streak > 0;
  const label = `${isUp ? "↑" : "↓"}${Math.abs(streak)}d`;
  const className = isUp
    ? "text-emerald-400 bg-emerald-900/20 border border-emerald-800/40"
    : "text-red-400 bg-red-900/20 border border-red-800/40";
  const title = `${Math.abs(streak)} consecutive day${Math.abs(streak) > 1 ? "s" : ""} of ${isUp ? "improving" : "declining"} composite score`;
  return (
    <span className={`inline-block px-1 py-0 rounded text-[8px] tabular-nums font-mono ${className}`} title={title}>
      {label}
    </span>
  );
}

function PersistenceVelocity({
  persistence5d,
  persistence20d,
}: {
  persistence5d: number | null;
  persistence20d: number | null;
}) {
  if (persistence5d == null || persistence20d == null) return null;
  const rate5d = persistence5d / 5;
  // prior-15d baseline excludes the overlapping recent 5 days
  const prior15 = persistence20d - persistence5d;
  const rate15 = prior15 / 15;
  const velocityPct = Math.round((rate5d - rate15) * 100);
  if (Math.abs(velocityPct) < 5) return null;
  const isAccel = velocityPct > 0;
  const color = isAccel ? "text-emerald-400" : "text-red-400";
  const arrow = isAccel ? "⚡" : "⬇";
  return (
    <span
      className={`text-[8px] tabular-nums ${color}`}
      title={`Breadth velocity: recent-5d ${Math.round(rate5d * 100)}% vs prior-15d ${Math.round(rate15 * 100)}% — ${isAccel ? "accelerating" : "decelerating"} (${velocityPct > 0 ? "+" : ""}${velocityPct}pp)`}
    >
      {arrow}
    </span>
  );
}

function ScoreBar({
  score,
  trend5d,
  trend20d,
  macroFit,
  persistence5d,
  persistence20d,
  momentum,
}: {
  score: number | null;
  trend5d: number | null;
  trend20d: number | null;
  macroFit?: number | null;
  persistence5d?: number | null;
  persistence20d?: number | null;
  momentum?: number | null;
}) {
  if (score == null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const filledCount = Math.round(score * 5);
  const barColor = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  const macroFitPct = macroFit != null ? Math.round(macroFit * 100) : null;
  const macroFitColor = macroFitPct != null ? (macroFitPct >= 60 ? "bg-violet-500" : macroFitPct >= 40 ? "bg-violet-400/60" : "bg-slate-600") : null;
  const persistPct = persistence20d != null ? Math.round((persistence20d / 20) * 100) : null;
  const persistColor = persistPct != null ? (persistPct >= 60 ? "text-emerald-500" : persistPct >= 40 ? "text-slate-500" : "text-red-500") : null;
  const momPts = momentum != null ? Math.round(momentum * 100) : null;
  const momColor = momPts != null ? (momPts > 1 ? "text-emerald-400" : momPts < -1 ? "text-red-400" : "text-slate-600") : null;
  const momArrow = momPts != null ? (momPts > 1 ? "▲" : momPts < -1 ? "▼" : null) : null;

  return (
    <div
      className="flex flex-col gap-0.5"
      title={`Composite signal score: ${pct}/100.${macroFitPct != null ? `\nMacro Fit: ${macroFitPct}% — historical win rate in current macro regime.` : ""}${persistence20d != null ? `\nPersistence: ${persistence20d}/20 days outperformed benchmark.` : ""}${momPts != null ? `\nMomentum (MOM): ${momPts > 0 ? "+" : ""}${momPts} pts — 10-day RS change.` : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-3.5 rounded-[2px] ${i < filledCount ? barColor : "bg-slate-700"}`}
            />
          ))}
        </div>
        <span className={`text-xs tabular-nums font-medium ${score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
          {pct}
        </span>
        <TrendPip trend={trend5d} label="5d" />
        <TrendPip trend={trend20d} label="20d" />
        {persistPct != null && (
          <span className={`text-[8px] tabular-nums ${persistColor}`} title={`Persistence: ${persistence20d}/20 days outperformed benchmark (${persistPct}%)`}>
            {persistence20d}d
          </span>
        )}
        <PersistenceVelocity persistence5d={persistence5d ?? null} persistence20d={persistence20d ?? null} />
        {momArrow != null && momColor != null && (
          <span className={`text-[8px] tabular-nums ${momColor}`} title={`Momentum: ${momPts! > 0 ? "+" : ""}${momPts} pts (10-day RS change)`}>
            {momArrow}
          </span>
        )}
      </div>
      {macroFitPct != null && (
        <div className="flex items-center gap-1" title={`Macro Fit: ${macroFitPct}% — historical RS win rate in current regime`}>
          <div className="w-10 h-0.5 rounded-full bg-slate-700/60 overflow-hidden">
            <div className={`h-full rounded-full ${macroFitColor}`} style={{ width: `${macroFitPct}%` }} />
          </div>
          <span className="text-[9px] text-slate-600 tabular-nums">M{macroFitPct}%</span>
        </div>
      )}
    </div>
  );
}

const RS_LABEL: Record<string, string> = {
  DAY:     "20d",
  WEEK:    "20d",
  MONTH:   "60d",
  QUARTER: "120d",
  YEAR:    "120d",
};

function RsCell({ value, rs120, period, rankPct }: { value: number | null; rs120?: number | null; period: string; rankPct?: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const accel = rs120 != null ? value - rs120 : null;
  const accelPts = accel != null ? Math.round(accel * 100) : null;
  const accelColor = accelPts != null && accelPts > 0 ? "text-emerald-400" : "text-red-400";
  const accelArrow = accelPts != null && accelPts > 0 ? "↗" : "↘";
  const rankColor = rankPct != null ? (rankPct >= 70 ? "text-emerald-500" : rankPct >= 30 ? "text-slate-500" : "text-red-500") : null;
  return (
    <span className="inline-flex items-center gap-1" title={`${period}-day relative strength vs benchmark. Positive = outperforming.${accelPts != null ? `\nAcceleration vs 120d: ${accelPts > 0 ? "+" : ""}${accelPts} pts` : ""}${rankPct != null ? `\nRS peer rank: ${rankPct}th percentile among 11 GICS sectors` : ""}`}>
      <span className={`tabular-nums ${color}`}>{value > 0 ? "+" : ""}{pct}%</span>
      {accelPts != null && Math.abs(accelPts) >= 1 && (
        <span className={`text-[9px] tabular-nums ${accelColor}`}>{accelArrow}</span>
      )}
      {rankPct != null && rankColor && (
        <span className={`text-[8px] tabular-nums ${rankColor}`} title={`${rankPct}th percentile RS among 11 GICS sectors`}>P{rankPct}</span>
      )}
    </span>
  );
}

function buildScoreTooltip(cat: import("@/lib/api").CategorySummary, macroFitVal: number | null): string {
  const pct = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
  const rs60Str = cat.rs60 != null ? `${cat.rs60 > 0 ? "+" : ""}${(cat.rs60 * 100).toFixed(1)}%` : "—";
  const rs120Str = cat.rs120 != null ? `${cat.rs120 > 0 ? "+" : ""}${(cat.rs120 * 100).toFixed(1)}%` : "—";
  const rrgLabel = cat.rrgQuadrant ? ({ "4": "Leading ↗", "3": "Improving ↖", "2": "Weakening ↘", "1": "Lagging ↙" }[cat.rrgQuadrant] ?? "—") : "—";
  const macroFitStr = macroFitVal != null ? `${Math.round(macroFitVal * 100)}% win rate in current regime` : "—";
  const trend5dPts = cat.compositeTrend5d != null ? Math.round(cat.compositeTrend5d * 100) : null;
  const trend20dPts = cat.compositeTrend20d != null ? Math.round(cat.compositeTrend20d * 100) : null;
  const persist20Str = cat.persistence20d != null ? `${cat.persistence20d}/20 days outperformed benchmark` : "n/a (computing)";
  const persist5d = cat.persistence5d;
  const persist20d = cat.persistence20d;
  let velocityStr = "";
  if (persist5d != null && persist20d != null) {
    const rate5d = Math.round((persist5d / 5) * 100);
    const prior15 = persist20d - persist5d;
    const rate15 = Math.round((prior15 / 15) * 100);
    const delta = rate5d - rate15;
    velocityStr = `Breadth velocity: recent-5d ${rate5d}% vs prior-15d ${rate15}% (${delta > 0 ? "+" : ""}${delta}pp — ${delta > 4 ? "accelerating ⚡" : delta < -4 ? "decelerating ⬇" : "neutral"})`;
  }
  const momPts = cat.momentum != null ? Math.round(cat.momentum * 100) : null;
  const momStr = momPts != null ? `${momPts > 0 ? "+" : ""}${momPts} pts (10d RS change — ${momPts > 1 ? "accelerating ▲" : momPts < -1 ? "decelerating ▼" : "flat →"})` : "n/a";
  return [
    `Composite Score: ${pct ?? "—"}/100`,
    ``,
    `RS-60 (25% weight): ${rs60Str}`,
    `RS-120 (10% weight, confirmation): ${rs120Str}`,
    `Persistence 20d (20% weight): ${persist20Str}`,
    `Momentum (15% weight): ${momStr}`,
    `Macro Fit (10% weight): ${macroFitStr}`,
    `RRG (10% weight): ${rrgLabel}`,
    `Flow 20d (10% weight): 20-day dollar volume z-score — positive = inflows above average`,
    velocityStr,
    ``,
    trend5dPts != null ? `5d score trend: ${trend5dPts > 0 ? "+" : ""}${trend5dPts} pts` : "",
    trend20dPts != null ? `20d score trend: ${trend20dPts > 0 ? "+" : ""}${trend20dPts} pts` : "",
  ].filter(Boolean).join("\n");
}


const TRADE_SIGNAL_CONFIG: Record<TradeSignal, { label: string; className: string; description: string }> = {
  BUY:    { label: "BUY",    className: "bg-green-900/60 text-green-300 border-green-700/60",  description: "Score ≥65, improving RRG quadrant, positive 20d trend — all three aligned" },
  WATCH:  { label: "WATCH",  className: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",     description: "Score ≥50, momentum or RRG improving — worth monitoring for entry" },
  HOLD:   { label: "HOLD",   className: "bg-slate-700/60 text-slate-400 border-slate-600/60",  description: "Mixed signals — maintain existing position, no strong directional bias" },
  REDUCE: { label: "REDUCE", className: "bg-red-900/50 text-red-400 border-red-700/50",        description: "Score <35 with weakening/lagging RRG — consider trimming exposure" },
};

function TradeSignalBadge({ cat }: { cat: CategorySummary }) {
  const signal = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
  if (signal == null) return <span className="text-slate-600 text-xs">—</span>;
  const cfg = TRADE_SIGNAL_CONFIG[signal];
  const score = cat.compositeScore ?? 0;
  const quadrant = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;
  const trend20d = cat.compositeTrend20d;
  const scoreOk = score >= 0.65;
  const rrgOk = quadrant === 3 || quadrant === 4;
  const trendOk = trend20d != null && trend20d > 0;
  const conditionsMet = (scoreOk ? 1 : 0) + (rrgOk ? 1 : 0) + (trendOk ? 1 : 0);
  const showConditions = signal === "WATCH" || signal === "HOLD";
  const daysActive = cat.signalDaysActive;
  const showDays = daysActive != null && daysActive >= 2 && (signal === "BUY" || signal === "WATCH");
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.className}`}
        title={cfg.description}
      >
        {cfg.label}
      </span>
      {showDays && (
        <span
          className="text-[8px] text-slate-500 tabular-nums font-mono"
          title={`Signal active for ${daysActive} consecutive trading days (composite score ≥ 50)`}
        >
          {daysActive}d
        </span>
      )}
      {showConditions && conditionsMet > 0 && (
        <div
          className="flex gap-0.5 text-[8px]"
          title={`BUY needs all 3: Score≥65 ${scoreOk ? "✓" : "✗"} · RRG Improving/Leading ${rrgOk ? "✓" : "✗"} · 20d trend+ ${trendOk ? "✓" : "✗"}`}
        >
          <span className={scoreOk ? "text-emerald-400" : "text-slate-700"} title={`Score ${Math.round(score * 100)}/100 ${scoreOk ? "≥65 ✓" : "<65 ✗"}`}>S</span>
          <span className={rrgOk ? "text-emerald-400" : "text-slate-700"} title={`RRG ${rrgOk ? "Improving/Leading ✓" : "Weakening/Lagging ✗"}`}>R</span>
          <span className={trendOk ? "text-emerald-400" : "text-slate-700"} title={`20d trend ${trendOk ? "positive ✓" : "negative/null ✗"}`}>T</span>
        </div>
      )}
    </div>
  );
}

function TopSubChip({ sub }: { sub: SubSectorSummary }) {
  const rs = sub.rs60;
  const color = rs == null ? "text-slate-400" : rs > 0 ? "text-emerald-400" : "text-red-400";
  const rsPct = rs != null ? `${rs > 0 ? "+" : ""}${(rs * 100).toFixed(1)}%` : null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono bg-slate-700/60 border border-slate-600/50 text-slate-400"
      title={`Top sub-sector: ${sub.name} (${sub.etfTicker})${rsPct ? ` — RS-60 vs sector: ${rsPct}` : ""}`}
    >
      <span className="text-slate-500">▲</span>
      <span className="text-slate-300">{sub.etfTicker}</span>
      {rsPct && <span className={color}>{rsPct}</span>}
    </span>
  );
}

type SortKey = "default" | "score" | "rs" | "signal" | "close" | "macroFit";
type SortDir = "asc" | "desc";

const SIGNAL_ORDER: Record<string, number> = { BUY: 0, WATCH: 1, HOLD: 2, REDUCE: 3 };

function sortCategories(
  cats: CategorySummary[],
  key: SortKey,
  dir: SortDir,
  deriveSignal: (c: CategorySummary) => TradeSignal | null,
): CategorySummary[] {
  if (key === "default") return cats;
  return [...cats].sort((a, b) => {
    let delta = 0;
    switch (key) {
      case "score":
        delta = (a.compositeScore ?? -1) - (b.compositeScore ?? -1);
        break;
      case "rs":
        delta = (a.rs60 ?? -Infinity) - (b.rs60 ?? -Infinity);
        break;
      case "signal": {
        const sa = deriveSignal(a) ?? "HOLD";
        const sb = deriveSignal(b) ?? "HOLD";
        delta = (SIGNAL_ORDER[sa] ?? 99) - (SIGNAL_ORDER[sb] ?? 99);
        break;
      }
      case "close":
        delta = (a.latestClose ?? -1) - (b.latestClose ?? -1);
        break;
      case "macroFit":
        delta = (a.macroFit ?? -1) - (b.macroFit ?? -1);
        break;
    }
    return dir === "desc" ? -delta : delta;
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-0.5 text-slate-700 text-[9px]">⇅</span>;
  return <span className="ml-0.5 text-cyan-400 text-[9px]">{dir === "desc" ? "↓" : "↑"}</span>;
}

export default function CategoryTable({
  categories,
  timeframe = "MONTH",
  scoreHistory = {},
  topSubSectors = {},
}: {
  categories: CategorySummary[];
  timeframe?: string;
  scoreHistory?: Record<string, number[]>;
  topSubSectors?: Record<string, SubSectorSummary>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rsLabel = RS_LABEL[timeframe] ?? "60d";
  const hasHistory = Object.keys(scoreHistory).length > 0;
  const colSpan = hasHistory ? 9 : 8;

  const getSignal = (c: CategorySummary) => (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);
  const isSorted = sortKey !== "default";
  const sorted = sortCategories(categories, sortKey, sortDir, getSignal);

  // RS percentile rank: rank each top-level equity sector among its 11 GICS peers
  const equityPeers = sorted.filter(c => SECTOR_DRILLDOWN_IDS.has(c.id) && c.rs60 != null);
  const sortedByRs = [...equityPeers].sort((a, b) => (a.rs60 ?? 0) - (b.rs60 ?? 0));
  const rsRankPctMap = new Map<string, number>(
    sortedByRs.map((c, i) => [c.id, Math.round(((i + 1) / sortedByRs.length) * 100)])
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey("default"); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir(key === "signal" ? "asc" : "desc");
    }
  }

  function SortTh({ children, sortK, className = "" }: { children: React.ReactNode; sortK: SortKey; className?: string }) {
    return (
      <th
        className={`px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors ${className} ${sortKey === sortK ? "text-cyan-400" : ""}`}
        onClick={() => handleSort(sortK)}
        title={`Sort by ${sortK}`}
      >
        <span className="inline-flex items-center gap-0.5">
          {children}
          <SortIcon active={sortKey === sortK} dir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      {isSorted && (
        <div className="px-4 py-1.5 bg-cyan-900/20 border-b border-cyan-800/30 flex items-center gap-2 text-[10px] text-cyan-400">
          <span>Sorted by <strong>{sortKey}</strong> {sortDir === "desc" ? "(highest first)" : "(lowest first)"}</span>
          <button
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => { setSortKey("default"); setSortDir("desc"); }}
          >
            ✕ Reset
          </button>
        </div>
      )}
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 w-8">#</th>
            <th className="px-4 py-3">ETF</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <SortTh sortK="close" className="text-right">Close</SortTh>
            {hasHistory && (
              <th className="px-3 py-3 text-center" title="30-day composite score trend (sparkline)">30d Trend</th>
            )}
            <SortTh sortK="score" className="text-center">
              <GlossaryTooltip term="Composite Score">Score</GlossaryTooltip>
            </SortTh>
            <SortTh sortK="rs" className="text-right">
              <GlossaryTooltip term="RS-60">vs Benchmark ({rsLabel})</GlossaryTooltip>
            </SortTh>
            <SortTh sortK="macroFit" className="text-center">
              <GlossaryTooltip term="Macro Fit">Regime</GlossaryTooltip>
            </SortTh>
            <SortTh sortK="signal" className="text-center">
              <GlossaryTooltip term="RRG">Signal</GlossaryTooltip> / <GlossaryTooltip term="BUY">Action</GlossaryTooltip>
            </SortTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((cat, idx) => {
            const typeConfig = TYPE_CONFIG[cat.type] ?? TYPE_CONFIG.ALTERNATIVE;
            const prevType = idx > 0 ? sorted[idx - 1].type : null;
            const showDivider = !isSorted && prevType !== cat.type && TYPE_SECTION_LABELS[cat.type] != null;
            const history = scoreHistory[cat.id] ?? [];
            const quadrantInfo = cat.rrgQuadrant != null ? RRG_QUADRANT_CONFIG[Number(cat.rrgQuadrant)] : null;
            const rowBorderClass = quadrantInfo ? quadrantInfo.borderClass : "border-l-slate-700/20";

            return (
              <Fragment key={cat.id}>
                {showDivider && (
                  <tr>
                    <td colSpan={colSpan + 1} className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-900/60 uppercase tracking-widest border-t border-slate-700/60">
                      {TYPE_SECTION_LABELS[cat.type]}
                    </td>
                  </tr>
                )}
                <tr className={`hover:bg-slate-800/50 transition-colors text-slate-200 border-l-[3px] ${rowBorderClass}`}>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums text-xs">{isSorted ? idx + 1 : cat.rank}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-300 font-medium">
                    <div className="flex items-center flex-wrap gap-x-0.5">
                      {SECTOR_DRILLDOWN_IDS.has(cat.id) ? (
                        <Link href={`/sectors/${cat.id}`} className="hover:text-cyan-300 transition-colors underline decoration-blue-700/50 hover:decoration-cyan-400/70">
                          {cat.etfTicker}
                        </Link>
                      ) : cat.etfTicker}
                      {SECTOR_DRILLDOWN_IDS.has(cat.id) && topSubSectors[cat.id] && (
                        <TopSubChip sub={topSubSectors[cat.id]} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {SECTOR_DRILLDOWN_IDS.has(cat.id) ? (
                      <Link href={`/sectors/${cat.id}`} className="hover:text-cyan-300 transition-colors">
                        {cat.name}
                      </Link>
                    ) : cat.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeConfig.className}`}>
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                    {cat.latestClose != null ? `$${Number(cat.latestClose).toFixed(2)}` : "—"}
                  </td>
                  {hasHistory && (
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <Sparkline values={history} />
                        <StreakBadge streak={computeStreak(history)} />
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5" title={buildScoreTooltip(cat, cat.macroFit ?? null)}>
                    <div className="flex justify-center">
                      <ScoreBar score={cat.compositeScore} trend5d={cat.compositeTrend5d} trend20d={cat.compositeTrend20d} macroFit={cat.macroFit ?? null} persistence5d={cat.persistence5d ?? null} persistence20d={cat.persistence20d ?? null} momentum={cat.momentum ?? null} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RsCell value={cat.rs60} rs120={cat.rs120} period={rsLabel.replace("d", "")} rankPct={rsRankPctMap.get(cat.id) ?? null} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {cat.macroFit != null ? (
                      <div className="flex flex-col items-center gap-0.5" title={`Macro Fit: ${Math.round(cat.macroFit * 100)}% — historical RS win rate in current regime`}>
                        <div className="w-12 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cat.macroFit >= 0.6 ? "bg-violet-500" : cat.macroFit >= 0.4 ? "bg-violet-400/50" : "bg-slate-600"}`}
                            style={{ width: `${Math.round(cat.macroFit * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[9px] tabular-nums ${cat.macroFit >= 0.6 ? "text-violet-400" : cat.macroFit >= 0.4 ? "text-violet-500" : "text-slate-600"}`}>
                          {Math.round(cat.macroFit * 100)}%
                        </span>
                      </div>
                    ) : <span className="text-slate-700 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {quadrantInfo ? (
                        <span className={`text-xs ${quadrantInfo.color}`}>{quadrantInfo.label}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                      <TradeSignalBadge cat={cat} />
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2.5 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-500 bg-slate-800/40 flex-wrap">
        {(["EQUITY_SECTOR", "PRECIOUS_METAL", "FIXED_INCOME", "CASH"] as const).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_CONFIG[type].className}`}>
              {TYPE_CONFIG[type].label}
            </span>
          </span>
        ))}
        <span className="ml-auto text-[10px]" title="Click any column header to sort. Click again to reverse. Click a third time to reset.">
          Click headers to sort · S/R/T = BUY conditions met · ⇅ = sortable
        </span>
      </div>
    </div>
  );
}
