"use client";

import Link from "next/link";
import { LiveSignals, hasSectorDrilldown } from "@/lib/backtest/liveSignals";

/** What the strategy would hold if it ran today — the live read, before any backtest is run. */

const REGIME_LABEL: Record<string, { label: string; color: string }> = {
  RISK_ON_GROWTH:    { label: "Risk-On Growth",     color: "text-green-400"  },
  RISK_ON_DEFENSIVE: { label: "Risk-On Defensive",  color: "text-cyan-400"   },
  RISK_OFF_FLIGHT:   { label: "Risk-Off / Flight",  color: "text-orange-400" },
  STAGFLATION:       { label: "Stagflation",        color: "text-red-400"    },
};

export function LiveRecommendationsPanel({
  live,
  topN,
  liveRegime,
}: {
  live: LiveSignals;
  topN: number;
  liveRegime: string | null;
}) {
  const { buy: buySignals, watch: watchSignals, reduce: reduceSignals, topPicks: topNLive } = live;
  if (!live.hasData) return null;

  return (
          <div className="mb-5 bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-semibold text-slate-200">Live Signal — What the Strategy Holds Today</span>
              </div>
              <div className="flex items-center gap-3">
                {liveRegime && (() => {
                  const rc = REGIME_LABEL[liveRegime];
                  return rc ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/60 border border-slate-600/60">
                      Regime: <span className={`font-semibold ${rc.color}`}>{rc.label}</span>
                    </span>
                  ) : null;
                })()}
                <span className="text-[10px] text-slate-500">Based on current composite scores</span>
              </div>
            </div>
            <div className="p-4 space-y-3">

              {/* Top-N portfolio preview */}
              {topNLive.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>Top-{topN} Holdings (current strategy picks)</span>
                    <span className="text-slate-600">— equal-weighted if run today</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topNLive.map((cat, i) => {
                      const sig = cat.signal;
                      const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
                      const rrg = cat.rrgQuadrant;
                      const quadrantLabel = rrg === "4" ? "↗ Leading" : rrg === "3" ? "↖ Improving" : rrg === "2" ? "↘ Weakening" : rrg === "1" ? "↙ Lagging" : null;
                      const sigCls = sig === "BUY"
                        ? "bg-green-900/50 border-green-700/60 text-green-300"
                        : sig === "WATCH"
                        ? "bg-cyan-900/40 border-cyan-700/50 text-cyan-300"
                        : "bg-slate-700/50 border-slate-600/60 text-slate-400";
                      const hasDrilldown = hasSectorDrilldown(cat.id);
                      const Wrapper = hasDrilldown ? Link : "div" as unknown as typeof Link;
                      return (
                        <Wrapper key={cat.id} href={hasDrilldown ? `/sectors/${cat.id}` : "#"} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-opacity ${hasDrilldown ? "hover:opacity-80 cursor-pointer" : ""} ${sigCls}`}
                          title={`${cat.name} (${cat.etfTicker}) — Score: ${score ?? "??"}/100${quadrantLabel ? ` — RRG: ${quadrantLabel}` : ""}${cat.macroFit != null ? ` — Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""}${hasDrilldown ? " — click to open sector drilldown" : ""}`}>
                          <span className="text-[10px] text-slate-500 tabular-nums w-3 shrink-0">{i + 1}</span>
                          <span className="font-mono font-bold text-sm">{cat.etfTicker}</span>
                          <span className="text-[10px] text-slate-400 hidden md:inline">{cat.name}</span>
                          {score != null && (
                            <span className="text-[10px] tabular-nums opacity-70">{score}/100</span>
                          )}
                          {sig && (
                            <span className={`text-[9px] font-bold uppercase opacity-80`}>{sig}</span>
                          )}
                          {hasDrilldown && <span className="text-[9px] text-slate-600 ml-0.5">↗</span>}
                        </Wrapper>
                      );
                    })}
                    {topNLive.length < topN && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600/40 bg-slate-700/20 text-slate-600 text-[10px]">
                        {topN - topNLive.length}× CASH (BIL) — no qualifying signal
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BUY / WATCH / REDUCE breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/40">
                <div>
                  <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1.5 font-semibold">BUY ({buySignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {buySignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {buySignals.map(cat => (
                      <Link key={cat.id} href={`/sectors/${cat.id}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-800/50 hover:bg-green-900/70 transition-colors"
                        title={`${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${cat.macroFit != null ? `, Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""} — click to open drilldown`}>
                        {cat.etfTicker}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score ≥65 + RRG 3/4 + positive trend</div>
                </div>
                <div>
                  <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1.5 font-semibold">WATCH ({watchSignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {watchSignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {watchSignals.map(cat => {
                      const hasDrilldown = hasSectorDrilldown(cat.id);
                      const title = `${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${cat.macroFit != null ? `, Macro fit: ${Math.round(cat.macroFit * 100)}%` : ""}${hasDrilldown ? " — click to open drilldown" : ""}`;
                      return hasDrilldown ? (
                        <Link key={cat.id} href={`/sectors/${cat.id}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40 hover:bg-cyan-900/60 transition-colors"
                          title={title}>
                          {cat.etfTicker}
                        </Link>
                      ) : (
                        <span key={cat.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 border border-cyan-800/40" title={title}>
                          {cat.etfTicker}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score ≥50 + improving RRG or trend</div>
                </div>
                <div>
                  <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 font-semibold">REDUCE ({reduceSignals.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {reduceSignals.length === 0 && <span className="text-[10px] text-slate-600">None</span>}
                    {reduceSignals.map(cat => {
                      const hasDrilldown = hasSectorDrilldown(cat.id);
                      const title = `${cat.name} — Score: ${cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : "??"}${hasDrilldown ? " — click to open drilldown" : ""}`;
                      return hasDrilldown ? (
                        <Link key={cat.id} href={`/sectors/${cat.id}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-900/60 transition-colors"
                          title={title}>
                          {cat.etfTicker}
                        </Link>
                      ) : (
                        <span key={cat.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40" title={title}>
                          {cat.etfTicker}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[9px] text-slate-600">score &lt;35 + lagging/weakening RRG</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-700/30">
                Live data — scores update after each market close. Hover any ticker for details. BUY = all three conditions aligned; WATCH = two conditions met; run a backtest below to see historical performance.
              </div>
            </div>
          </div>
  );
}
