"use client";

import { useState, useRef, useEffect } from "react";

const TERMS: Record<string, { short: string; detail: string }> = {
  // Core scoring terms
  "Composite Score": {
    short: "0–100 overall signal strength for a category.",
    detail:
      "Weighted average of RS-60 (33%), momentum (27%), macro fit (13%), RRG quadrant (13%), and RS-120 confirmation (13%). Higher = stronger rotation signal. A score above 65 is considered actionable.",
  },
  "RS-60": {
    short: "60-day relative strength vs SPY benchmark.",
    detail:
      "Measures how much a sector has outperformed or underperformed the S&P 500 over the last 60 trading days. Positive = outperforming. This is the strongest signal in the composite score (33% weight).",
  },
  "RS-120": {
    short: "120-day relative strength used as trend confirmation.",
    detail:
      "Longer lookback than RS-60. Used to confirm that recent outperformance isn't just a short-term spike. When RS-60 > RS-120, the sector's momentum is accelerating (bullish). Weight: 13%.",
  },
  "Momentum": {
    short: "Rate of change in the composite score over 5–20 days.",
    detail:
      "Captures whether a sector's signal is strengthening or weakening over the recent short-term. A positive 20d trend means the signal has been improving over the past month. Weight: 27% of composite.",
  },
  "Macro Fit": {
    short: "Historical win rate in the current macro regime.",
    detail:
      "Fraction of historical periods in the current macro regime (Risk-On Growth, Risk-On Defensive, Risk-Off/Flight-to-Safety, or Stagflation) where this sector's RS-60 was positive. A 70% macro fit means the sector outperformed its benchmark 70% of the time in past environments matching today's regime. Weight: 10% of composite score.",
  },
  "RRG": {
    short: "Relative Rotation Graph — visualises sector rotation cycles.",
    detail:
      "Plots each sector's relative strength ratio (vs benchmark) against its RS momentum. Sectors move through four quadrants: Leading → Weakening → Lagging → Improving → Leading. Quadrant 4 (Leading) scores 1.0; Quadrant 1 (Lagging) scores 0.0.",
  },
  "Leading": {
    short: "RRG quadrant 4: high RS, strong positive momentum.",
    detail:
      "The best quadrant. The sector is outperforming the benchmark AND its relative strength is still improving. Historically the most favourable entry zone.",
  },
  "Improving": {
    short: "RRG quadrant 3: below-benchmark RS but momentum is rising.",
    detail:
      "The sector is underperforming but turning around — relative strength is starting to increase. Early-entry signal; often the best risk/reward zone if macro supports it.",
  },
  "Weakening": {
    short: "RRG quadrant 2: above-benchmark RS but momentum slowing.",
    detail:
      "The sector is still outperforming but momentum has peaked and is fading. Time to consider trimming or rotating into Improving sectors. Score weight: 0.67.",
  },
  "Lagging": {
    short: "RRG quadrant 1: below-benchmark RS and momentum still falling.",
    detail:
      "The worst quadrant. The sector is underperforming and the trend is still getting worse. Avoid or underweight unless macro fit is very high (contrarian setup).",
  },
  // Trade signals
  "BUY": {
    short: "All three conditions aligned: score≥65, improving/leading quadrant, positive 20d trend.",
    detail:
      "The highest-confidence signal. Composite score is strong (≥65/100), the sector is in RRG quadrant 3 or 4 (improving momentum), and the 20-day score trend is positive (strengthening). Consider adding or overweighting.",
  },
  "WATCH": {
    short: "Two conditions met: score≥50, with improving RRG or positive trend.",
    detail:
      "A developing signal. The sector scores above average (≥50) and at least one momentum indicator is positive. Monitor closely — if the third condition aligns it becomes a BUY.",
  },
  "HOLD": {
    short: "Mixed signals — maintain current position.",
    detail:
      "No strong directional bias in either direction. Keep existing allocation but do not add or reduce unless another signal changes.",
  },
  "REDUCE": {
    short: "Score<35 and sector in weakening/lagging RRG quadrant.",
    detail:
      "Two negative conditions aligned. The sector's signal is weak AND deteriorating. Consider trimming exposure and rotating into higher-scoring sectors.",
  },
  // Market structure
  "Sharpe Ratio": {
    short: "Return per unit of risk (higher is better).",
    detail:
      "Annualised excess return divided by annualised volatility. A Sharpe above 1.0 is good; above 2.0 is exceptional. Compares the strategy's risk-adjusted return to holding cash.",
  },
  "Calmar Ratio": {
    short: "Annualised return divided by maximum drawdown.",
    detail:
      "Measures how efficiently the strategy recovered from its worst loss. A Calmar of 1.0 means the strategy returned 100% for every 100% it once lost. Higher is better; above 0.5 is solid.",
  },
  "Max Drawdown": {
    short: "Largest peak-to-trough decline during the backtest period.",
    detail:
      "The worst loss an investor would have experienced if they bought at the peak and measured the trough. Expressed as a percentage. Key risk metric — 20% drawdown means a $100 portfolio fell to $80.",
  },
  "Regime": {
    short: "Current macro environment classification.",
    detail:
      "Derived from the 10Y–2Y yield spread, VIX, and 10-year breakeven inflation. Four regimes: Risk-On Growth (steep curve, calm VIX — equities and cyclicals lead), Risk-On Defensive (flat curve, calm VIX — quality and stability favoured), Risk-Off/Flight-to-Safety (VIX >25 or inverted curve — cash, gold, bonds), Stagflation (steep curve, high inflation — energy, materials, real assets).",
  },
  "Alpha": {
    short: "Return above the SPY benchmark.",
    detail:
      "If the strategy returned 15% and SPY returned 10% over the same period, alpha is +5%. Positive alpha means the rotation strategy added value over simply holding the index.",
  },
  "Sub-Sector": {
    short: "A thematic ETF within a GICS sector.",
    detail:
      "Institutions often rotate within a sector before the broad sector ETF moves. For example, within Technology, semiconductors (SOXX) may lead before XLK moves. Monitoring sub-sectors gives earlier signals.",
  },
};

type TermKey = keyof typeof TERMS;

type Props = {
  term: TermKey;
  children?: React.ReactNode;
};

export default function GlossaryTooltip({ term, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const entry = TERMS[term];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!entry) return <>{children ?? term}</>;

  return (
    <span ref={ref} className="relative inline-flex items-center gap-0.5 cursor-help">
      <span
        className="border-b border-dashed border-slate-500 hover:border-slate-300 transition-colors"
        onClick={() => setOpen(v => !v)}
        title={entry.short}
      >
        {children ?? term}
      </span>
      <button
        className="text-[9px] text-slate-600 hover:text-slate-400 leading-none transition-colors"
        onClick={() => setOpen(v => !v)}
        aria-label={`Explain ${term}`}
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-left">
          <div className="text-xs font-semibold text-slate-200 mb-1">{term}</div>
          <div className="text-xs text-slate-300 leading-relaxed mb-2">{entry.short}</div>
          <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-700/60 pt-2">
            {entry.detail}
          </div>
          <button
            className="mt-2 text-[10px] text-slate-600 hover:text-slate-400"
            onClick={() => setOpen(false)}
          >
            close ✕
          </button>
        </div>
      )}
    </span>
  );
}

export { TERMS };
export type { TermKey };
