import Link from "next/link";
import {
  SignalHistoryEntry,
  SubSectorSummary,
  ThemeSummary,
  fetchCategoryScoreHistory,
  fetchSignalHistory,
  fetchSubSectors,
  fetchThemes,
} from "@/lib/api";
import {
  SECTOR_META,
  breakDownSubSectors,
  buildConfluenceNarrative,
} from "@/lib/sectors/sectorDrilldown";
import {
  SectorScoreSparkline,
  SignalComponentChart,
  ThemeOverlapPanel,
} from "@/components/sectors/drilldownPanels";
import SubSectorTable from "@/components/SubSectorTable";
import RefreshButton from "@/components/RefreshButton";

const SCORE_HISTORY_DAYS = 60;

const QUADRANT_SUMMARY: Record<string, { label: string; colorClass: string }> = {
  "4": { label: "↗ Leading",   colorClass: "text-green-400"  },
  "3": { label: "↖ Improving", colorClass: "text-cyan-400"   },
  "2": { label: "↘ Weakening", colorClass: "text-orange-400" },
  "1": { label: "↙ Lagging",   colorClass: "text-slate-400"  },
};

const SIGNAL_CHIPS = [
  { key: "BUY",    cls: "bg-green-900/40 text-green-300 border-green-700/50"  },
  { key: "WATCH",  cls: "bg-cyan-900/30 text-cyan-300 border-cyan-700/40"     },
  { key: "HOLD",   cls: "bg-slate-700/40 text-slate-400 border-slate-600/50"  },
  { key: "REDUCE", cls: "bg-red-900/30 text-red-400 border-red-700/40"        },
] as const;

const CONFLUENCE_STYLES = {
  strong:   { banner: "bg-green-900/20 border-green-700/40 text-green-300", title: "Strong Confluence:" },
  moderate: { banner: "bg-cyan-900/20 border-cyan-700/40 text-cyan-300",    title: "Moderate Confluence:" },
  mixed:    { banner: "bg-amber-900/15 border-amber-700/40 text-amber-300", title: "Mixed Rotation:" },
  weak:     { banner: "bg-red-900/15 border-red-700/40 text-red-300",       title: "Broad Weakness:" },
} as const;

type SectorDrilldownData = {
  subSectors: SubSectorSummary[];
  themes: ThemeSummary[];
  scoreHistory: number[];
  signalHistory: SignalHistoryEntry[];
  error: string | null;
};

/** Everything the drilldown shows. Only the sub-sectors are essential — the rest degrade quietly. */
const loadSector = async (sectorId: string): Promise<SectorDrilldownData> => {
  const [subSectorsResult, scoreHistoryResult, signalHistoryResult, themesResult] =
    await Promise.allSettled([
      fetchSubSectors(sectorId),
      fetchCategoryScoreHistory(SCORE_HISTORY_DAYS),
      fetchSignalHistory(sectorId),
      fetchThemes(),
    ]);

  return {
    subSectors: subSectorsResult.status === "fulfilled" ? subSectorsResult.value : [],
    themes: themesResult.status === "fulfilled" ? themesResult.value : [],
    scoreHistory:
      scoreHistoryResult.status === "fulfilled" ? scoreHistoryResult.value[sectorId] ?? [] : [],
    signalHistory: signalHistoryResult.status === "fulfilled" ? signalHistoryResult.value : [],
    error:
      subSectorsResult.status === "rejected"
        ? subSectorsResult.reason instanceof Error
          ? subSectorsResult.reason.message
          : "Failed to load sub-sectors"
        : null,
  };
};

export default async function SectorDrilldownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sectorId = id.toUpperCase();
  const meta = SECTOR_META[sectorId];
  const sectorName = meta?.name ?? sectorId;
  const parentTicker = meta?.etfTicker ?? sectorId;

  const { subSectors, themes, scoreHistory, signalHistory, error } = await loadSector(sectorId);

  const breakdown = breakDownSubSectors(subSectors);
  const narrative = buildConfluenceNarrative(breakdown, sectorName);
  const confluence = narrative ? CONFLUENCE_STYLES[narrative.strength] : null;

  // The parent sector plus every sub-sector — used to find the themes that touch this sector.
  const sectorCategoryIds = new Set<string>([sectorId, ...subSectors.map(s => s.id)]);
  const isAwaitingSignals =
    subSectors.length > 0 && subSectors.every(s => s.rs60 == null && s.compositeScore == null);

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 border-b border-slate-700">
        <div className="px-6 pt-4 pb-2">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/sectors" className="hover:text-cyan-400 transition-colors">
              Sub-Sectors
            </Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-300">{sectorName}</span>
          </nav>
        </div>

        <div className="mx-6 mb-4 p-4 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-900/40 border border-slate-700/60 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-slate-100 font-bold leading-tight"
                style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
              >
                {sectorName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Relative strength vs{" "}
                <span className="text-cyan-400" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  {parentTicker}
                </span>{" "}
                — within-sector rotation signals
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {meta && (
                <span
                  className="text-sm text-cyan-400 bg-cyan-500/8 border border-cyan-500/20 px-3 py-1.5 rounded-lg"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {meta.etfTicker}
                </span>
              )}
              {scoreHistory.length > 5 && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-600">60d score</span>
                  <SectorScoreSparkline scores={scoreHistory} />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        {subSectors.length === 0 && !error && (
          <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg space-y-3">
            <p className="text-sm text-slate-400 font-medium">
              No sub-sector data yet for {sectorName}.
            </p>
            <p className="text-xs text-slate-500">
              These {parentTicker} sub-sector ETFs were seeded in the database but have not been ingested yet.
              Click <strong>Refresh Data</strong> to fetch 5 years of price history for all sub-sectors.
              First ingestion takes 8–15 minutes; subsequent daily runs add ~30 seconds.
            </p>
            <RefreshButton />
          </div>
        )}

        {isAwaitingSignals && (
          <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-700/40 text-amber-300 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 shrink-0 mt-0.5">⚠</span>
              <div>
                <span className="font-semibold">Signals pending for {sectorName} sub-sectors.</span>{" "}
                Price history has not been ingested for these ETFs yet. Click Refresh Data to start.
                First ingestion takes 8–15 minutes for new tickers.
              </div>
            </div>
            <div className="pl-5">
              <RefreshButton />
            </div>
          </div>
        )}

        {subSectors.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-3">
              {(["4", "3", "2", "1"] as const).map(quadrant => {
                const config = QUADRANT_SUMMARY[quadrant];
                const members = breakdown.byQuadrant[quadrant];
                return (
                  <div key={quadrant} className="rounded-lg px-4 py-3 bg-slate-800/60 border border-slate-700/60">
                    <div
                      className={`text-[10px] uppercase mb-1 ${config.colorClass}`}
                      style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}
                    >
                      {config.label}
                    </div>
                    <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                      {members.length}
                    </div>
                    <div
                      className="text-[11px] text-slate-500 truncate mt-0.5"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      {members.map(s => s.etfTicker).join(" · ") || "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {subSectors.some(s => s.compositeScore != null) && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">
                  Trade Signal
                </span>
                {SIGNAL_CHIPS.map(({ key, cls }) => {
                  const members = breakdown.bySignal[key] ?? [];
                  const tickers = members.map(s => s.etfTicker).join(", ");
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cls}`}
                      title={tickers || undefined}
                    >
                      <span
                        className="text-[10px] font-bold"
                        style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.06em" }}
                      >
                        {key}
                      </span>
                      <span className="text-sm font-bold" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                        {members.length}
                      </span>
                      {tickers && <span className="text-[9px] opacity-60 hidden xl:inline">{tickers}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {narrative && confluence && (
              <div className={`px-4 py-3 rounded-lg border text-sm leading-relaxed ${confluence.banner}`}>
                <span
                  className="font-semibold mr-1"
                  style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
                >
                  {confluence.title}
                </span>
                {narrative.text}
              </div>
            )}

            {signalHistory.length > 0 && <SignalComponentChart entries={signalHistory} />}

            {themes.length > 0 && (
              <ThemeOverlapPanel themes={themes} sectorCategoryIds={sectorCategoryIds} />
            )}

            <SubSectorTable
              subSectors={subSectors}
              parentEtfTicker={parentTicker}
              parentName={sectorName}
            />

            <div className="text-xs text-slate-500 p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg">
              <span className="font-semibold text-slate-400">Interpreting signals:</span>{" "}
              RS values compare each sub-sector ETF against {parentTicker} (the parent sector).
              Positive = outperforming the sector. Leading (↗) and Improving (↖) indicate bullish rotation
              within {sectorName}. All signals are computed on daily closing prices.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
