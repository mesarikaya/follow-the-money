import { AlertDto, CategorySummary, fetchAlerts, fetchCategories, fetchCategoryScoreHistory, fetchSubSectors } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { SubSectorBreakdown, buildSubSectorBreakdown, summarizeSectors } from "@/lib/sectors/sectorMetrics";
import { SectorCard } from "@/components/sectors/SectorCard";
import { RrgScatterChart, SignalConfluenceMatrix } from "@/components/sectors/charts";
import { SectorRotationStrip, SubSectorLeader, SubSectorLeaderboard } from "@/components/sectors/panels";

const SCORE_HISTORY_DAYS = 30;

type SectorsHubData = {
  sectors: CategorySummary[];
  scoreHistory: Record<string, number[]>;
  subSectorCounts: Record<string, number>;
  subSectorBreakdowns: Record<string, SubSectorBreakdown>;
  alertsBySectorId: Record<string, AlertDto[]>;
  allSubSectors: SubSectorLeader[];
  error: string | null;
};

const groupActiveAlertsBySector = (alerts: AlertDto[]): Record<string, AlertDto[]> => {
  const grouped: Record<string, AlertDto[]> = {};
  for (const alert of alerts) {
    if (alert.status !== "ACTIVE" || alert.categoryId == null) continue;
    (grouped[alert.categoryId] ??= []).push(alert);
  }
  return grouped;
};

/**
 * Loads everything the hub shows. Each sector's sub-sectors are fetched separately, so a single
 * failing sector must not take the page down — hence `allSettled` throughout.
 */
const loadSectorsHub = async (): Promise<SectorsHubData> => {
  const sectorIds = Array.from(SECTOR_DRILLDOWN_IDS);
  const empty = {
    scoreHistory: {},
    subSectorCounts: {},
    subSectorBreakdowns: {},
    alertsBySectorId: {},
    allSubSectors: [],
  };

  const [categoriesResult, historyResult, alertsResult, ...subSectorResults] = await Promise.allSettled([
    fetchCategories("MONTH"),
    fetchCategoryScoreHistory(SCORE_HISTORY_DAYS),
    fetchAlerts(),
    ...sectorIds.map(id => fetchSubSectors(id)),
  ]);

  if (categoriesResult.status === "rejected") {
    const reason = categoriesResult.reason;
    return {
      ...empty,
      sectors: [],
      error: reason instanceof Error ? reason.message : "Failed to load sectors",
    };
  }

  const subSectorCounts: Record<string, number> = {};
  const subSectorBreakdowns: Record<string, SubSectorBreakdown> = {};
  const allSubSectors: SubSectorLeader[] = [];

  subSectorResults.forEach((result, index) => {
    const sectorId = sectorIds[index];
    const subSectors = result.status === "fulfilled" ? result.value : [];
    subSectorCounts[sectorId] = subSectors.length;
    subSectorBreakdowns[sectorId] = buildSubSectorBreakdown(subSectors);
    allSubSectors.push(...subSectors.map(subSector => ({ ...subSector, parentId: sectorId })));
  });

  return {
    sectors: categoriesResult.value.categories.filter(c => SECTOR_DRILLDOWN_IDS.has(c.id)),
    scoreHistory: historyResult.status === "fulfilled" ? historyResult.value : {},
    alertsBySectorId:
      alertsResult.status === "fulfilled" ? groupActiveAlertsBySector(alertsResult.value.alerts ?? []) : {},
    subSectorCounts,
    subSectorBreakdowns,
    allSubSectors,
    error: null,
  };
};

const SignalMethodologyNote = () => (
  <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg text-xs text-slate-500">
    <span className="font-semibold text-slate-400">Signal methodology:</span>{" "}
    Rotation quadrant (Leading / Improving / Weakening / Lagging) is derived from the Relative Rotation Graph
    using 60-day RS ratio and momentum vs SPY. Within each sector, sub-sector signals measure rotation
    relative to the parent sector ETF — not SPY.
  </div>
);

export default async function SectorsHubPage() {
  const {
    sectors,
    scoreHistory,
    subSectorCounts,
    subSectorBreakdowns,
    alertsBySectorId,
    allSubSectors,
    error,
  } = await loadSectorsHub();

  const summary = summarizeSectors(sectors);
  const subSectorTotal = Object.values(subSectorCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Sub-Sector Rotation
          </h1>
          <span className="text-[11px] text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            11 GICS sectors · {subSectorTotal} sub-sector ETFs
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-xl">
          Each sub-sector is benchmarked against its parent sector ETF — not the S&amp;P 500.
          A positive RS score means capital is rotating into that sub-sector <em>within</em> its sector.
        </p>
        <SectorRotationStrip summary={summary} sectorCount={sectors.length} />
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors.map(sector => (
            <SectorCard
              key={sector.id}
              sector={sector}
              history={scoreHistory[sector.id] ?? []}
              subSectorCount={subSectorCounts[sector.id] ?? 0}
              sectorAlerts={alertsBySectorId[sector.id] ?? []}
              subSectorBreakdown={subSectorBreakdowns[sector.id] ?? buildSubSectorBreakdown([])}
            />
          ))}
        </div>

        {sectors.length === 0 && !error && (
          <p className="text-slate-500 text-sm">No sector data available. Trigger ingestion first.</p>
        )}

        <RrgScatterChart sectors={sectors} />
        <SignalConfluenceMatrix sectors={sectors} />
        <SubSectorLeaderboard leaders={allSubSectors} />

        <SignalMethodologyNote />
      </main>
    </div>
  );
}
