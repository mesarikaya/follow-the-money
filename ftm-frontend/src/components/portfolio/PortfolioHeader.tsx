"use client";

import { PortfolioResponse } from "@/lib/api";

/** The page header: the alignment score, and how the portfolio's momentum compares with the target. */

const ALIGNMENT_CONFIG = {
  ALIGNED:    { label: "Aligned",    colorClass: "text-emerald-400", barClass: "bg-emerald-500" },
  PARTIAL:    { label: "Partial",    colorClass: "text-amber-400",   barClass: "bg-amber-500"   },
  MISALIGNED: { label: "Misaligned", colorClass: "text-red-400",     barClass: "bg-red-500"     },
} as const;

export const ALIGNMENT_TOOLTIP =
  "Alignment score: fraction of your portfolio that is correctly placed relative to signal-optimal weights. " +
  "Formula: Σ min(actual%, optimal%) / 100 across all signal-tracked categories. " +
  "Cash and untracked positions contribute 0 — they reduce your score proportionally.\n" +
  "100 = fully invested matching signal proportions exactly · ALIGNED ≥ 70 · PARTIAL 40–69 · MISALIGNED < 40";

const MomentumReadout = ({
  momentumPct,
  optimalMomentumPct,
}: {
  momentumPct: number;
  optimalMomentumPct: number | null;
}) => (
  <div
    className="flex items-center gap-2"
    title={`Portfolio Momentum: allocation-weighted 12-1 momentum of your current holdings.\nFormula: Σ(allocationPct × category 12-1 momentum) / 100.\nMomentum-optimal target: ${optimalMomentumPct}% (if allocated per the recommendation).`}
  >
    <span
      className="text-[10px] text-slate-500 uppercase tracking-widest"
      style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600 }}
    >
      Momentum
    </span>
    <span
      className={`text-sm font-mono font-semibold ${momentumPct > 0 ? "text-emerald-400" : momentumPct < 0 ? "text-red-400" : "text-yellow-400"}`}
    >
      {momentumPct > 0 ? "+" : ""}
      {momentumPct}%
    </span>
    {optimalMomentumPct !== null && (
      <span className="text-[10px] text-slate-600">
        /{" "}
        <span className="text-slate-500">
          {optimalMomentumPct > 0 ? "+" : ""}
          {optimalMomentumPct}% opt
        </span>
      </span>
    )}
  </div>
);

export const PortfolioHeader = ({
  portfolio,
  momentumPct,
  optimalMomentumPct,
}: {
  portfolio: PortfolioResponse | null;
  momentumPct: number | null;
  optimalMomentumPct: number | null;
}) => {
  const alignmentScorePercent = portfolio ? Math.round(portfolio.alignmentScore * 100) : 0;
  const alignment = portfolio ? ALIGNMENT_CONFIG[portfolio.alignmentLabel] : null;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
      <h1
        className="text-slate-100 font-bold"
        style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
      >
        Portfolio
      </h1>
      {portfolio && alignment && (
        <div className="flex items-center gap-6">
          {momentumPct !== null && (
            <MomentumReadout momentumPct={momentumPct} optimalMomentumPct={optimalMomentumPct} />
          )}
          <div className="flex items-center gap-4" title={ALIGNMENT_TOOLTIP}>
            <span className={`text-sm font-semibold ${alignment.colorClass}`}>{alignment.label}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${alignment.barClass}`}
                  style={{ width: `${alignmentScorePercent}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-300">
                {alignmentScorePercent}
                <span className="text-slate-600">/100</span>
              </span>
              <span className="text-[10px] text-slate-600 cursor-help" title={ALIGNMENT_TOOLTIP}>
                (?)
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
