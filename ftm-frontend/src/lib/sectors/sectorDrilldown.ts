import { SubSectorSummary } from "@/lib/api";
import { TradeSignal, deriveTradeSignal } from "@/lib/signals";

/**
 * What a sector's sub-sectors add up to: how they are spread across the rotation quadrants and the
 * trade signals, and the sentence that describes it. No React.
 */

export const SECTOR_META: Record<string, { name: string; etfTicker: string }> = {
  TECH: { name: "Information Technology", etfTicker: "XLK"  },
  HLTH: { name: "Health Care",            etfTicker: "XLV"  },
  FINL: { name: "Financials",             etfTicker: "XLF"  },
  DISR: { name: "Consumer Discretionary", etfTicker: "XLY"  },
  INDU: { name: "Industrials",            etfTicker: "XLI"  },
  ENRG: { name: "Energy",                 etfTicker: "XLE"  },
  MATL: { name: "Materials",              etfTicker: "XLB"  },
  UTIL: { name: "Utilities",              etfTicker: "XLU"  },
  REIT: { name: "Real Estate",            etfTicker: "XLRE" },
  STPL: { name: "Consumer Staples",       etfTicker: "XLP"  },
  COMM: { name: "Communication Services", etfTicker: "XLC"  },
};

export type SectorBreakdown = {
  byQuadrant: Record<string, SubSectorSummary[]>;
  bySignal: Record<string, SubSectorSummary[]>;
  bullishCount: number;
  bearishCount: number;
  ratedCount: number;
};

/** Sub-sectors grouped by rotation quadrant and by trade signal, with the bull/bear tallies. */
export const breakDownSubSectors = (subSectors: SubSectorSummary[]): SectorBreakdown => {
  const byQuadrant: Record<string, SubSectorSummary[]> = { "4": [], "3": [], "2": [], "1": [] };
  const bySignal: Record<string, SubSectorSummary[]> = { BUY: [], WATCH: [], HOLD: [], REDUCE: [] };

  for (const subSector of subSectors) {
    if (subSector.rrgQuadrant && byQuadrant[subSector.rrgQuadrant]) {
      byQuadrant[subSector.rrgQuadrant].push(subSector);
    }
    const signal = (subSector.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(subSector);
    if (signal && bySignal[signal]) bySignal[signal].push(subSector);
  }

  return {
    byQuadrant,
    bySignal,
    bullishCount: byQuadrant["4"].length + byQuadrant["3"].length,
    bearishCount: byQuadrant["2"].length + byQuadrant["1"].length,
    ratedCount: subSectors.filter(subSector => subSector.rrgQuadrant != null).length,
  };
};

export type ConfluenceStrength = "strong" | "moderate" | "mixed" | "weak";
export type ConfluenceNarrative = { text: string; strength: ConfluenceStrength };

const plural = (count: number) => (count > 1 ? "s" : "");

/**
 * The sentence at the top of the drilldown: is the whole sector rotating together, or is it only a
 * few names? Null when nothing in the sector has a rotation reading yet.
 */
export const buildConfluenceNarrative = (
  breakdown: SectorBreakdown,
  sectorName: string,
): ConfluenceNarrative | null => {
  const { bullishCount, bearishCount, ratedCount, bySignal } = breakdown;
  if (ratedCount === 0) return null;

  const bullishPercent = Math.round((bullishCount / ratedCount) * 100);
  const buyCount = bySignal.BUY?.length ?? 0;
  const watchCount = bySignal.WATCH?.length ?? 0;
  const actionableCount = buyCount + watchCount;

  if (bullishPercent >= 75) {
    return {
      strength: "strong",
      text: `${bullishCount} of ${ratedCount} ${sectorName} sub-sectors are in Leading or Improving phases — broad-based rotation strength. ${
        buyCount > 0
          ? `${buyCount} BUY signal${plural(buyCount)} confirm entry readiness.`
          : "Watch for BUY signals to confirm."
      }`,
    };
  }
  if (bullishPercent >= 50) {
    return {
      strength: "moderate",
      text: `${bullishCount} of ${ratedCount} sub-sectors show bullish RRG momentum in ${sectorName}. ${
        actionableCount > 0
          ? `${actionableCount} actionable signal${plural(actionableCount)} present.`
          : "Signals mixed — size positions cautiously."
      }`,
    };
  }
  if (bullishPercent >= 25) {
    return {
      strength: "mixed",
      text: `Rotation in ${sectorName} is mixed — ${bullishCount} bullish vs ${bearishCount} bearish sub-sectors. Select only the Leading names; avoid sector-wide exposure.`,
    };
  }
  return {
    strength: "weak",
    text: `${bearishCount} of ${ratedCount} ${sectorName} sub-sectors are in Weakening or Lagging phases — broad deterioration in sector rotation. Reduce or avoid until momentum stabilizes.`,
  };
};
