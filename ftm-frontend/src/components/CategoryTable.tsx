"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { CategorySummary, PriceLevelDto, SubSectorSummary } from "@/lib/api";
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

function VolatilityBadge({ vol }: { vol: number | null }) {
  if (vol == null) return null;
  const pct = Math.round(vol * 100);
  const color = pct >= 30 ? "text-red-400" : pct >= 20 ? "text-orange-400" : pct >= 12 ? "text-slate-400" : "text-emerald-500";
  const label = pct >= 30 ? "HV" : pct >= 20 ? "MV" : "LV";
  return (
    <span
      className={`text-[7px] tabular-nums font-mono ${color}`}
      title={`20d realized annualized volatility: ${pct}% — ${label === "HV" ? "high risk" : label === "MV" ? "moderate risk" : "low risk"}`}
    >
      ~{pct}%
    </span>
  );
}

function FlowBadge({ flow20d }: { flow20d: number | null }) {
  if (flow20d == null || Math.abs(flow20d) < 0.8) return null;
  const surge = Math.abs(flow20d) >= 1.5;
  const inflow = flow20d > 0;
  const color = surge
    ? (inflow ? "text-emerald-400" : "text-red-400")
    : (inflow ? "text-cyan-500" : "text-orange-400");
  const icon = surge ? (inflow ? "⬆" : "⬇") : (inflow ? "↑" : "↓");
  const surgeNote = surge ? ` — adds +5 to conviction score` : "";
  return (
    <span
      className={`text-[7px] tabular-nums font-mono ${color}`}
      title={`Flow z-score: ${flow20d > 0 ? "+" : ""}${flow20d.toFixed(1)}σ (20d avg dollar volume). ${inflow ? "Above-average inflows" : "Below-average outflows"}${surgeNote}`}
    >
      F{icon}
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
  realizedVol20d,
  flow20d,
}: {
  score: number | null;
  trend5d: number | null;
  trend20d: number | null;
  macroFit?: number | null;
  persistence5d?: number | null;
  persistence20d?: number | null;
  momentum?: number | null;
  realizedVol20d?: number | null;
  flow20d?: number | null;
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
        {(() => {
          if (trend5d == null || trend20d == null) return null;
          const accel = trend5d - trend20d;
          if (Math.abs(accel) < 0.04) return null;
          const isAccel = accel > 0;
          return (
            <span
              className={`text-[7px] font-mono ${isAccel ? "text-cyan-500" : "text-orange-400"}`}
              title={`Score acceleration: 5d trend (${trend5d > 0 ? "+" : ""}${Math.round(trend5d * 100)}pt) ${isAccel ? ">" : "<"} 20d trend (${trend20d > 0 ? "+" : ""}${Math.round(trend20d * 100)}pt) — momentum is ${isAccel ? "building" : "fading"}`}
            >
              {isAccel ? "↗" : "↘"}
            </span>
          );
        })()}
        {trend5d != null && Math.abs(trend5d) >= 0.12 && (
          <span
            className={`text-[7px] font-bold px-0.5 rounded ${trend5d >= 0.12 ? "text-emerald-300 bg-emerald-900/40 border border-emerald-700/40" : "text-red-300 bg-red-900/40 border border-red-700/40"}`}
            title={`Score velocity ${trend5d >= 0.12 ? "SURGE" : "CRASH"}: ${trend5d >= 0 ? "+" : ""}${Math.round(trend5d * 100)}pts in 5 days — unusual acceleration`}
          >
            {trend5d >= 0.12 ? "⚡" : "⚠"}
          </span>
        )}
        <VolatilityBadge vol={realizedVol20d ?? null} />
        <FlowBadge flow20d={flow20d ?? null} />
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

function RsCell({ value, rs120, rs20, period, rankPct }: { value: number | null; rs120?: number | null; rs20?: number | null; period: string; rankPct?: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const accel = rs120 != null ? value - rs120 : null;
  const accelPts = accel != null ? Math.round(accel * 100) : null;
  const accelColor = accelPts != null && accelPts > 0 ? "text-emerald-400" : "text-red-400";
  const accelArrow = accelPts != null && accelPts > 0 ? "↗" : "↘";
  const rankColor = rankPct != null ? (rankPct >= 70 ? "text-emerald-500" : rankPct >= 30 ? "text-slate-500" : "text-red-500") : null;

  // RS-20 momentum alignment: when rs20 > rs60 > rs120 (all-aligned bullish) or rs20 < rs60 < rs120 (all-aligned bearish)
  const rs20Diff = rs20 != null ? rs20 - value : null;
  const rs20Pts = rs20Diff != null ? Math.round(rs20Diff * 100) : null;
  const allAlignedBullish = rs20 != null && rs120 != null && rs20 > value && value > rs120;
  const allAlignedBearish = rs20 != null && rs120 != null && rs20 < value && value < rs120;
  // Cross-horizon divergence: short-term RS direction contradicts medium-term RS direction
  const gap = 0.001;
  const shortBull = rs20 != null && rs20 > value + gap;
  const shortBear = rs20 != null && rs20 < value - gap;
  const medBull = rs120 != null && value > rs120 + gap;
  const medBear = rs120 != null && value < rs120 - gap;
  const crossHorizonDiv = rs20 != null && rs120 != null && ((shortBull && medBear) || (shortBear && medBull));
  const rs20Title = rs20 != null
    ? `RS-20: ${rs20 > 0 ? "+" : ""}${(rs20 * 100).toFixed(1)}% (fastest RS signal — 20-day window).${rs20Pts != null ? ` Divergence from RS-60: ${rs20Pts > 0 ? "+" : ""}${rs20Pts}pts — ${rs20Pts > 0 ? "short-term outpacing long-term (momentum building)" : "short-term lagging long-term (momentum fading)"}` : ""}${allAlignedBullish ? "\n✓ All RS signals aligned bullish (RS-20 > RS-60 > RS-120) — strong momentum confirmation" : allAlignedBearish ? "\n✗ All RS signals aligned bearish (RS-20 < RS-60 < RS-120) — deteriorating across all horizons" : crossHorizonDiv ? `\n⚠ Cross-horizon RS divergence: short-term ${shortBull ? "bull" : "bear"} but medium-term ${medBull ? "bull" : "bear"} — ${shortBull && medBear ? "counter-trend bounce (fading risk)" : "pullback in bull (potential entry)"}` : ""}`
    : "";

  return (
    <span className="inline-flex items-center gap-1" title={`${period}-day relative strength vs benchmark. Positive = outperforming.${accelPts != null ? `\nAcceleration vs 120d: ${accelPts > 0 ? "+" : ""}${accelPts} pts` : ""}${rankPct != null ? `\nRS peer rank: ${rankPct}th percentile among 11 GICS sectors` : ""}${rs20Title ? "\n" + rs20Title : ""}`}>
      <span className={`tabular-nums ${color}`}>{value > 0 ? "+" : ""}{pct}%</span>
      {accelPts != null && Math.abs(accelPts) >= 1 && (
        <span className={`text-[9px] tabular-nums ${accelColor}`}>{accelArrow}</span>
      )}
      {allAlignedBullish && (
        <span className="text-[7px] text-emerald-500 font-mono" title={rs20Title}>⊕</span>
      )}
      {allAlignedBearish && (
        <span className="text-[7px] text-red-500 font-mono" title={rs20Title}>⊖</span>
      )}
      {crossHorizonDiv && !allAlignedBullish && !allAlignedBearish && (
        <span className="text-[7px] text-orange-400 font-mono" title={rs20Title}>÷</span>
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
  const conviction = cat.convictionScore;
  const showConviction = conviction != null && conviction > 0 && (signal === "BUY" || signal === "REDUCE");
  const convictionColor = conviction != null
    ? conviction >= 75 ? "text-emerald-400" : conviction >= 55 ? "text-amber-400" : "text-slate-500"
    : "text-slate-600";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.className}`}
        title={cfg.description}
      >
        {cfg.label}
      </span>
      {showConviction && (
        <span
          className={`text-[8px] tabular-nums font-mono ${convictionColor}`}
          title={`Conviction score ${conviction}/100: multi-factor quality rating (signal + macro + percentile + momentum + RS accel). ≥75=high, ≥55=medium`}
        >
          C{conviction}
        </span>
      )}
      {showDays && !showConviction && (
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

function TopSubChip({ sub, allSubs }: { sub: SubSectorSummary; allSubs?: SubSectorSummary[] }) {
  const rs = sub.rs60;
  const color = rs == null ? "text-slate-400" : rs > 0 ? "text-emerald-400" : "text-red-400";
  const rsPct = rs != null ? `${rs > 0 ? "+" : ""}${(rs * 100).toFixed(1)}%` : null;

  let breadthNode: React.ReactNode = null;
  if (allSubs && allSubs.length > 1) {
    const withData = allSubs.filter(s => s.rrgQuadrant != null);
    const bullish = withData.filter(s => s.rrgQuadrant === "4" || s.rrgQuadrant === "3").length;
    const pct = withData.length > 0 ? Math.round((bullish / withData.length) * 100) : null;
    const breadthColor = pct == null ? "text-slate-600"
      : pct >= 60 ? "text-green-400"
      : pct >= 40 ? "text-amber-400"
      : "text-red-400";
    const title = withData.length > 0
      ? `${bullish}/${withData.length} sub-sectors bullish (Leading/Improving)`
      : `${allSubs.length} sub-sectors (no signal yet)`;
    breadthNode = (
      <span className={`text-[8px] tabular-nums ${breadthColor}`} title={title}>
        {withData.length > 0 ? `${bullish}/${withData.length}↑` : `${allSubs.length}`}
      </span>
    );
  }

  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono bg-slate-700/60 border border-slate-600/50 text-slate-400"
      title={`Top sub-sector: ${sub.name} (${sub.etfTicker})${rsPct ? ` — RS-60 vs sector: ${rsPct}` : ""}`}
    >
      <span className="text-slate-500">▲</span>
      <span className="text-slate-300">{sub.etfTicker}</span>
      {rsPct && <span className={color}>{rsPct}</span>}
      {breadthNode && <span className="mx-px text-slate-700">·</span>}
      {breadthNode}
    </span>
  );
}

type SortKey = "default" | "score" | "rs" | "signal" | "close" | "macroFit" | "conviction";
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
      case "conviction":
        delta = (a.convictionScore ?? -1) - (b.convictionScore ?? -1);
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
  allSubSectorsByParent = {},
  priceLevels = {},
}: {
  categories: CategorySummary[];
  timeframe?: string;
  scoreHistory?: Record<string, number[]>;
  topSubSectors?: Record<string, SubSectorSummary>;
  allSubSectorsByParent?: Record<string, SubSectorSummary[]>;
  priceLevels?: Record<string, PriceLevelDto>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterText, setFilterText] = useState("");

  const rsLabel = RS_LABEL[timeframe] ?? "60d";
  const hasHistory = Object.keys(scoreHistory).length > 0;
  const colSpan = hasHistory ? 9 : 8;

  const getSignal = (c: CategorySummary) => (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);
  const isSorted = sortKey !== "default";
  const sorted = sortCategories(categories, sortKey, sortDir, getSignal);

  const filterLower = filterText.trim().toLowerCase();
  const isFiltered = filterLower.length > 0;
  const displayed = isFiltered
    ? sorted.filter(
        c =>
          c.name.toLowerCase().includes(filterLower) ||
          c.etfTicker.toLowerCase().includes(filterLower) ||
          c.id.toLowerCase().includes(filterLower)
      )
    : sorted;

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
    <div className="overflow-x-auto rounded-xl border border-slate-700" data-testid="category-table">
      <div className="px-4 py-2 border-b border-slate-700/60 bg-slate-900/40 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter by name, ticker, or ID…"
            aria-label="Filter categories"
            data-testid="category-filter-input"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {isFiltered && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              onClick={() => setFilterText("")}
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
        {isFiltered && (
          <span className="text-[10px] text-slate-500 shrink-0">
            {displayed.length === 0
              ? "No match"
              : `${displayed.length} of ${sorted.length}`}
          </span>
        )}
      </div>
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
            <th className="px-4 py-3 text-center">
              <span
                className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("signal")}
                title="Sort by signal priority (BUY → WATCH → HOLD → REDUCE)"
              >
                <GlossaryTooltip term="RRG">Signal</GlossaryTooltip>
                <SortIcon active={sortKey === "signal"} dir={sortDir} />
              </span>
              <span className="text-slate-700 mx-1">/</span>
              <span
                className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-200 transition-colors"
                onClick={() => handleSort("conviction")}
                title="Sort by conviction score (multi-factor: signal quality · macro · percentile · momentum · RS accel)"
              >
                C
                <SortIcon active={sortKey === "conviction"} dir={sortDir} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {displayed.length === 0 && isFiltered && (
            <tr>
              <td colSpan={colSpan + 1} className="px-4 py-8 text-center text-sm text-slate-500">
                No categories match &ldquo;{filterText}&rdquo;
              </td>
            </tr>
          )}
          {displayed.map((cat, idx) => {
            const typeConfig = TYPE_CONFIG[cat.type] ?? TYPE_CONFIG.ALTERNATIVE;
            const prevType = idx > 0 ? displayed[idx - 1].type : null;
            const showDivider = !isSorted && !isFiltered && prevType !== cat.type && TYPE_SECTION_LABELS[cat.type] != null;
            const history = scoreHistory[cat.id] ?? [];
            const quadrantInfo = cat.rrgQuadrant != null ? RRG_QUADRANT_CONFIG[Number(cat.rrgQuadrant)] : null;
            const rowBorderClass = quadrantInfo ? quadrantInfo.borderClass : "border-l-slate-700/20";
            const velocitySurge = (cat.compositeTrend5d ?? 0) >= 0.12;
            const velocityCrash = (cat.compositeTrend5d ?? 0) <= -0.12;
            const velocityRowClass = velocitySurge ? "bg-emerald-950/[0.08]" : velocityCrash ? "bg-red-950/[0.08]" : "";

            return (
              <Fragment key={cat.id}>
                {showDivider && (
                  <tr>
                    <td colSpan={colSpan + 1} className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-900/60 uppercase tracking-widest border-t border-slate-700/60">
                      {TYPE_SECTION_LABELS[cat.type]}
                    </td>
                  </tr>
                )}
                <tr className={`hover:bg-slate-800/50 transition-colors text-slate-200 border-l-[3px] ${rowBorderClass} ${velocityRowClass}`}>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums text-xs">{isSorted ? idx + 1 : cat.rank}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-300 font-medium">
                    <div className="flex items-center flex-wrap gap-x-0.5">
                      {SECTOR_DRILLDOWN_IDS.has(cat.id) ? (
                        <Link href={`/sectors/${cat.id}`} className="hover:text-cyan-300 transition-colors underline decoration-blue-700/50 hover:decoration-cyan-400/70">
                          {cat.etfTicker}
                        </Link>
                      ) : cat.etfTicker}
                      {SECTOR_DRILLDOWN_IDS.has(cat.id) && topSubSectors[cat.id] && (
                        <TopSubChip sub={topSubSectors[cat.id]} allSubs={allSubSectorsByParent[cat.id]} />
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
                    {(() => {
                      const pl = priceLevels[cat.id];
                      if (!pl || pl.positionInRange == null || pl.drawdownFromHigh == null) return null;
                      const pos = pl.positionInRange;
                      const dd = pl.drawdownFromHigh;
                      const ddPct = Math.round(dd * 100);
                      const barColor = pos >= 0.8 ? "bg-amber-500" : pos >= 0.5 ? "bg-emerald-500" : pos >= 0.2 ? "bg-cyan-500" : "bg-blue-500";
                      return (
                        <div
                          className="mt-1 flex flex-col items-end gap-0.5"
                          title={`52-week range: position ${Math.round(pos * 100)}% of range. Drawdown from 52w high: ${ddPct}%.${pos >= 0.8 ? " Near 52w high — momentum-following entry." : pos <= 0.2 ? " Near 52w low — potential deep value entry." : ""}`}
                        >
                          <div className="relative w-12 h-1 bg-slate-700/60 rounded-full overflow-visible">
                            <div className={`absolute h-full rounded-full ${barColor} opacity-60`} style={{ width: `${Math.round(pos * 100)}%` }} />
                            <div
                              className={`absolute w-1 h-2.5 top-1/2 -translate-y-1/2 -translate-x-0.5 rounded-sm ${barColor}`}
                              style={{ left: `${Math.round(pos * 100)}%` }}
                            />
                          </div>
                          <span className={`text-[8px] tabular-nums font-mono ${ddPct >= -5 ? "text-amber-500" : ddPct >= -15 ? "text-slate-500" : "text-cyan-500"}`}>
                            {ddPct}%
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  {hasHistory && (
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <Sparkline values={history} />
                        <StreakBadge streak={computeStreak(history)} />
                        {(() => {
                          // Prefer 252-day backend percentile; fall back to 30-day computed
                          if (cat.scorePercentile252d != null) {
                            const pct = Math.round(cat.scorePercentile252d * 100);
                            if (pct >= 85 || pct <= 15) {
                              const isHigh = pct >= 85;
                              return (
                                <span
                                  className={`text-[7px] tabular-nums font-mono ${isHigh ? "text-amber-400" : "text-cyan-400"}`}
                                  title={`252-day percentile: current score is at the ${pct}th percentile of the past 12 months — ${isHigh ? "near 12-month highs (late entry risk)" : "near 12-month lows (potential value entry)"}`}
                                >
                                  P{pct}
                                </span>
                              );
                            }
                            return null;
                          }
                          if (history.length < 5 || cat.compositeScore == null) return null;
                          const sorted = [...history].sort((a, b) => a - b);
                          const below = sorted.filter(v => v < cat.compositeScore!).length;
                          const pct = Math.round((below / sorted.length) * 100);
                          if (pct < 15 || pct > 85) {
                            const isHigh = pct > 85;
                            return (
                              <span
                                className={`text-[7px] tabular-nums ${isHigh ? "text-amber-500" : "text-cyan-500"}`}
                                title={`30-day percentile rank: current score is at the ${pct}th percentile of the past ${history.length} sessions`}
                              >
                                P{pct}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5" title={buildScoreTooltip(cat, cat.macroFit ?? null)}>
                    <div className="flex justify-center">
                      <ScoreBar score={cat.compositeScore} trend5d={cat.compositeTrend5d} trend20d={cat.compositeTrend20d} macroFit={cat.macroFit ?? null} persistence5d={cat.persistence5d ?? null} persistence20d={cat.persistence20d ?? null} momentum={cat.momentum ?? null} realizedVol20d={cat.realizedVol20d ?? null} flow20d={cat.flow20d ?? null} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RsCell value={cat.rs60} rs120={cat.rs120} rs20={cat.rs20} period={rsLabel.replace("d", "")} rankPct={rsRankPctMap.get(cat.id) ?? null} />
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
