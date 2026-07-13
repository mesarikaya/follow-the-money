"use client";

import { useBacktest, DATA_START } from "./useBacktest";
import { readLiveSignals } from "@/lib/backtest/liveSignals";
import { LiveRecommendationsPanel } from "@/components/backtest/LiveRecommendationsPanel";
import { BacktestForm } from "@/components/backtest/BacktestForm";
import { BacktestResults } from "@/components/backtest/BacktestResults";

export default function BacktesterPage() {
  const backtest = useBacktest();
  const live = readLiveSignals(backtest.liveCategories, backtest.topN);

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <h1
          className="text-slate-100 font-bold"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
        >
          Backtester
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Historical rotation strategy vs SPY buy-and-hold. Rebalances into top-N sectors by composite score.
          <span className="ml-2 text-slate-600">Data available from {DATA_START}.</span>
        </p>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <LiveRecommendationsPanel
          live={live}
          topN={backtest.topN}
          liveRegime={backtest.liveRegime}
        />

        <div className="grid grid-cols-4 gap-5 min-h-0">
          <BacktestForm backtest={backtest} />
          <BacktestResults backtest={backtest} />
        </div>
      </main>
    </div>
  );
}
