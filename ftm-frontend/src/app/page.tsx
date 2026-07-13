import { loadDashboard } from "@/app/dashboardData";
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
import ScoreDistributionPanel from "@/components/ScoreDistributionPanel";
import MarketPulseStrip from "@/components/MarketPulseStrip";
import ActionSummaryPanel from "@/components/ActionSummaryPanel";
import PortfolioGapAlert from "@/components/PortfolioGapAlert";
import ScoreMoversPanel from "@/components/ScoreMoversPanel";
import SignalTransitionsPanel from "@/components/SignalTransitionsPanel";
import DailyPlaybookPanel from "@/components/DailyPlaybookPanel";
import MarketRegimeBanner from "@/components/MarketRegimeBanner";
import SectorRotationWheel from "@/components/SectorRotationWheel";
import ThemeSignalWidget from "@/components/ThemeSignalWidget";
import ScreenerSnapshotBanner from "@/components/ScreenerSnapshotBanner";
import ApproachingSignalsPanel from "@/components/ApproachingSignalsPanel";
import TodaysPriorityPanel from "@/components/TodaysPriorityPanel";
import DailySignalDiff from "@/components/DailySignalDiff";
import { derivePriorityActions } from "@/lib/prioritySynthesizer";
import SignalStreakPanel from "@/components/SignalStreakPanel";
import ScoreComponentHeatmap from "@/components/ScoreComponentHeatmap";
import ScoreTimelineGrid from "@/components/ScoreTimelineGrid";
import MomentumVelocityRadar from "@/components/MomentumVelocityRadar";
import ThemeRotationHeatmap from "@/components/ThemeRotationHeatmap";
import ThemePhasePipeline from "@/components/ThemePhasePipeline";
import ThemeLeaderboard from "@/components/ThemeLeaderboard";
import ThemeAlertActivityStrip from "@/components/ThemeAlertActivityStrip";
import ThemeHealthGauge from "@/components/ThemeHealthGauge";
import ThemeSignalQualityPanel from "@/components/ThemeSignalQualityPanel";
import ThemeMomentumForecast from "@/components/ThemeMomentumForecast";
import ThemeMarketSnapshot from "@/components/ThemeMarketSnapshot";


export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ timeframe?: string }>;
}) {
  const { timeframe = "MONTH" } = await searchParams;

  const {
    categories,
    asOfDate,
    macro,
    rotation,
    scoreHistory,
    scoreComponentsByCategory,
    winRateByCategory,
    priceLevelByCategory,
    signalTransitions,
    approachingSignals,
    portfolioActions,
    themes,
    themeSnapshot: snapshot,
    historiesByThemeId,
    topSubSectorByParent,
    allSubSectorsByParent,
    categoriesError,
    macroError,
  } = await loadDashboard(timeframe);

  const priorityActions = derivePriorityActions(
    categories,
    approachingSignals,
    signalTransitions,
    winRateByCategory,
    priceLevelByCategory,
    portfolioActions,
  );


  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {categoriesError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load categories: {categoriesError}
          </div>
        )}

        {priorityActions.length > 0 && (
          <TodaysPriorityPanel actions={priorityActions} scoreHistory={scoreHistory} />
        )}

        <DailySignalDiff transitions={signalTransitions} />

        {categories.length > 0 && <StaleDataBanner categories={categories} />}

        <ScreenerSnapshotBanner />

        {categories.length > 0 && <MarketPulseStrip categories={categories} />}

        {categories.length > 0 && <MarketRegimeBanner categories={categories} />}

        {snapshot !== null && <ThemeMarketSnapshot snapshot={snapshot} />}

        {categories.length > 0 && <ActionSummaryPanel categories={categories} winRateByCategory={winRateByCategory} priceLevelByCategory={priceLevelByCategory} scoreHistory={scoreHistory} />}

        {approachingSignals.length > 0 && <ApproachingSignalsPanel signals={approachingSignals} />}

        {themes.length > 0 && <ThemeHealthGauge themes={themes} />}

        {themes.length > 0 && <ThemeSignalQualityPanel themes={themes} />}

        {themes.length > 0 && <ThemeMomentumForecast themes={themes} />}

        {themes.length > 0 && (
          <ThemeSignalWidget themes={themes} historiesByThemeId={historiesByThemeId} />
        )}

        {themes.length > 0 && Object.keys(historiesByThemeId).length > 0 && (
          <ThemeRotationHeatmap themes={themes} historiesByThemeId={historiesByThemeId} />
        )}

        {themes.length > 0 && <ThemePhasePipeline themes={themes} />}

        {themes.length > 0 && <ThemeLeaderboard themes={themes} />}

        {themes.length > 0 && <ThemeAlertActivityStrip themes={themes} />}

        {categories.length > 0 && (
          <DailyPlaybookPanel
            categories={categories}
            winRateByCategory={winRateByCategory}
            priceLevelByCategory={priceLevelByCategory}
            scoreHistory={scoreHistory}
            subSectorsByParent={allSubSectorsByParent}
          />
        )}

        {categories.length > 0 && <PortfolioGapAlert categories={categories} />}

        {categories.length > 0 && <ScoreMoversPanel categories={categories} />}

        {categories.length > 0 && <MomentumVelocityRadar categories={categories} />}

        {categories.length > 0 && <SignalStreakPanel categories={categories} />}

        {categories.length > 0 && Object.keys(scoreHistory).length > 0 && (
          <ScoreTimelineGrid categories={categories} scoreHistory={scoreHistory} />
        )}

        {categories.length > 0 && Object.keys(scoreComponentsByCategory).length > 0 && (
          <ScoreComponentHeatmap categories={categories} scoreComponents={scoreComponentsByCategory} />
        )}

        <SignalTransitionsPanel transitions={signalTransitions} days={7} />

        <ActiveAlertsStrip />

        {categories.length > 0 && <AllocationBar categories={categories} />}

        {categories.length > 0 && (
          <MarketNarrativePanel categories={categories} macro={macro} topSubSectors={topSubSectorByParent} />
        )}

        {categories.length > 0 && <SignalReadinessPanel categories={categories} />}

        {categories.length > 0 && <ScoreDistributionPanel categories={categories} />}

        {categories.length > 0 && Object.keys(scoreHistory).length > 0 && (
          <ScoreTrajectorySummary categories={categories} scoreHistory={scoreHistory} />
        )}

        {categories.length > 0 && <MarketBreadthBar categories={categories} />}

        {categories.length > 0 && <RotationPhaseIndicator categories={categories} />}

        {categories.length > 0 && <SectorRotationWheel categories={categories} />}

        {categories.length > 0 && <MomentumLeadersPanel categories={categories} />}

        {categories.length > 0 && Object.keys(scoreHistory).length > 0 && (
          <ScoreExtremesPanel categories={categories} scoreHistory={scoreHistory} />
        )}

        {categories.length > 0 && <SignalDivergencePanel categories={categories} />}

        {macro && <MacroPanel macro={macro} />}

        {macroError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load macro data: {macroError}
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
            <CategoryTable categories={categories} timeframe={timeframe} scoreHistory={scoreHistory} topSubSectors={topSubSectorByParent} allSubSectorsByParent={allSubSectorsByParent} priceLevels={priceLevelByCategory} winRates={winRateByCategory} scoreComponents={scoreComponentsByCategory} />
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
