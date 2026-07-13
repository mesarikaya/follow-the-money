import {
  CategorySummary,
  SeasonalReturn,
  fetchCategories,
  fetchCategoryScoreHistory,
  fetchRotation,
  fetchSeasonalReturns,
} from "@/lib/api";
import { rankByFlow, rankByRelativeStrength, rsWindowDays } from "@/lib/flows/flowMetrics";
import RSFlowScatterPanel from "@/components/RSFlowScatterPanel";
import { RsScoreScatter, ScoreHistoryHeatmap, ScoreHistoryMap, SeasonalHeatmap } from "@/components/flows/charts";
import {
  FlowZScorePanel,
  RelativeStrengthPanel,
  RiskAdjustedRankingPanel,
  RotationEventsPanel,
  RotationLeadersPanel,
  SeasonalTailwindsPanel,
} from "@/components/flows/panels";

export const dynamic = "force-dynamic";

const SCORE_HISTORY_DAYS = 30;

const FlowsHeader = ({ asOfDate, rsWindow }: { asOfDate: string; rsWindow: number }) => (
  <header className="px-6 py-4 border-b border-slate-700 shrink-0">
    <div className="flex items-baseline justify-between">
      <h1
        className="text-slate-100 font-bold"
        style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
      >
        Capital Flows
      </h1>
      <span className="text-[11px] text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {asOfDate}
      </span>
    </div>
    <p className="text-xs text-slate-500 mt-1 max-w-xl">
      {rsWindow}-day relative strength vs SPY — a proxy for capital rotation. Positive = money flowing
      into a sector relative to the broad market. Leaders and laggards derived from composite
      rotation signals.
    </p>
  </header>
);

const FlowDataNote = () => (
  <div className="mt-2 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg text-xs text-slate-500">
    <span className="font-semibold text-slate-400">Note on flow data:</span>{" "}
    AUM-weighted dollar flows (million USD) require real-time ETF.com or VettaFi data, which is
    not yet integrated. RS-60 relative strength is a reliable price-based proxy for institutional
    capital rotation — rising RS means a sector is attracting more buying pressure than SPY.
  </div>
);

type Props = {
  searchParams: Promise<{ timeframe?: string }>;
};

export default async function CapitalFlowsPage({ searchParams }: Props) {
  const { timeframe = "MONTH" } = await searchParams;
  const [rotation, categoriesResponse, scoreHistoryResponse, seasonalResponse] = await Promise.all([
    fetchRotation().catch(() => null),
    fetchCategories(timeframe).catch(() => null),
    fetchCategoryScoreHistory(SCORE_HISTORY_DAYS).catch(() => null),
    fetchSeasonalReturns().catch(() => null),
  ]);

  const categories: CategorySummary[] = categoriesResponse?.categories ?? [];
  const scoreHistory: ScoreHistoryMap = scoreHistoryResponse ?? {};
  const seasonalReturns: SeasonalReturn[] = seasonalResponse ?? [];

  const rankedByRelativeStrength = rankByRelativeStrength(categories);
  const rankedByFlow = rankByFlow(categories);
  const hasData = rankedByRelativeStrength.length > 0 || (rotation?.topLeaders.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full">
      <FlowsHeader
        asOfDate={rotation?.asOfDate ?? categoriesResponse?.asOfDate ?? "—"}
        rsWindow={rsWindowDays(timeframe)}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {!hasData && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No data yet — trigger ingestion to populate signals.</p>
          </div>
        )}

        {rotation && (
          <RotationLeadersPanel topLeaders={rotation.topLeaders} bottomLaggards={rotation.bottomLaggards} />
        )}

        {categories.some(c => c.rs60 != null && c.flow20d != null) && (
          <RSFlowScatterPanel categories={categories} />
        )}

        {categories.length >= 3 && <RsScoreScatter categories={categories} />}

        {Object.keys(scoreHistory).length > 0 && (
          <ScoreHistoryHeatmap categories={categories} scoreHistory={scoreHistory} />
        )}

        <RiskAdjustedRankingPanel categories={rankedByRelativeStrength} />
        <SeasonalTailwindsPanel seasonalReturns={seasonalReturns} categories={categories} />
        <SeasonalHeatmap seasonalReturns={seasonalReturns} categories={categories} />

        <RelativeStrengthPanel categories={rankedByRelativeStrength} rsWindow={rsWindowDays(timeframe)} />
        <FlowZScorePanel categories={rankedByFlow} />
        <RotationEventsPanel events={rotation?.recentEvents ?? []} />

        <FlowDataNote />
      </main>
    </div>
  );
}
