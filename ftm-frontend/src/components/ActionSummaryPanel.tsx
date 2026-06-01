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
};

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

function ActionCard({ card, side }: { card: ActionCard; side: "BUY" | "REDUCE" }) {
  const style = SIGNAL_STYLES[side];
  const scorePct = Math.round(card.score * 100);
  const rsPct = card.rs60 != null ? `${card.rs60 > 0 ? "+" : ""}${(card.rs60 * 100).toFixed(1)}%` : null;
  const volPct = card.realizedVol20d != null ? `${Math.round(card.realizedVol20d * 100)}%vol` : null;
  const trendPts = card.scoreTrend20d != null ? Math.round(card.scoreTrend20d * 100) : null;
  const rrgLabel: Record<string, string> = { "4": "Leading ↗", "3": "Improving ↖", "2": "Weakening ↘", "1": "Lagging ↙" };
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(card.id);

  return (
    <div className={`flex-1 min-w-0 bg-slate-800/60 border ${style.border} rounded-xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{style.label}</span>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style.badge}`}>
          {card.signal}
          {card.signalDaysActive != null && card.signalDaysActive >= 2 && (
            <span className="ml-1 opacity-70 font-normal">{card.signalDaysActive}d</span>
          )}
        </span>
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
        <div className="flex flex-col" title="Composite signal score">
          <span className="text-[9px] text-slate-600 uppercase">Score</span>
          <span className={`text-sm font-mono font-semibold ${scorePct >= 65 ? "text-green-400" : scorePct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
            {scorePct}
            {trendPts != null && trendPts !== 0 && (
              <span className={`text-[9px] ml-0.5 ${trendPts > 0 ? "text-emerald-500" : "text-red-500"}`}>
                {trendPts > 0 ? "↑" : "↓"}{Math.abs(trendPts)}
              </span>
            )}
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
      </div>
    </div>
  );
}

type Props = {
  categories: CategorySummary[];
  winRateByCategory?: Record<string, SignalWinRateDto>;
  priceLevelByCategory?: Record<string, PriceLevelDto>;
};

export default function ActionSummaryPanel({ categories, winRateByCategory = {}, priceLevelByCategory = {} }: Props) {
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
