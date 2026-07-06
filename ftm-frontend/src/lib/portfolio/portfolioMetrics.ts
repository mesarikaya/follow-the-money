// Pure portfolio calculations — no React, no fetching. Extracted from the portfolio page so each
// derivation has a name and a test, and the page reads declaratively (e.g. `computeHoldingsPnl(...)`).
//
// Every function here is a pure function of its inputs: given the same data it always returns the
// same result, which is why they can be unit-tested in isolation (see portfolioMetrics.test.ts).

import { PortfolioResponse, PortfolioAllocationEntry, HoldingDto, CategorySummary, RebalanceSuggestion } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import { getParentSectorId } from "@/lib/sectors";

/** The currency symbol to show for a holding's local currency. */
export function currencySymbol(currency: string | undefined): string {
  switch (currency) {
    case "EUR": return "€";
    case "GBP": return "£";
    case "GBX": return "p";
    case "SEK": return "kr";
    default:    return "$";
  }
}

/** A holding is "stale" when it has no live price, or its price is more than 3 days old. */
export function isStale(holding: HoldingDto): boolean {
  if (!holding.priceSource) return true;
  if (!holding.priceDate) return true;
  const priceAgeMs = Date.now() - new Date(holding.priceDate).getTime();
  return priceAgeMs > 3 * 24 * 60 * 60 * 1000;
}

/** Unrealized profit/loss for one holding, in percent and in local currency. Null if not priced. */
export function unrealizedPnl(holding: HoldingDto): { pct: number; absLocal: number } | null {
  if (holding.currentPriceLocal == null || holding.avgCostLocal == null || holding.avgCostLocal === 0) {
    return null;
  }
  const pct = (holding.currentPriceLocal - holding.avgCostLocal) / holding.avgCostLocal;
  const absLocal = (holding.currentPriceLocal - holding.avgCostLocal) * holding.quantity;
  return { pct, absLocal };
}

/** Widest bar to draw: the largest of any current or optimal weight (floored at 1 to avoid /0). */
export function maxAllocationPct(allocations: PortfolioAllocationEntry[]): number {
  return Math.max(
    ...allocations.map((a) => Math.max(a.allocationPct, a.optimalAllocationPct ?? 0)),
    1,
  );
}

/**
 * Allocation-weighted 12-1 momentum: Σ(weight% × momentumPct) / 100, rounded to a whole percent.
 * `weightPctOf` picks which weight to use (the edited current weight, or the optimal target).
 */
export function weightedMomentumPct(
  allocations: PortfolioAllocationEntry[],
  weightPctOf: (entry: PortfolioAllocationEntry) => number,
): number {
  return Math.round(
    allocations.reduce((sum, entry) => sum + (weightPctOf(entry) / 100) * (entry.momentumPct ?? 0), 0),
  );
}

/**
 * Approximate alignment score (0–100) the portfolio would reach if every rebalance suggestion were
 * applied. Null when there are no suggestions.
 */
export function simulatedAlignmentPercent(portfolio: PortfolioResponse): number | null {
  if (portfolio.rebalanceSuggestions.length === 0) return null;

  const simulatedAllocationByCategory: Record<string, number> = {};
  portfolio.allocations.forEach((a) => { simulatedAllocationByCategory[a.categoryId] = a.allocationPct; });
  portfolio.rebalanceSuggestions.forEach((s) => {
    if (simulatedAllocationByCategory[s.categoryId] !== undefined) {
      simulatedAllocationByCategory[s.categoryId] = Math.max(0, simulatedAllocationByCategory[s.categoryId] + s.deltaPct);
    }
  });

  let overlap = 0;
  portfolio.allocations.forEach((a) => {
    if (a.optimalAllocationPct == null) return;
    overlap += Math.min(simulatedAllocationByCategory[a.categoryId] ?? 0, a.optimalAllocationPct);
  });
  return Math.round(Math.min(overlap, 100));
}

/** The highest-conviction rebalance actions, largest weight change first. */
export function topRebalanceActions(portfolio: PortfolioResponse, limit = 5): RebalanceSuggestion[] {
  return [...portfolio.rebalanceSuggestions]
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, limit);
}

/** Total unrealized P&L across all priced holdings, in EUR and as a percent of cost. */
export function computeHoldingsPnl(
  holdings: HoldingDto[],
): { totalPnlEur: number; totalPnlPct: number | null } | null {
  if (holdings.length === 0) return null;

  let totalPnlEur = 0;
  let totalCostEur = 0;
  for (const h of holdings) {
    if (h.currentPriceLocal == null || h.avgCostLocal == null || h.avgCostLocal === 0 || h.marketValueEur == null) continue;
    const pnlPct = (h.currentPriceLocal - h.avgCostLocal) / h.currentPriceLocal;
    totalPnlEur += h.marketValueEur * pnlPct;
    totalCostEur += h.marketValueEur * (h.avgCostLocal / h.currentPriceLocal);
  }
  const totalPnlPct = totalCostEur > 0 ? totalPnlEur / totalCostEur : null;
  return { totalPnlEur, totalPnlPct };
}

/** The single most concentrated sector, but only if it exceeds 40% of the portfolio. Else null. */
export function findConcentrationRisk(
  holdings: HoldingDto[],
  categoryById: Record<string, CategorySummary>,
  totalEur: number,
): { id: string; name: string; eur: number; pct: number } | null {
  if (totalEur === 0) return null;

  const sectorEur: Record<string, { name: string; eur: number }> = {};
  for (const h of holdings) {
    if (!h.categoryId || h.marketValueEur == null) continue;
    if (!sectorEur[h.categoryId]) {
      sectorEur[h.categoryId] = { name: categoryById[h.categoryId]?.name ?? h.categoryId, eur: 0 };
    }
    sectorEur[h.categoryId].eur += h.marketValueEur;
  }

  const mostConcentrated = Object.entries(sectorEur)
    .map(([id, data]) => ({ id, ...data, pct: (data.eur / totalEur) * 100 }))
    .sort((a, b) => b.pct - a.pct)[0];
  return mostConcentrated && mostConcentrated.pct > 40 ? mostConcentrated : null;
}

export type SectorExposureRow = {
  id: string;
  name: string;
  signal: TradeSignal | null;
  score: number | null;
  targetPct: number | null;
  totalEur: number;
  actualPct: number;
};

/**
 * Groups holdings into their top-level sector (sub-categories rolled up to the parent) and pairs
 * each with its signal and optimal target, for the "Sector Exposure vs Target" table. Returns the
 * rows (largest exposure first) plus any value that could not be classified.
 */
export function sectorExposureRows(
  holdings: HoldingDto[],
  portfolio: PortfolioResponse,
  categoryById: Record<string, CategorySummary>,
  totalEur: number,
): { rows: SectorExposureRow[]; unclassifiedEur: number } {
  const grouped: Record<string, Omit<SectorExposureRow, "id" | "actualPct">> = {};
  let unclassifiedEur = 0;

  for (const h of holdings) {
    const value = h.marketValueEur ?? 0;
    if (!h.categoryId) { unclassifiedEur += value; continue; }

    const sectorId = getParentSectorId(h.categoryId) ?? h.categoryId;
    if (!grouped[sectorId]) {
      const cat = categoryById[sectorId];
      const alloc = portfolio.allocations.find((a) => a.categoryId === sectorId);
      const signal = cat ? ((cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat)) : null;
      grouped[sectorId] = {
        name: cat?.name ?? alloc?.categoryName ?? sectorId,
        totalEur: 0,
        signal,
        score: cat?.compositeScore != null ? Math.round(cat.compositeScore * 100) : null,
        targetPct: alloc?.optimalAllocationPct ?? null,
      };
    }
    grouped[sectorId].totalEur += value;
  }

  const rows = Object.entries(grouped)
    .map(([id, data]) => ({ id, ...data, actualPct: totalEur > 0 ? (data.totalEur / totalEur) * 100 : 0 }))
    .sort((a, b) => b.totalEur - a.totalEur);
  return { rows, unclassifiedEur };
}
