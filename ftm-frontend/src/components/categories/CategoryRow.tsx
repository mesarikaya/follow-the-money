import Link from "next/link";
import { CategorySummary, PriceLevelDto, ScoreDecompositionDto, SignalWinRateDto, SubSectorSummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { buildScoreTooltip, computeStreak, findScoreExtreme } from "@/lib/categories/categoryTable";
import Sparkline from "@/components/Sparkline";
import ScoreBreakdownBar from "@/components/ScoreBreakdownBar";
import {
  AlertCountBadge,
  MacroFitCell,
  PriceRangeBar,
  RRG_QUADRANT_CONFIG,
  RsCell,
  ScoreBar,
  StreakBadge,
  TYPE_CONFIG,
  TopSubChip,
  TradeSignalBadge,
  WinRateBadge,
} from "@/components/categories/cells";

/** One category row: identity, price, 30-day trend, score, relative strength, regime and signal. */

const VELOCITY_THRESHOLD = 0.12;

const ScoreExtremeBadge = ({ category, history }: { category: CategorySummary; history: number[] }) => {
  const extreme = findScoreExtreme(category, history);
  if (!extreme) return null;
  const { percentile, isHigh, isFromBackend } = extreme;
  const title = isFromBackend
    ? `252-day percentile: current score is at the ${percentile}th percentile of the past 12 months — ${
        isHigh ? "near 12-month highs (late entry risk)" : "near 12-month lows (potential value entry)"
      }`
    : `30-day percentile rank: current score is at the ${percentile}th percentile of the past ${history.length} sessions`;
  const color = isFromBackend
    ? isHigh ? "text-amber-400" : "text-cyan-400"
    : isHigh ? "text-amber-500" : "text-cyan-500";
  return (
    <span className={`text-[7px] tabular-nums ${isFromBackend ? "font-mono " : ""}${color}`} title={title}>
      P{percentile}
    </span>
  );
};

const EtfCell = ({
  category,
  topSubSector,
  allSubSectors,
}: {
  category: CategorySummary;
  topSubSector?: SubSectorSummary;
  allSubSectors?: SubSectorSummary[];
}) => {
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(category.id);
  return (
    <div className="flex items-center flex-wrap gap-x-0.5">
      {hasDrilldown ? (
        <Link
          href={`/sectors/${category.id}`}
          className="hover:text-cyan-300 transition-colors underline decoration-blue-700/50 hover:decoration-cyan-400/70"
        >
          {category.etfTicker}
        </Link>
      ) : (
        category.etfTicker
      )}
      {hasDrilldown && topSubSector && <TopSubChip subSector={topSubSector} allSubSectors={allSubSectors} />}
    </div>
  );
};

export const CategoryRow = ({
  category,
  displayRank,
  rsLabel,
  rsRankPercentile,
  history,
  showHistory,
  topSubSector,
  allSubSectors,
  priceLevel,
  winRate,
  scoreComponents,
}: {
  category: CategorySummary;
  displayRank: number;
  rsLabel: string;
  rsRankPercentile: number | null;
  history: number[];
  showHistory: boolean;
  topSubSector?: SubSectorSummary;
  allSubSectors?: SubSectorSummary[];
  priceLevel?: PriceLevelDto;
  winRate?: SignalWinRateDto;
  scoreComponents?: ScoreDecompositionDto;
}) => {
  const typeConfig = TYPE_CONFIG[category.type] ?? TYPE_CONFIG.ALTERNATIVE;
  const quadrant = category.rrgQuadrant != null ? RRG_QUADRANT_CONFIG[Number(category.rrgQuadrant)] : null;
  const trend5d = category.compositeTrend5d ?? 0;
  const velocityRowClass =
    trend5d >= VELOCITY_THRESHOLD ? "bg-emerald-950/[0.08]"
    : trend5d <= -VELOCITY_THRESHOLD ? "bg-red-950/[0.08]"
    : "";

  return (
    <tr
      className={`hover:bg-slate-800/50 transition-colors text-slate-200 border-l-[3px] ${quadrant?.borderClass ?? "border-l-slate-700/20"} ${velocityRowClass}`}
    >
      <td className="px-4 py-2.5 text-slate-500 tabular-nums text-xs">{displayRank}</td>

      <td className="px-4 py-2.5 font-mono text-blue-300 font-medium">
        <EtfCell category={category} topSubSector={topSubSector} allSubSectors={allSubSectors} />
      </td>

      <td className="px-4 py-2.5 font-medium">
        <span className="inline-flex items-center gap-1.5">
          {SECTOR_DRILLDOWN_IDS.has(category.id) ? (
            <Link href={`/sectors/${category.id}`} className="hover:text-cyan-300 transition-colors">
              {category.name}
            </Link>
          ) : (
            category.name
          )}
          <AlertCountBadge activeAlertCount={category.activeAlertCount ?? 0} />
        </span>
      </td>

      <td className="px-4 py-2.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
      </td>

      <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
        {category.latestClose != null ? `$${Number(category.latestClose).toFixed(2)}` : "—"}
        <PriceRangeBar priceLevel={priceLevel} />
      </td>

      {showHistory && (
        <td className="px-3 py-2.5">
          <div className="flex flex-col items-center gap-0.5">
            <Sparkline values={history} />
            <StreakBadge streak={category.scoreStreakDays ?? computeStreak(history)} />
            <ScoreExtremeBadge category={category} history={history} />
          </div>
        </td>
      )}

      <td className="px-4 py-2.5" title={buildScoreTooltip(category, category.macroFit ?? null)}>
        <div className="flex flex-col items-center gap-1">
          <ScoreBar category={category} />
          {scoreComponents && (
            <div className="w-full max-w-[72px]">
              <ScoreBreakdownBar decomposition={scoreComponents} />
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-2.5 text-right">
        <RsCell
          value={category.rs60}
          rs120={category.rs120}
          rs20={category.rs20}
          period={rsLabel.replace("d", "")}
          rankPct={rsRankPercentile}
        />
      </td>

      <td className="px-4 py-2.5 text-center">
        <MacroFitCell macroFit={category.macroFit ?? null} />
      </td>

      <td className="px-4 py-2.5 text-center">
        <div className="flex flex-col items-center gap-1">
          {quadrant ? (
            <span className={`text-xs ${quadrant.color}`}>{quadrant.label}</span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
          <TradeSignalBadge category={category} />
          <WinRateBadge winRate={winRate} />
        </div>
      </td>
    </tr>
  );
};
