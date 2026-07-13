import { SubSectorSummary, fetchCategoryScoreHistory, fetchSubSectors } from "@/lib/api";
import { deriveFactorRegime } from "@/lib/factors/factorRegime";
import {
  FACTOR_COLORS,
  FactorCard,
  FactorComparisonStrip,
  FactorScoreHistoryChart,
} from "@/components/factors/panels";
import { FactorHistoricalContext } from "@/components/factors/FactorHistoricalContext";

const SCORE_HISTORY_DAYS = 60;

/** The factor ETFs are modelled as sub-sectors of a synthetic "FTRS" parent. */
const FACTOR_PARENT_ID = "FTRS";

type FactorData = {
  factors: SubSectorSummary[];
  scoreHistory: Record<string, number[]>;
  error: string | null;
};

const loadFactors = async (): Promise<FactorData> => {
  const [factorsResult, historyResult] = await Promise.allSettled([
    fetchSubSectors(FACTOR_PARENT_ID),
    fetchCategoryScoreHistory(SCORE_HISTORY_DAYS),
  ]);

  return {
    factors: factorsResult.status === "fulfilled" ? factorsResult.value : [],
    scoreHistory: historyResult.status === "fulfilled" ? historyResult.value : {},
    error:
      factorsResult.status === "rejected"
        ? factorsResult.reason instanceof Error
          ? factorsResult.reason.message
          : "Failed to load factor data"
        : null,
  };
};

export default async function FactorFlowsPage() {
  const { factors, scoreHistory, error } = await loadFactors();

  const regime = factors.length > 0 ? deriveFactorRegime(factors) : null;
  const hasPercentiles = factors.some(factor => factor.scorePercentile252d != null);
  const hasHistory = Object.keys(scoreHistory).some(id => FACTOR_COLORS[id]);

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Factor Flows
          </h1>
          <span
            className="text-[11px] text-slate-500"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            4 factor ETFs · MTUM · QUAL · USMV · VLUE
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Smart-money rotation across factor ETFs vs SPY. MTUM leading = risk-on; USMV leading =
          risk-off.
        </p>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {factors.length === 0 && !error && (
          <div className="text-slate-500 text-sm">
            No factor data yet. Trigger ingestion to compute signals for MTUM, QUAL, USMV, VLUE.
          </div>
        )}

        {regime && (
          <div
            className={`mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg border ${regime.bgClass} ${regime.borderClass}`}
          >
            <span className={`text-sm font-bold ${regime.colorClass}`}>{regime.label}</span>
            <span className="text-slate-700">·</span>
            <span className="text-xs text-slate-400">{regime.description}</span>
          </div>
        )}

        {hasPercentiles && <FactorHistoricalContext factors={factors} />}
        {hasHistory && <FactorScoreHistoryChart scoreHistory={scoreHistory} />}

        <FactorComparisonStrip factors={factors} />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {factors.map(factor => (
            <FactorCard key={factor.id} factor={factor} />
          ))}
        </div>

        {factors.length > 0 && (
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Factor rotation signals
            </h3>
            <p className="text-xs text-slate-500">
              RS &gt; 1.0 means the factor is outperforming SPY. When Momentum (MTUM) leads and Low
              Volatility (USMV) lags, the market is in a risk-on environment. The reverse suggests
              risk aversion. Quality (QUAL) leading Value (VLUE) often signals late-cycle dynamics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
