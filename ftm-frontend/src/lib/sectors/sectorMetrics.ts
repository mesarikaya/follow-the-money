import { AlertDto, CategorySummary, SubSectorSummary } from "@/lib/api";
import { TradeSignal, deriveTradeSignal } from "@/lib/signals";

/**
 * Pure helpers behind the sectors hub: how a sector's sub-sectors are spread across the rotation
 * quadrants, and how the eleven sectors together describe the market. No React.
 */

export type SubSectorBreakdown = {
  leading: number;
  improving: number;
  weakening: number;
  lagging: number;
  noData: number;
  total: number;
};

const QUADRANT_KEYS = { "4": "leading", "3": "improving", "2": "weakening", "1": "lagging" } as const;

/** Sub-sectors counted by the rotation quadrant they sit in. */
export const buildSubSectorBreakdown = (subSectors: SubSectorSummary[]): SubSectorBreakdown => {
  const breakdown: SubSectorBreakdown = {
    leading: 0,
    improving: 0,
    weakening: 0,
    lagging: 0,
    noData: 0,
    total: subSectors.length,
  };
  for (const subSector of subSectors) {
    const quadrant = QUADRANT_KEYS[subSector.rrgQuadrant as keyof typeof QUADRANT_KEYS];
    if (quadrant) breakdown[quadrant]++;
    else breakdown.noData++;
  }
  return breakdown;
};

const SEVERITY_ORDER = ["URGENT", "ACTION", "WARNING", "INFO"];

/** The most severe alert level present, or null when there are no alerts. */
export const worstSeverity = (alerts: AlertDto[]): string | null =>
  SEVERITY_ORDER.find(severity => alerts.some(alert => alert.severity === severity)) ?? null;

const DIVERGENCE_GAP = 0.001;

/**
 * True when the short-term relative-strength direction contradicts the medium-term one — a sector
 * turning under the surface.
 */
export const hasCrossHorizonDivergence = (sector: CategorySummary): boolean => {
  const { rs20, rs60, rs120 } = sector;
  if (rs20 == null || rs60 == null || rs120 == null) return false;
  const isShortBullish = rs20 > rs60 + DIVERGENCE_GAP;
  const isShortBearish = rs20 < rs60 - DIVERGENCE_GAP;
  const isMediumBullish = rs60 > rs120 + DIVERGENCE_GAP;
  const isMediumBearish = rs60 < rs120 - DIVERGENCE_GAP;
  return (isShortBullish && isMediumBearish) || (isShortBearish && isMediumBullish);
};

/** True when relative strength lines up the same way across all three horizons. */
export const rsHorizonAlignment = (sector: CategorySummary): "BULLISH" | "BEARISH" | null => {
  const { rs20, rs60, rs120 } = sector;
  if (rs20 == null || rs60 == null || rs120 == null) return null;
  if (rs20 > rs60 && rs60 > rs120) return "BULLISH";
  if (rs20 < rs60 && rs60 < rs120) return "BEARISH";
  return null;
};

export type SectorsSummary = {
  tickersByQuadrant: Record<string, string[]>;
  tickersBySignal: Record<TradeSignal, string[]>;
  averageScore: number | null;
  crossHorizonDivergenceCount: number;
  bullishCount: number;
  marketBias: string;
  hasQuadrantData: boolean;
};

const BROAD_BULL_THRESHOLD = 7;
const MIXED_THRESHOLD = 4;

const marketBiasFor = (bullishCount: number): string => {
  if (bullishCount >= BROAD_BULL_THRESHOLD) return "Broad Bull";
  if (bullishCount >= MIXED_THRESHOLD) return "Mixed";
  return "Broad Bear";
};

/** The header read-out: where the eleven sectors sit, what they signal, and the resulting bias. */
export const summarizeSectors = (sectors: CategorySummary[]): SectorsSummary => {
  const tickersByQuadrant: Record<string, string[]> = { "4": [], "3": [], "2": [], "1": [] };
  const tickersBySignal: Record<TradeSignal, string[]> = { BUY: [], WATCH: [], HOLD: [], REDUCE: [] };
  const scores: number[] = [];
  let crossHorizonDivergenceCount = 0;

  for (const sector of sectors) {
    if (sector.rrgQuadrant && tickersByQuadrant[sector.rrgQuadrant]) {
      tickersByQuadrant[sector.rrgQuadrant].push(sector.etfTicker);
    }
    const signal = (sector.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(sector);
    if (signal && tickersBySignal[signal]) tickersBySignal[signal].push(sector.etfTicker);
    if (hasCrossHorizonDivergence(sector)) crossHorizonDivergenceCount++;
    if (sector.compositeScore != null) scores.push(sector.compositeScore);
  }

  const bullishCount = tickersByQuadrant["4"].length + tickersByQuadrant["3"].length;

  return {
    tickersByQuadrant,
    tickersBySignal,
    averageScore:
      scores.length > 0
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100)
        : null,
    crossHorizonDivergenceCount,
    bullishCount,
    marketBias: marketBiasFor(bullishCount),
    hasQuadrantData: sectors.some(sector => sector.rrgQuadrant != null),
  };
};
