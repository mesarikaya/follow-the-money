import { fetchCategories, fetchMacro, fetchRotation, fetchCategoryScoreHistory, fetchSubSectors, SubSectorSummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import CategoryTable from "@/components/CategoryTable";
import MacroPanel from "@/components/MacroPanel";
import MarketBreadthBar from "@/components/MarketBreadthBar";
import MomentumLeadersPanel from "@/components/MomentumLeadersPanel";
import RotationHeatmap from "@/components/RotationHeatmap";
import RotationPanel from "@/components/RotationPanel";
import RotationPhaseIndicator from "@/components/RotationPhaseIndicator";
import ScoreExtremesPanel from "@/components/ScoreExtremesPanel";
import SignalDivergencePanel from "@/components/SignalDivergencePanel";
import StaleDataBanner from "@/components/StaleDataBanner";
import SectorCorrelationMatrix from "@/components/SectorCorrelationMatrix";
import AllocationBar from "@/components/AllocationBar";
import MarketNarrativePanel from "@/components/MarketNarrativePanel";
import SignalReadinessPanel from "@/components/SignalReadinessPanel";
import ActiveAlertsStrip from "@/components/ActiveAlertsStrip";
import ScoreTrajectorySummary from "@/components/ScoreTrajectorySummary";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ timeframe?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { timeframe = "MONTH" } = await searchParams;

  const sectorIds = Array.from(SECTOR_DRILLDOWN_IDS);

  const [categoriesResult, macroResult, rotationResult, scoreHistoryResult, ...subSectorResults] =
    await Promise.allSettled([
      fetchCategories(timeframe),
      fetchMacro(),
      fetchRotation(),
      fetchCategoryScoreHistory(30),
      ...sectorIds.map((id) => fetchSubSectors(id)),
    ]);

  const topSubSectorByParent: Record<string, SubSectorSummary> = {};
  subSectorResults.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      const sorted = [...result.value].sort(
        (a, b) => (b.rs60 ?? -Infinity) - (a.rs60 ?? -Infinity)
      );
      topSubSectorByParent[sectorIds[i]] = sorted[0];
    }
  });

  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.categories : [];
  const asOfDate =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.asOfDate : null;
  const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
  const rotation = rotationResult.status === "fulfilled" ? rotationResult.value : null;
  const scoreHistory =
    scoreHistoryResult.status === "fulfilled" ? scoreHistoryResult.value : {};

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {categoriesResult.status === "rejected" && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load categories:{" "}
            {String((categoriesResult as PromiseRejectedResult).reason)}
          </div>
        )}

        {categories.length > 0 && <StaleDataBanner categories={categories} />}

        <ActiveAlertsStrip />

        {categories.length > 0 && <AllocationBar categories={categories} />}

        {categories.length > 0 && (
          <MarketNarrativePanel categories={categories} macro={macro} topSubSectors={topSubSectorByParent} />
        )}

        {categories.length > 0 && <SignalReadinessPanel categories={categories} />}

        {categories.length > 0 && Object.keys(scoreHistory).length > 0 && (
          <ScoreTrajectorySummary categories={categories} scoreHistory={scoreHistory} />
        )}

        {categories.length > 0 && <MarketBreadthBar categories={categories} />}

        {categories.length > 0 && <RotationPhaseIndicator categories={categories} />}

        {categories.length > 0 && <MomentumLeadersPanel categories={categories} />}

        {categories.length > 0 && Object.keys(scoreHistory).length > 0 && (
          <ScoreExtremesPanel categories={categories} scoreHistory={scoreHistory} />
        )}

        {categories.length > 0 && <SignalDivergencePanel categories={categories} />}

        {macro && <MacroPanel macro={macro} />}

        {macroResult.status === "rejected" && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load macro data:{" "}
            {String((macroResult as PromiseRejectedResult).reason)}
          </div>
        )}

        {rotation && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-200">Rotation Signals</h2>
            <RotationPanel rotation={rotation} />
          </section>
        )}

        {categories.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-200">Composite Score Heatmap</h2>
            <RotationHeatmap categories={categories} />
          </section>
        )}

        {categories.length > 0 && Object.keys(scoreHistory).length > 0 && (
          <SectorCorrelationMatrix categories={categories} scoreHistory={scoreHistory} />
        )}

        {asOfDate && (
          <div className="text-xs text-slate-500">Data as of {asOfDate}</div>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-200">
            Categories{" "}
            <span className="text-slate-500 font-normal text-sm">
              ({categories.length})
            </span>
          </h2>
          {categories.length > 0 ? (
            <CategoryTable categories={categories} timeframe={timeframe} scoreHistory={scoreHistory} topSubSectors={topSubSectorByParent} />
          ) : (
            <div className="text-slate-500 text-sm py-8 text-center">
              No categories loaded.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
