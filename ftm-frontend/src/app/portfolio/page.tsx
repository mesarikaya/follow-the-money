"use client";

import { useHoldings } from "./useHoldings";
import { usePortfolio } from "./usePortfolio";
import AllocationDonutChart from "@/components/AllocationDonutChart";
import PortfolioOverview from "@/components/PortfolioOverview";
import CollapsibleSection from "@/components/CollapsibleSection";
import SectorExposureSection from "@/components/portfolio/SectorExposureSection";
import HoldingsSection from "@/components/portfolio/HoldingsSection";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { AllocationsEditor } from "@/components/portfolio/AllocationsEditor";
import { RebalanceSuggestionsPanel } from "@/components/portfolio/RebalanceSuggestionsPanel";
import {
  ConcentrationRiskBanner,
  PortfolioValueHistory,
  RecommendedActionsTable,
  UniverseSwitcher,
  UnownedBuyRadar,
} from "@/components/portfolio/PortfolioPanels";
import {
  computeHoldingsPnl,
  findConcentrationRisk,
  isStale,
  sectorExposureRows,
  topRebalanceActions,
  weightedMomentumPct,
} from "@/lib/portfolio/portfolioMetrics";
import { unownedBuySignals } from "@/lib/portfolio/portfolioRecommendations";

export default function PortfolioPage() {
  const portfolioState = usePortfolio();
  const {
    portfolio,
    selectionUniverse,
    setSelectionUniverse,
    priceLevelByCategory,
    winRateByCategory,
    categoryById,
    editedAllocations,
    totalAllocation,
    isValidTotal,
    isSaving,
    isDirty,
    saveError,
    loadError,
    portfolioSnapshots,
    portfolioActions,
    changeAllocation,
    save,
    reset,
    reloadPortfolioAndActions,
  } = portfolioState;

  // Holdings own themselves; they only tell the portfolio to refresh what depends on them.
  const holdingsState = useHoldings(reloadPortfolioAndActions);
  const { holdings } = holdingsState;

  const totalEur = holdings
    ? holdings.reduce((sum, holding) => sum + (holding.marketValueEur ?? 0), 0)
    : null;

  // Allocation-weighted 12-1 momentum of the current vs the optimal (momentum-driven) portfolio.
  const portfolioMomentumPct = portfolio
    ? weightedMomentumPct(
        portfolio.allocations,
        entry => parseFloat(editedAllocations[entry.categoryId] ?? "0") || 0,
      )
    : null;
  const optimalMomentumPct = portfolio
    ? weightedMomentumPct(portfolio.allocations, entry => entry.optimalAllocationPct ?? 0)
    : null;

  const cashPct = portfolio
    ? portfolio.allocations.find(allocation => allocation.categoryId === "CASH")?.allocationPct ?? 0
    : 0;

  const radarSignals = holdings ? unownedBuySignals(categoryById, holdings) : [];
  const concentrationRisk =
    holdings && totalEur != null ? findConcentrationRisk(holdings, categoryById, totalEur) : null;
  const hasHoldingsValue = holdings != null && holdings.length > 0 && totalEur != null && totalEur > 0;

  return (
    <div className="flex flex-col h-full">
      <PortfolioHeader
        portfolio={portfolio}
        momentumPct={portfolioMomentumPct}
        optimalMomentumPct={optimalMomentumPct}
      />

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {loadError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load portfolio: {loadError}
          </div>
        )}

        <UniverseSwitcher selectionUniverse={selectionUniverse} onSelect={setSelectionUniverse} />

        {portfolio && (
          <PortfolioOverview
            totalValueLabel={
              totalEur != null
                ? `€${totalEur.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`
                : "—"
            }
            alignmentScore={portfolio.alignmentScore}
            alignmentLabel={portfolio.alignmentLabel}
            cashPct={cashPct}
            investedPct={100 - cashPct}
            actions={topRebalanceActions(portfolio)}
          />
        )}

        {portfolio && (
          <CollapsibleSection
            title="Allocations & Rebalancing"
            subtitle="edit target weights · optimal-mix donut · rebalance suggestions · radar"
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AllocationsEditor
                portfolio={portfolio}
                editedAllocations={editedAllocations}
                totalAllocation={totalAllocation}
                isValidTotal={isValidTotal}
                isDirty={isDirty}
                isSaving={isSaving}
                saveError={saveError}
                onChange={changeAllocation}
                onSave={save}
                onReset={reset}
              />

              <div className="flex flex-col gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex flex-col items-center">
                  <h2 className="text-sm font-semibold text-slate-200 w-full mb-3">Allocation Overview</h2>
                  <AllocationDonutChart
                    allocations={portfolio.allocations}
                    alignmentScore={portfolio.alignmentScore}
                    alignmentLabel={portfolio.alignmentLabel}
                  />
                </div>

                <RebalanceSuggestionsPanel
                  portfolio={portfolio}
                  priceLevelByCategory={priceLevelByCategory}
                  winRateByCategory={winRateByCategory}
                  categoryById={categoryById}
                  totalEur={totalEur}
                />

                <UnownedBuyRadar categories={radarSignals} />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {!portfolio && !loadError && (
          <div className="text-slate-500 text-sm text-center py-16">Loading portfolio…</div>
        )}

        <PortfolioValueHistory snapshots={portfolioSnapshots} />

        {hasHoldingsValue && portfolio && (() => {
          const { rows, unclassifiedEur } = sectorExposureRows(
            holdings!,
            portfolio,
            categoryById,
            totalEur!,
          );
          return (
            <SectorExposureSection rows={rows} unclassifiedEur={unclassifiedEur} totalEur={totalEur!} />
          );
        })()}

        <ConcentrationRiskBanner risk={concentrationRisk} />

        <RecommendedActionsTable actions={portfolioActions} />

        <HoldingsSection
          holdingsState={holdingsState}
          categoryById={categoryById}
          totalEur={totalEur}
          staleCount={holdings ? holdings.filter(isStale).length : 0}
          holdingsSummary={holdings ? computeHoldingsPnl(holdings) : null}
        />
      </main>
    </div>
  );
}
