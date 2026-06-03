"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPortfolio } from "@/lib/api";
import { CategorySummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

type GapItem = {
  categoryId: string;
  categoryName: string;
  etfTicker: string;
  signal: "BUY" | "REDUCE";
  currentPct: number;
  optimalPct: number;
  deltaPct: number;
  score: number;
  flow20d: number | null;
  rsAligned: boolean;
};

export default function PortfolioGapAlert({ categories }: { categories: CategorySummary[] }) {
  const [gaps, setGaps] = useState<GapItem[]>([]);

  useEffect(() => {
    fetchPortfolio()
      .then(portfolio => {
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const items: GapItem[] = [];

        for (const suggestion of portfolio.rebalanceSuggestions) {
          if (!suggestion.signalAligned) continue;
          const delta = Math.abs(suggestion.deltaPct);
          if (delta < 3) continue;
          const cat = categoryMap.get(suggestion.categoryId);
          if (!cat) continue;
          const sig = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
          if (sig !== "BUY" && sig !== "REDUCE") continue;
          const rsAligned = sig === "BUY"
            ? (cat.rs20 != null && cat.rs60 != null && cat.rs120 != null && cat.rs20 > cat.rs60 && cat.rs60 > cat.rs120)
            : (cat.rs20 != null && cat.rs60 != null && cat.rs120 != null && cat.rs20 < cat.rs60 && cat.rs60 < cat.rs120);
          items.push({
            categoryId: suggestion.categoryId,
            categoryName: suggestion.categoryName,
            etfTicker: cat.etfTicker,
            signal: sig,
            currentPct: suggestion.currentAllocationPct,
            optimalPct: suggestion.optimalAllocationPct,
            deltaPct: suggestion.deltaPct,
            score: Math.round((cat.compositeScore ?? 0) * 100),
            flow20d: cat.flow20d ?? null,
            rsAligned,
          });
        }

        items.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
        setGaps(items.slice(0, 4));
      })
      .catch(() => {});
  }, [categories]);

  if (gaps.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap py-0.5">
      <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest shrink-0">Portfolio gap</span>
      {gaps.map(gap => {
        const isBuy = gap.signal === "BUY";
        const border = isBuy ? "border-green-700/40 bg-green-900/10 text-green-300" : "border-red-700/40 bg-red-900/10 text-red-400";
        const arrow = isBuy ? "↑" : "↓";
        const deltaStr = `${isBuy ? "+" : ""}${gap.deltaPct.toFixed(0)}%`;
        return (
          <Link
            key={gap.categoryId}
            href="/portfolio"
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] hover:opacity-80 transition-opacity ${border}`}
            title={`${gap.categoryName} — ${isBuy ? "underweight" : "overweight"} ${gap.signal}: currently ${gap.currentPct.toFixed(1)}%, optimal ${gap.optimalPct.toFixed(1)}% (delta ${deltaStr}). Score: ${gap.score}/100.${gap.flow20d != null && Math.abs(gap.flow20d) >= 0.8 ? ` Flow z: ${gap.flow20d > 0 ? "+" : ""}${gap.flow20d.toFixed(1)}σ.` : ""}${gap.rsAligned ? " RS all-aligned — momentum confirmed across all horizons." : ""}`}
          >
            <span className="font-mono font-bold">{gap.etfTicker}</span>
            <span className="text-[9px] opacity-70">{arrow}{Math.abs(gap.deltaPct).toFixed(0)}%</span>
            {gap.rsAligned && (
              <span className={`text-[7px] font-mono ${isBuy ? "text-emerald-500" : "text-red-500"}`} title="All RS timeframes aligned in signal direction (RS-20 / RS-60 / RS-120)">
                {isBuy ? "⊕" : "⊖"}
              </span>
            )}
            {gap.flow20d != null && Math.abs(gap.flow20d) >= 0.8 && (
              <span
                className={`text-[7px] font-mono ${Math.abs(gap.flow20d) >= 1.5 ? (isBuy ? "text-emerald-400" : "text-red-400") : (isBuy ? "text-cyan-500" : "text-orange-400")}`}
                title={`Institutional flow z: ${gap.flow20d > 0 ? "+" : ""}${gap.flow20d.toFixed(1)}σ — ${Math.abs(gap.flow20d) >= 1.5 ? "surge" : "above avg"}`}
              >
                F{Math.abs(gap.flow20d) >= 1.5 ? (isBuy ? "⬆" : "⬇") : (isBuy ? "↑" : "↓")}
              </span>
            )}
            <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${isBuy ? "bg-green-900/40 text-green-400" : "bg-red-900/30 text-red-400"}`}>
              {gap.signal}
            </span>
          </Link>
        );
      })}
      <Link href="/portfolio" className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors ml-auto">
        → Portfolio →
      </Link>
    </div>
  );
}
