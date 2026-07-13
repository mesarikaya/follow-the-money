import { SubSectorSummary } from "@/lib/api";

/**
 * What the factor ETFs say about the market's mood. Momentum (MTUM) leading with low-volatility
 * (USMV) trailing is the classic risk-on read; the reverse is defensive rotation. No React.
 */

export type RegimeSignal = {
  label: string;
  description: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
};

const MOMENTUM = "MTUM";
const LOW_VOLATILITY = "USMV";
const QUALITY = "QUAL";

/** A factor with no relative-strength reading cannot be ranked; it sorts to the bottom. */
const UNRANKED = 99;

const MIN_FACTORS_FOR_A_READ = 2;

const REGIMES = {
  strongRiskOn: {
    label: "Strong Risk-On",
    description: "Momentum dominant, low-vol at bottom — market in high-conviction risk-on phase",
    colorClass: "text-emerald-300",
    borderClass: "border-emerald-700/50",
    bgClass: "bg-emerald-900/20",
  },
  strongRiskOff: {
    label: "Strong Risk-Off",
    description: "Low-vol dominant, momentum at bottom — capital rotating to defensives",
    colorClass: "text-amber-300",
    borderClass: "border-amber-700/50",
    bgClass: "bg-amber-900/20",
  },
  riskOn: {
    label: "Risk-On",
    description: "Momentum in top half — market favoring growth and higher-beta exposure",
    colorClass: "text-emerald-400",
    borderClass: "border-emerald-800/40",
    bgClass: "bg-emerald-900/15",
  },
  riskOff: {
    label: "Risk-Off",
    description: "Low-vol in top half — defensive rotation underway, monitor breadth",
    colorClass: "text-amber-400",
    borderClass: "border-amber-800/40",
    bgClass: "bg-amber-900/15",
  },
  lateCycle: {
    label: "Late Cycle / Quality",
    description:
      "Quality momentum leads — often signals late-cycle selectivity with narrowing leadership",
    colorClass: "text-blue-300",
    borderClass: "border-blue-700/40",
    bgClass: "bg-blue-900/20",
  },
  transitional: {
    label: "Transitional",
    description: "No clear factor dominance — factors in mixed rotation, await confirmation",
    colorClass: "text-slate-300",
    borderClass: "border-slate-700/40",
    bgClass: "bg-slate-800/40",
  },
} as const satisfies Record<string, RegimeSignal>;

/**
 * Reads the regime from where momentum, low-volatility and quality rank against each other by
 * relative strength. Null when fewer than two factors have a reading — with one, there is no
 * "leading" or "lagging" to speak of.
 */
export const deriveFactorRegime = (factors: SubSectorSummary[]): RegimeSignal | null => {
  const ranked = factors
    .filter(factor => factor.rs60 !== null)
    .sort((a, b) => (b.rs60 ?? 0) - (a.rs60 ?? 0));
  if (ranked.length < MIN_FACTORS_FOR_A_READ) return null;

  const rankOf = (id: string) => ranked.findIndex(factor => factor.id === id) + 1 || UNRANKED;
  const momentum = rankOf(MOMENTUM);
  const lowVolatility = rankOf(LOW_VOLATILITY);
  const quality = rankOf(QUALITY);
  const last = ranked.length;

  if (momentum === 1 && lowVolatility === last) return REGIMES.strongRiskOn;
  if (lowVolatility === 1 && momentum === last) return REGIMES.strongRiskOff;
  if (momentum <= 2 && lowVolatility >= 3) return REGIMES.riskOn;
  if (lowVolatility <= 2 && momentum >= 3) return REGIMES.riskOff;
  if (quality === 1 && momentum <= 2) return REGIMES.lateCycle;
  return REGIMES.transitional;
};
