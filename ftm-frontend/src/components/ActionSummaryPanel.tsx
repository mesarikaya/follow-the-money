"use client";

import { CategorySummary, SignalWinRateDto, PriceLevelDto } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type ActionCard = {
  id: string;
  name: string;
  etfTicker: string;
  signal: TradeSignal;
  score: number;
  scoreTrend20d: number | null;
  rs60: number | null;
  realizedVol20d: number | null;
  signalDaysActive: number | null;
  rrgQuadrant: string | null;
  winRate: number | null;
  avgReturn30d: number | null;
  winRateSignalCount: number | null;
  drawdownFromHigh: number | null;
  positionInRange: number | null;
  scoreHistory: number[];
  scorePercentile252d: number | null;
};

function MiniSparkline({ values, side }: { values: number[]; side: "BUY" | "REDUCE" }) {
  if (values.length < 2) return null;
  const pts = values.slice(-20);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 0.01;
  const W = 48, H = 16;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const ys = pts.map(v => H - ((v - min) / range) * H);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const color = side === "BUY" ? "#4ade80" : "#f87171";
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={xs[xs.length - 1].toFixed(1)} cy={ys[ys.length - 1].toFixed(1)} r="1.5" fill={color} opacity="0.9" />
    </svg>
  );
}

const SIGNAL_STYLES: Record<"BUY" | "REDUCE", {
  border: string;
  badge: string;
  dot: string;
  arrow: string;
  label: string;
}> = {
  BUY:    { border: "border-green-700/60",  badge: "bg-green-900/50 text-green-300 border-green-700/60", dot: "bg-green-500", arrow: "↑", label: "Consider Increasing" },
  REDUCE: { border: "border-red-700/50",    badge: "bg-red-900/50 text-red-400 border-red-700/50",      dot: "bg-red-500",   arrow: "↓", label: "Consider Reducing"  },
};

function computeEntryQuality(card: ActionCard, side: "BUY" | "REDUCE"): { label: string; className: string; title: string } | null {
  if (side !== "BUY") return null;

  let score = 0;
  const reasons: string[] = [];

  // Price position: reward pullbacks, penalize near-peak entries
  if (card.drawdownFromHigh != null) {
    if (card.drawdownFromHigh <= -0.20) {
      score += 30;
      reasons.push(`deep pullback (${(card.drawdownFromHigh * 100).toFixed(0)}% from 52w high)`);
    } else if (card.drawdownFromHigh <= -0.08) {
      score += 15;
      reasons.push(`moderate pullback (${(card.drawdownFromHigh * 100).toFixed(0)}%)`);
    } else if (card.drawdownFromHigh >= -0.03) {
      score -= 15;
      reasons.push(`near 52w high — elevated entry risk`);
    }
  }

  // Win rate
  if (card.winRate != null) {
    if (card.winRate >= 0.65) {
      score += 25;
      reasons.push(`strong historical win rate (${Math.round(card.winRate * 100)}%)`);
    } else if (card.winRate >= 0.50) {
      score += 10;
      reasons.push(`moderate win rate (${Math.round(card.winRate * 100)}%)`);
    } else {
      score -= 10;
      reasons.push(`weak win rate (${Math.round(card.winRate * 100)}%)`);
    }
  }

  // Score percentile: near 12-month lows = better entry
  if (card.scorePercentile252d != null) {
    const pct = card.scorePercentile252d * 100;
    if (pct >= 85) {
      score -= 10;
      reasons.push(`score near 12-month high (P${Math.round(pct)})`);
    } else if (pct <= 25) {
      score += 10;
      reasons.push(`score near 12-month low (P${Math.round(pct)}) — early-cycle entry`);
    }
  }

  // Base: BUY signal confirmed = start at 30
  score += 30;

  const normalizedScore = Math.max(0, Math.min(100, score));

  if (normalizedScore >= 65) return {
    label: "Excellent",
    className: "text-emerald-400 bg-emerald-900/20 border-emerald-700/40",
    title: `Entry quality: Excellent (${normalizedScore}/100)\n${reasons.join(" · ")}`,
  };
  if (normalizedScore >= 45) return {
    label: "Good",
    className: "text-cyan-400 bg-cyan-900/15 border-cyan-700/40",
    title: `Entry quality: Good (${normalizedScore}/100)\n${reasons.join(" · ")}`,
  };
  if (normalizedScore >= 30) return {
    label: "Fair",
    className: "text-amber-400 bg-amber-900/15 border-amber-700/40",
    title: `Entry quality: Fair (${normalizedScore}/100)\n${reasons.join(" · ")}`,
  };
  return {
    label: "Risky",
    className: "text-red-400 bg-red-900/15 border-red-700/40",
    title: `Entry quality: Risky (${normalizedScore}/100)\n${reasons.join(" · ")}`,
  };
}

function ActionCard({ card, side }: { card: ActionCard; side: "BUY" | "REDUCE" }) {
  const style = SIGNAL_STYLES[side];
  const scorePct = Math.round(card.score * 100);
  const rsPct = card.rs60 != null ? `${card.rs60 > 0 ? "+" : ""}${(card.rs60 * 100).toFixed(1)}%` : null;
  const volPct = card.realizedVol20d != null ? `${Math.round(card.realizedVol20d * 100)}%vol` : null;
  const trendPts = card.scoreTrend20d != null ? Math.round(card.scoreTrend20d * 100) : null;
  const rrgLabel: Record<string, string> = { "4": "Leading ↗", "3": "Improving ↖", "2": "Weakening ↘", "1": "Lagging ↙" };
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(card.id);
  const entryQuality = computeEntryQuality(card, side);

  return (
    <div className={`flex-1 min-w-0 bg-slate-800/60 border ${style.border} rounded-xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{style.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {entryQuality && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${entryQuality.className}`}
              title={entryQuality.title}
            >
              {entryQuality.label}
            </span>
          )}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style.badge}`}>
            {card.signal}
            {card.signalDaysActive != null && card.signalDaysActive >= 2 && (
              <span className="ml-1 opacity-70 font-normal">{card.signalDaysActive}d</span>
            )}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        {hasDrilldown ? (
          <Link href={`/sectors/${card.id}`} className="hover:text-cyan-300 transition-colors">
            <div className="text-slate-100 font-semibold text-sm truncate">{card.name}</div>
          </Link>
        ) : (
          <div className="text-slate-100 font-semibold text-sm truncate">{card.name}</div>
        )}
        <div className="text-xs text-slate-500 font-mono">{card.etfTicker}</div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col" title={`Composite signal score: ${scorePct}/100${card.scorePercentile252d != null ? ` · 252-day percentile: P${Math.round(card.scorePercentile252d * 100)}` : ""}`}>
          <span className="text-[9px] text-slate-600 uppercase">Score</span>
          <span className={`text-sm font-mono font-semibold ${scorePct >= 65 ? "text-green-400" : scorePct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
            {scorePct}
            {trendPts != null && trendPts !== 0 && (
              <span className={`text-[9px] ml-0.5 ${trendPts > 0 ? "text-emerald-500" : "text-red-500"}`}>
                {trendPts > 0 ? "↑" : "↓"}{Math.abs(trendPts)}
              </span>
            )}
            {card.scorePercentile252d != null && (() => {
              const pct = Math.round(card.scorePercentile252d! * 100);
              if (pct >= 85) return <span className="text-[8px] text-amber-500 ml-0.5">P{pct}</span>;
              if (pct <= 15) return <span className="text-[8px] text-cyan-500 ml-0.5">P{pct}</span>;
              return null;
            })()}
          </span>
        </div>

        {rsPct && (
          <div className="flex flex-col" title="60-day relative strength vs benchmark">
            <span className="text-[9px] text-slate-600 uppercase">RS-60</span>
            <span className={`text-xs font-mono ${card.rs60! > 0 ? "text-green-400" : "text-red-400"}`}>{rsPct}</span>
          </div>
        )}

        {card.rrgQuadrant && (
          <div className="flex flex-col" title="Relative Rotation Graph quadrant">
            <span className="text-[9px] text-slate-600 uppercase">RRG</span>
            <span className={`text-[10px] ${card.rrgQuadrant === "4" ? "text-green-400" : card.rrgQuadrant === "3" ? "text-cyan-400" : card.rrgQuadrant === "2" ? "text-orange-400" : "text-slate-500"}`}>
              {rrgLabel[card.rrgQuadrant] ?? "—"}
            </span>
          </div>
        )}

        {volPct && (
          <div className="flex flex-col" title="20-day realized annualized volatility">
            <span className="text-[9px] text-slate-600 uppercase">Vol</span>
            <span className={`text-[10px] font-mono ${parseInt(volPct) >= 30 ? "text-red-400" : parseInt(volPct) >= 20 ? "text-orange-400" : "text-slate-400"}`}>
              {volPct}
            </span>
          </div>
        )}

        {card.winRate != null && (
          <div
            className="flex flex-col"
            title={`Historical BUY signal win rate over last 12 months (${card.winRateSignalCount} signals). Fraction of new BUY signals followed by positive 30-day return.`}
          >
            <span className="text-[9px] text-slate-600 uppercase">Win%</span>
            <span className={`text-[10px] font-mono font-semibold ${card.winRate >= 0.65 ? "text-green-400" : card.winRate >= 0.50 ? "text-yellow-400" : "text-slate-400"}`}>
              {Math.round(card.winRate * 100)}%
              {card.avgReturn30d != null && (
                <span className={`ml-0.5 text-[8px] ${card.avgReturn30d > 0 ? "text-emerald-500" : "text-red-500"}`}>
                  ({card.avgReturn30d > 0 ? "+" : ""}{(card.avgReturn30d * 100).toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        )}

        {card.drawdownFromHigh != null && (
          <div
            className="flex flex-col"
            title={`52-week price range position: ${card.positionInRange != null ? Math.round(card.positionInRange * 100) + "% of range" : "—"}. Drawdown from 52w high: ${(card.drawdownFromHigh * 100).toFixed(1)}%.`}
          >
            <span className="text-[9px] text-slate-600 uppercase">52wR</span>
            <span className={`text-[10px] font-mono ${card.drawdownFromHigh >= -0.05 ? "text-amber-400" : card.drawdownFromHigh >= -0.15 ? "text-slate-400" : "text-cyan-400"}`}
              title={`${(card.drawdownFromHigh * 100).toFixed(1)}% from 52w high — ${card.drawdownFromHigh >= -0.05 ? "near peak (overbought risk)" : card.drawdownFromHigh >= -0.15 ? "moderate pullback" : "deep pullback (potential value entry)"}`}
            >
              {(card.drawdownFromHigh * 100).toFixed(0)}%
              {card.positionInRange != null && (
                <span className="text-[8px] text-slate-600 ml-0.5">P{Math.round(card.positionInRange * 100)}</span>
              )}
            </span>
          </div>
        )}

        {card.scoreHistory.length >= 5 && (
          <div className="flex flex-col ml-auto" title="30-day composite score trend">
            <span className="text-[9px] text-slate-600 uppercase">30d</span>
            <MiniSparkline values={card.scoreHistory} side={side} />
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  categories: CategorySummary[];
  winRateByCategory?: Record<string, SignalWinRateDto>;
  priceLevelByCategory?: Record<string, PriceLevelDto>;
  scoreHistory?: Record<string, number[]>;
};

export default function ActionSummaryPanel({ categories, winRateByCategory = {}, priceLevelByCategory = {}, scoreHistory = {} }: Props) {
  const getSignal = (c: CategorySummary): TradeSignal | null =>
    (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);

  const toCard = (c: CategorySummary, signal: TradeSignal): ActionCard => {
    const wr = winRateByCategory[c.id];
    const pl = priceLevelByCategory[c.id];
    return {
      id: c.id,
      name: c.name,
      etfTicker: c.etfTicker,
      signal,
      score: c.compositeScore ?? 0,
      scoreTrend20d: c.compositeTrend20d ?? null,
      rs60: c.rs60 ?? null,
      realizedVol20d: c.realizedVol20d ?? null,
      signalDaysActive: c.signalDaysActive ?? null,
      rrgQuadrant: c.rrgQuadrant ?? null,
      winRate: wr?.winRate ?? null,
      avgReturn30d: wr?.avgReturn30d ?? null,
      winRateSignalCount: wr?.signalCount ?? null,
      drawdownFromHigh: pl?.drawdownFromHigh ?? null,
      positionInRange: pl?.positionInRange ?? null,
      scoreHistory: scoreHistory[c.id] ?? [],
      scorePercentile252d: c.scorePercentile252d ?? null,
    };
  };

  const buySignals = categories
    .filter(c => getSignal(c) === "BUY")
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 3);

  const reduceSignals = categories
    .filter(c => getSignal(c) === "REDUCE")
    .sort((a, b) => (a.compositeScore ?? 1) - (b.compositeScore ?? 1))
    .slice(0, 2);

  if (buySignals.length === 0 && reduceSignals.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Action Signals</h2>
        <span className="text-[10px] text-slate-600">Signal-confirmed rotation opportunities</span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {buySignals.map(c => (
          <ActionCard key={c.id} card={toCard(c, "BUY")} side="BUY" />
        ))}
        {reduceSignals.map(c => (
          <ActionCard key={c.id} card={toCard(c, "REDUCE")} side="REDUCE" />
        ))}
      </div>
    </section>
  );
}
