import { CategorySummary, RotationEventEntry, RotationLeaderEntry, SeasonalReturn } from "@/lib/api";
import {
  SeasonalEntry,
  maxAbsFlowZScore,
  maxAbsRelativeStrengthPercent,
  maxAbsSharpeProxy,
  rankByRiskAdjustedStrength,
  selectSeasonalWinds,
} from "@/lib/flows/flowMetrics";
import { MONTH_LABELS } from "@/components/flows/charts";
import { EventRow, FlowSignalRow, LeaderRow, RsBarRow } from "@/components/flows/rows";

/** The stacked panels of the capital-flows page. Presentational — data arrives via props. */

const MONO = { fontFamily: "var(--font-jetbrains-mono)" };
const SECTION_HEADING = { fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" };

const SectionHeading = ({ className = "text-slate-300", children }: { className?: string; children: React.ReactNode }) => (
  <h2 className={`${className} text-[10px] font-semibold uppercase tracking-widest`} style={SECTION_HEADING}>
    {children}
  </h2>
);

const Panel = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 ${className}`}>{children}</div>
);

export const RotationLeadersPanel = ({
  topLeaders,
  bottomLaggards,
}: {
  topLeaders: RotationLeaderEntry[];
  bottomLaggards: RotationLeaderEntry[];
}) => {
  if (topLeaders.length === 0 && bottomLaggards.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900/40 border border-emerald-700/25 rounded-xl p-4">
        <div className="mb-3">
          <SectionHeading className="text-emerald-400">↑ Top Leaders</SectionHeading>
        </div>
        {topLeaders.map(entry => (
          <LeaderRow key={entry.categoryId} entry={entry} isLeader={true} />
        ))}
      </div>
      <div className="bg-gradient-to-br from-red-900/20 to-slate-900/40 border border-red-700/25 rounded-xl p-4">
        <div className="mb-3">
          <SectionHeading className="text-red-400">↓ Bottom Laggards</SectionHeading>
        </div>
        {bottomLaggards.map(entry => (
          <LeaderRow key={entry.categoryId} entry={entry} isLeader={false} />
        ))}
      </div>
    </div>
  );
};

export const RelativeStrengthPanel = ({
  categories,
  rsWindow,
}: {
  categories: CategorySummary[];
  rsWindow: number;
}) => {
  if (categories.length === 0) return null;
  const maxAbs = maxAbsRelativeStrengthPercent(categories);
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <SectionHeading>All categories — RS {rsWindow}d vs SPY</SectionHeading>
        <span className="text-[10px] text-slate-500" style={MONO}>
          bars scaled to ±{maxAbs.toFixed(1)}%
        </span>
      </div>
      {categories.map(category => (
        <RsBarRow key={category.id} category={category} maxAbs={maxAbs} />
      ))}
    </Panel>
  );
};

export const FlowZScorePanel = ({ categories }: { categories: CategorySummary[] }) => {
  if (categories.length === 0) return null;
  const maxAbsZ = maxAbsFlowZScore(categories);
  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <SectionHeading>Flow Z-Score (20d)</SectionHeading>
        <span className="text-[10px] text-slate-500" style={MONO}>
          Z-score · Persistence (n/20 positive days)
        </span>
      </div>
      <div className="flex items-center gap-3 px-0 mb-1">
        <span className="w-10 shrink-0" />
        <span className="flex-1 text-[9px] text-slate-600 text-center">flow z-score (σ from 0 = mean)</span>
        <span className="w-16 text-right text-[9px] text-slate-600 shrink-0">positive days</span>
      </div>
      {categories.map(category => (
        <FlowSignalRow key={category.id} category={category} maxAbsZ={maxAbsZ} />
      ))}
      <div className="mt-3 text-[10px] text-slate-600">
        Z-score: σ &gt; +1 = unusual inflow · σ &lt; −1 = unusual outflow · Persistence ≥14/20 = sustained buying
      </div>
    </Panel>
  );
};

export const RotationEventsPanel = ({ events }: { events: RotationEventEntry[] }) => {
  if (events.length === 0) return null;
  return (
    <Panel>
      <div className="mb-3">
        <SectionHeading>Recent Rotation Events</SectionHeading>
      </div>
      {events.map((event, index) => (
        <EventRow key={index} event={event} />
      ))}
    </Panel>
  );
};

export const RiskAdjustedRankingPanel = ({ categories }: { categories: CategorySummary[] }) => {
  const ranked = rankByRiskAdjustedStrength(categories);
  if (ranked.length === 0) return null;
  const maxAbs = maxAbsSharpeProxy(ranked);

  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <SectionHeading>Risk-Adjusted Strength (RS-60 ÷ Vol)</SectionHeading>
        <span className="text-[10px] text-slate-500" style={MONO}>
          Sharpe proxy · default vol 20% if unavailable
        </span>
      </div>
      {ranked.map((category, index) => {
        const isPositive = category.sharpeProxy >= 0;
        const barWidth = Math.min(Math.abs(category.sharpeProxy) / maxAbs, 1) * 100;
        const rankColor = index === 0 ? "text-green-400" : index === ranked.length - 1 ? "text-red-400" : "text-slate-500";
        const volatilityPercent = category.volatility * 100;
        return (
          <div key={category.id} className="flex items-center gap-3 py-1.5 border-b border-slate-700/20 last:border-0">
            <span className={`text-[10px] font-bold tabular-nums w-4 shrink-0 ${rankColor}`} style={MONO}>
              #{index + 1}
            </span>
            <span className="text-xs text-slate-300 w-44 truncate shrink-0">{category.name}</span>
            <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={MONO}>{category.etfTicker}</span>
            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isPositive ? "bg-violet-500" : "bg-rose-700"}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span
              className={`text-xs tabular-nums w-14 text-right shrink-0 ${isPositive ? "text-violet-400" : "text-rose-400"}`}
              style={MONO}
            >
              {isPositive ? "+" : ""}{category.sharpeProxy.toFixed(2)}
            </span>
            <span
              className={`text-[9px] tabular-nums w-12 text-right shrink-0 ${category.isVolatilityKnown ? "text-slate-500" : "text-slate-700"}`}
              title={category.isVolatilityKnown ? `Realized 20d vol: ${volatilityPercent.toFixed(1)}%` : "Vol unavailable — default 20% used"}
              style={MONO}
            >
              {category.isVolatilityKnown ? `σ${volatilityPercent.toFixed(0)}%` : "~σ20%"}
            </span>
          </div>
        );
      })}
      <div className="mt-3 text-[10px] text-slate-600">
        Formula: RS-60 ÷ Realized Vol (20d annualized). Positive = outperforming per unit of risk. Higher = better risk-adjusted rotation signal.
      </div>
    </Panel>
  );
};

const SeasonalRow = ({ entry, isTailwind }: { entry: SeasonalEntry; isTailwind: boolean }) => {
  const { category, seasonal } = entry;
  const signal = category.tradeSignal;
  const isSignalAligned = isTailwind ? signal === "BUY" || signal === "WATCH" : signal === "REDUCE";
  return (
    <div className="flex items-center gap-2 py-1 border-b border-slate-700/20 last:border-0">
      <span className="text-[10px] text-cyan-400 w-10 shrink-0" style={MONO}>
        {category.etfTicker}
      </span>
      <span className="text-[10px] text-slate-400 flex-1 truncate">{category.name}</span>
      <span className={`text-[10px] tabular-nums shrink-0 font-mono ${isTailwind ? "text-emerald-400" : "text-red-400"}`}>
        {isTailwind ? "+" : ""}{(seasonal.avgReturn * 100).toFixed(1)}%
      </span>
      <span className="text-[9px] text-slate-600 shrink-0">n={seasonal.sampleCount}</span>
      {signal && (
        <span
          className={`text-[9px] shrink-0 font-bold px-1 rounded ${
            isSignalAligned
              ? isTailwind ? "text-emerald-300 bg-emerald-900/30" : "text-red-300 bg-red-900/30"
              : "text-slate-500 bg-slate-800/60"
          }`}
          style={{ fontFamily: "var(--font-rajdhani)" }}
        >
          {signal}
          {isSignalAligned && " ✓"}
        </span>
      )}
    </div>
  );
};

export const SeasonalTailwindsPanel = ({
  seasonalReturns,
  categories,
}: {
  seasonalReturns: SeasonalReturn[];
  categories: CategorySummary[];
}) => {
  if (seasonalReturns.length === 0 || categories.length === 0) return null;

  const currentMonth = new Date().getMonth() + 1;
  const monthLabel = MONTH_LABELS[currentMonth - 1];
  const { tailwinds, headwinds } = selectSeasonalWinds(seasonalReturns, categories, currentMonth);
  if (tailwinds.length === 0 && headwinds.length === 0) return null;

  return (
    <Panel>
      <div className="flex items-baseline justify-between mb-3">
        <SectionHeading>{monthLabel} Seasonal Tailwinds &amp; Headwinds</SectionHeading>
        <span className="text-[9px] text-slate-600">avg monthly return · ✓ = signal aligned</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tailwinds.length > 0 && (
          <div>
            <div className="text-[9px] text-emerald-500 uppercase tracking-wider mb-1.5 font-semibold">
              ↑ Seasonal Tailwinds
            </div>
            {tailwinds.map(entry => (
              <SeasonalRow key={entry.category.id} entry={entry} isTailwind={true} />
            ))}
          </div>
        )}
        {headwinds.length > 0 && (
          <div>
            <div className="text-[9px] text-red-500 uppercase tracking-wider mb-1.5 font-semibold">
              ↓ Seasonal Headwinds
            </div>
            {headwinds.map(entry => (
              <SeasonalRow key={entry.category.id} entry={entry} isTailwind={false} />
            ))}
          </div>
        )}
      </div>
      <div className="text-[9px] text-slate-600 mt-2">
        Historical average for {monthLabel} across all available years (min 2 samples) · ✓ means current signal aligns with seasonal pattern
      </div>
    </Panel>
  );
};
