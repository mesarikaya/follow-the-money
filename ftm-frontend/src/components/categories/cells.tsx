import { CategorySummary, PriceLevelDto, SignalWinRateDto, SubSectorSummary } from "@/lib/api";
import { SortDir } from "@/lib/categories/categoryTable";
import { TradeSignal, computeBreadthVelocity, deriveTradeSignal } from "@/lib/signals";

/** The cell-level pieces of the category table. Presentational — everything arrives via props. */

export const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  EQUITY_SECTOR:  { label: "Equity",         className: "bg-blue-900/50 text-blue-300 border border-blue-800/40" },
  FIXED_INCOME:   { label: "Fixed Income",   className: "bg-purple-900/50 text-purple-300 border border-purple-800/40" },
  PRECIOUS_METAL: { label: "Precious Metal", className: "bg-yellow-900/50 text-yellow-300 border border-yellow-800/40" },
  CURRENCY:       { label: "Currency",       className: "bg-emerald-900/50 text-emerald-300 border border-emerald-800/40" },
  CASH:           { label: "Cash",           className: "bg-slate-700 text-slate-300 border border-slate-600" },
  ALTERNATIVE:    { label: "Alternative",    className: "bg-slate-700 text-slate-300 border border-slate-600" },
};

export const RRG_QUADRANT_CONFIG: Record<number, { label: string; color: string; borderClass: string }> = {
  4: { label: "↗ Leading",   color: "text-green-400",  borderClass: "border-l-green-500"  },
  3: { label: "↖ Improving", color: "text-cyan-400",   borderClass: "border-l-cyan-500"   },
  2: { label: "↘ Weakening", color: "text-orange-400", borderClass: "border-l-orange-500" },
  1: { label: "↙ Lagging",   color: "text-slate-400",  borderClass: "border-l-slate-600"  },
};

const TRADE_SIGNAL_CONFIG: Record<TradeSignal, { label: string; className: string; description: string }> = {
  BUY:    { label: "BUY",    className: "bg-green-900/60 text-green-300 border-green-700/60",  description: "Score ≥65, improving RRG quadrant, positive 20d trend — all three aligned" },
  WATCH:  { label: "WATCH",  className: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",     description: "Score ≥50, momentum or RRG improving — worth monitoring for entry" },
  HOLD:   { label: "HOLD",   className: "bg-slate-700/60 text-slate-400 border-slate-600/60",  description: "Mixed signals — maintain existing position, no strong directional bias" },
  REDUCE: { label: "REDUCE", className: "bg-red-900/50 text-red-400 border-red-700/50",        description: "Score <35 with weakening/lagging RRG — consider trimming exposure" },
};

const VELOCITY_THRESHOLD = 0.12;

export const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
  if (!active) return <span className="ml-0.5 text-slate-700 text-[9px]">⇅</span>;
  return <span className="ml-0.5 text-cyan-400 text-[9px]">{dir === "desc" ? "↓" : "↑"}</span>;
};

const TrendPip = ({ trend, label }: { trend: number | null; label: string }) => {
  if (trend == null) return null;
  const points = Math.round(trend * 100);
  const magnitude = Math.abs(points);
  if (magnitude < 1) return null;
  return (
    <span
      className={`text-[9px] tabular-nums ${points > 0 ? "text-emerald-400" : "text-red-400"}`}
      title={`${label} composite score trend: ${points > 0 ? "+" : ""}${points} pts`}
    >
      {points > 0 ? "↑" : "↓"}{magnitude}
    </span>
  );
};

export const StreakBadge = ({ streak }: { streak: number }) => {
  if (Math.abs(streak) < 3) return null;
  const isRising = streak > 0;
  const days = Math.abs(streak);
  return (
    <span
      className={`inline-block px-1 py-0 rounded text-[8px] tabular-nums font-mono ${
        isRising
          ? "text-emerald-400 bg-emerald-900/20 border border-emerald-800/40"
          : "text-red-400 bg-red-900/20 border border-red-800/40"
      }`}
      title={`${days} consecutive day${days > 1 ? "s" : ""} of ${isRising ? "improving" : "declining"} composite score`}
    >
      {isRising ? "↑" : "↓"}{days}d
    </span>
  );
};

const PersistenceVelocity = ({
  persistence5d,
  persistence20d,
}: {
  persistence5d: number | null;
  persistence20d: number | null;
}) => {
  const velocity = computeBreadthVelocity(persistence5d, persistence20d);
  if (!velocity) return null;
  const { recentRate, priorRate, changeInPercentagePoints } = velocity;
  const isAccelerating = changeInPercentagePoints > 0;
  return (
    <span
      className={`text-[8px] tabular-nums ${isAccelerating ? "text-emerald-400" : "text-red-400"}`}
      title={`Breadth velocity: recent-5d ${Math.round(recentRate * 100)}% vs prior-15d ${Math.round(priorRate * 100)}% — ${isAccelerating ? "accelerating" : "decelerating"} (${changeInPercentagePoints > 0 ? "+" : ""}${changeInPercentagePoints}pp)`}
    >
      {isAccelerating ? "⚡" : "⬇"}
    </span>
  );
};

const VolatilityBadge = ({ volatility }: { volatility: number | null }) => {
  if (volatility == null) return null;
  const percent = Math.round(volatility * 100);
  const isHigh = percent >= 30;
  const isModerate = percent >= 20;
  const risk = isHigh ? "high risk" : isModerate ? "moderate risk" : "low risk";
  return (
    <span
      className={`text-[7px] tabular-nums font-mono ${
        isHigh ? "text-red-400" : isModerate ? "text-orange-400" : percent >= 12 ? "text-slate-400" : "text-emerald-500"
      }`}
      title={`20d realized annualized volatility: ${percent}% — ${risk}`}
    >
      ~{percent}%
    </span>
  );
};

const FlowBadge = ({ flow20d }: { flow20d: number | null }) => {
  if (flow20d == null || Math.abs(flow20d) < 0.8) return null;
  const isSurge = Math.abs(flow20d) >= 1.5;
  const isInflow = flow20d > 0;
  const color = isSurge
    ? isInflow ? "text-emerald-400" : "text-red-400"
    : isInflow ? "text-cyan-500" : "text-orange-400";
  const icon = isSurge ? (isInflow ? "⬆" : "⬇") : isInflow ? "↑" : "↓";
  return (
    <span
      className={`text-[7px] tabular-nums font-mono ${color}`}
      title={`Flow z-score: ${flow20d > 0 ? "+" : ""}${flow20d.toFixed(1)}σ (20d avg dollar volume). ${isInflow ? "Above-average inflows" : "Below-average outflows"}${isSurge ? " — adds +5 to conviction score" : ""}`}
    >
      F{icon}
    </span>
  );
};

const ScoreAccelerationPip = ({ trend5d, trend20d }: { trend5d: number | null; trend20d: number | null }) => {
  if (trend5d == null || trend20d == null) return null;
  const acceleration = trend5d - trend20d;
  if (Math.abs(acceleration) < 0.04) return null;
  const isBuilding = acceleration > 0;
  return (
    <span
      className={`text-[7px] font-mono ${isBuilding ? "text-cyan-500" : "text-orange-400"}`}
      title={`Score acceleration: 5d trend (${trend5d > 0 ? "+" : ""}${Math.round(trend5d * 100)}pt) ${isBuilding ? ">" : "<"} 20d trend (${trend20d > 0 ? "+" : ""}${Math.round(trend20d * 100)}pt) — momentum is ${isBuilding ? "building" : "fading"}`}
    >
      {isBuilding ? "↗" : "↘"}
    </span>
  );
};

const ScoreVelocityPip = ({ trend5d }: { trend5d: number | null }) => {
  if (trend5d == null || Math.abs(trend5d) < VELOCITY_THRESHOLD) return null;
  const isSurge = trend5d >= VELOCITY_THRESHOLD;
  return (
    <span
      className={`text-[7px] font-bold px-0.5 rounded ${
        isSurge
          ? "text-emerald-300 bg-emerald-900/40 border border-emerald-700/40"
          : "text-red-300 bg-red-900/40 border border-red-700/40"
      }`}
      title={`Score velocity ${isSurge ? "SURGE" : "CRASH"}: ${trend5d >= 0 ? "+" : ""}${Math.round(trend5d * 100)}pts in 5 days — unusual acceleration`}
    >
      {isSurge ? "⚡" : "⚠"}
    </span>
  );
};

export const ScoreBar = ({ category }: { category: CategorySummary }) => {
  const score = category.compositeScore;
  if (score == null) return <span className="text-slate-600 text-xs">—</span>;

  const percent = Math.round(score * 100);
  const filledCount = Math.round(score * 5);
  const barColor = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  const textColor = score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400";

  const macroFit = category.macroFit ?? null;
  const macroFitPercent = macroFit != null ? Math.round(macroFit * 100) : null;
  const persistence20d = category.persistence20d ?? null;
  const persistencePercent = persistence20d != null ? Math.round((persistence20d / 20) * 100) : null;
  const momentumPoints = category.momentum != null ? Math.round(category.momentum * 100) : null;
  const momentumArrow =
    momentumPoints == null ? null : momentumPoints > 1 ? "▲" : momentumPoints < -1 ? "▼" : null;

  return (
    <div
      className="flex flex-col gap-0.5"
      title={`Composite signal score: ${percent}/100.${macroFitPercent != null ? `\nMacro Fit: ${macroFitPercent}% — historical win rate in current macro regime.` : ""}${persistence20d != null ? `\nPersistence: ${persistence20d}/20 days outperformed benchmark.` : ""}${momentumPoints != null ? `\nMomentum (MOM): ${momentumPoints > 0 ? "+" : ""}${momentumPoints} pts — 10-day RS change.` : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`w-2 h-3.5 rounded-[2px] ${i < filledCount ? barColor : "bg-slate-700"}`} />
          ))}
        </div>
        <span className={`text-xs tabular-nums font-medium ${textColor}`}>{percent}</span>
        <TrendPip trend={category.compositeTrend5d} label="5d" />
        <TrendPip trend={category.compositeTrend20d} label="20d" />
        <ScoreAccelerationPip trend5d={category.compositeTrend5d} trend20d={category.compositeTrend20d} />
        <ScoreVelocityPip trend5d={category.compositeTrend5d} />
        <VolatilityBadge volatility={category.realizedVol20d ?? null} />
        <FlowBadge flow20d={category.flow20d ?? null} />
        {persistencePercent != null && (
          <span
            className={`text-[8px] tabular-nums ${
              persistencePercent >= 60 ? "text-emerald-500" : persistencePercent >= 40 ? "text-slate-500" : "text-red-500"
            }`}
            title={`Persistence: ${persistence20d}/20 days outperformed benchmark (${persistencePercent}%)`}
          >
            {persistence20d}d
          </span>
        )}
        <PersistenceVelocity persistence5d={category.persistence5d ?? null} persistence20d={persistence20d} />
        {momentumArrow != null && (
          <span
            className={`text-[8px] tabular-nums ${momentumPoints! > 1 ? "text-emerald-400" : "text-red-400"}`}
            title={`Momentum: ${momentumPoints! > 0 ? "+" : ""}${momentumPoints} pts (10-day RS change)`}
          >
            {momentumArrow}
          </span>
        )}
      </div>
      {macroFitPercent != null && (
        <div
          className="flex items-center gap-1"
          title={`Macro Fit: ${macroFitPercent}% — historical RS win rate in current regime`}
        >
          <div className="w-10 h-0.5 rounded-full bg-slate-700/60 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                macroFitPercent >= 60 ? "bg-violet-500" : macroFitPercent >= 40 ? "bg-violet-400/60" : "bg-slate-600"
              }`}
              style={{ width: `${macroFitPercent}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-600 tabular-nums">M{macroFitPercent}%</span>
        </div>
      )}
    </div>
  );
};

const HORIZON_GAP = 0.001;

export const RsCell = ({
  value,
  rs120,
  rs20,
  period,
  rankPct,
}: {
  value: number | null;
  rs120?: number | null;
  rs20?: number | null;
  period: string;
  rankPct?: number | null;
}) => {
  if (value == null) return <span className="text-slate-600">—</span>;

  const acceleration = rs120 != null ? value - rs120 : null;
  const accelerationPoints = acceleration != null ? Math.round(acceleration * 100) : null;
  const rs20DivergencePoints = rs20 != null ? Math.round((rs20 - value) * 100) : null;

  const isAlignedBullish = rs20 != null && rs120 != null && rs20 > value && value > rs120;
  const isAlignedBearish = rs20 != null && rs120 != null && rs20 < value && value < rs120;
  const isShortBullish = rs20 != null && rs20 > value + HORIZON_GAP;
  const isShortBearish = rs20 != null && rs20 < value - HORIZON_GAP;
  const isMediumBullish = rs120 != null && value > rs120 + HORIZON_GAP;
  const isMediumBearish = rs120 != null && value < rs120 - HORIZON_GAP;
  const hasCrossHorizonDivergence =
    rs20 != null && rs120 != null && ((isShortBullish && isMediumBearish) || (isShortBearish && isMediumBullish));

  const rs20Title =
    rs20 != null
      ? `RS-20: ${rs20 > 0 ? "+" : ""}${(rs20 * 100).toFixed(1)}% (fastest RS signal — 20-day window).${
          rs20DivergencePoints != null
            ? ` Divergence from RS-60: ${rs20DivergencePoints > 0 ? "+" : ""}${rs20DivergencePoints}pts — ${
                rs20DivergencePoints > 0
                  ? "short-term outpacing long-term (momentum building)"
                  : "short-term lagging long-term (momentum fading)"
              }`
            : ""
        }${
          isAlignedBullish
            ? "\n✓ All RS signals aligned bullish (RS-20 > RS-60 > RS-120) — strong momentum confirmation"
            : isAlignedBearish
            ? "\n✗ All RS signals aligned bearish (RS-20 < RS-60 < RS-120) — deteriorating across all horizons"
            : hasCrossHorizonDivergence
            ? `\n⚠ Cross-horizon RS divergence: short-term ${isShortBullish ? "bull" : "bear"} but medium-term ${isMediumBullish ? "bull" : "bear"} — ${
                isShortBullish && isMediumBearish
                  ? "counter-trend bounce (fading risk)"
                  : "pullback in bull (potential entry)"
              }`
            : ""
        }`
      : "";

  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${period}-day relative strength vs benchmark. Positive = outperforming.${accelerationPoints != null ? `\nAcceleration vs 120d: ${accelerationPoints > 0 ? "+" : ""}${accelerationPoints} pts` : ""}${rankPct != null ? `\nRS peer rank: ${rankPct}th percentile among 11 GICS sectors` : ""}${rs20Title ? "\n" + rs20Title : ""}`}
    >
      <span className={`tabular-nums ${value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400"}`}>
        {value > 0 ? "+" : ""}{(value * 100).toFixed(1)}%
      </span>
      {accelerationPoints != null && Math.abs(accelerationPoints) >= 1 && (
        <span className={`text-[9px] tabular-nums ${accelerationPoints > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {accelerationPoints > 0 ? "↗" : "↘"}
        </span>
      )}
      {isAlignedBullish && <span className="text-[7px] text-emerald-500 font-mono" title={rs20Title}>⊕</span>}
      {isAlignedBearish && <span className="text-[7px] text-red-500 font-mono" title={rs20Title}>⊖</span>}
      {hasCrossHorizonDivergence && !isAlignedBullish && !isAlignedBearish && (
        <span className="text-[7px] text-orange-400 font-mono" title={rs20Title}>÷</span>
      )}
      {rankPct != null && (
        <span
          className={`text-[8px] tabular-nums ${
            rankPct >= 70 ? "text-emerald-500" : rankPct >= 30 ? "text-slate-500" : "text-red-500"
          }`}
          title={`${rankPct}th percentile RS among 11 GICS sectors`}
        >
          P{rankPct}
        </span>
      )}
    </span>
  );
};

export const TradeSignalBadge = ({ category }: { category: CategorySummary }) => {
  const signal = (category.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(category);
  if (signal == null) return <span className="text-slate-600 text-xs">—</span>;

  const config = TRADE_SIGNAL_CONFIG[signal];
  const score = category.compositeScore ?? 0;
  const quadrant = category.rrgQuadrant != null ? Number(category.rrgQuadrant) : null;
  const trend20d = category.compositeTrend20d;

  const isScoreMet = score >= 0.65;
  const isQuadrantMet = quadrant === 3 || quadrant === 4;
  const isTrendMet = trend20d != null && trend20d > 0;
  const conditionsMet = [isScoreMet, isQuadrantMet, isTrendMet].filter(Boolean).length;

  const conviction = category.convictionScore;
  const daysActive = category.signalDaysActive;
  const showConviction = conviction != null && conviction > 0 && (signal === "BUY" || signal === "REDUCE");
  const showDaysActive =
    !showConviction && daysActive != null && daysActive >= 2 && (signal === "BUY" || signal === "WATCH");
  const showConditions = (signal === "WATCH" || signal === "HOLD") && conditionsMet > 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${config.className}`}
        title={config.description}
      >
        {config.label}
      </span>
      {showConviction && (
        <span
          className={`text-[8px] tabular-nums font-mono ${
            conviction >= 75 ? "text-emerald-400" : conviction >= 55 ? "text-amber-400" : "text-slate-500"
          }`}
          title={`Conviction score ${conviction}/100: multi-factor quality rating (signal + macro + percentile + momentum + RS accel). ≥75=high, ≥55=medium`}
        >
          C{conviction}
        </span>
      )}
      {showDaysActive && (
        <span
          className="text-[8px] text-slate-500 tabular-nums font-mono"
          title={`Signal active for ${daysActive} consecutive trading days (composite score ≥ 50)`}
        >
          {daysActive}d
        </span>
      )}
      {showConditions && (
        <div
          className="flex gap-0.5 text-[8px]"
          title={`BUY needs all 3: Score≥65 ${isScoreMet ? "✓" : "✗"} · RRG Improving/Leading ${isQuadrantMet ? "✓" : "✗"} · 20d trend+ ${isTrendMet ? "✓" : "✗"}`}
        >
          <span
            className={isScoreMet ? "text-emerald-400" : "text-slate-700"}
            title={`Score ${Math.round(score * 100)}/100 ${isScoreMet ? "≥65 ✓" : "<65 ✗"}`}
          >
            S
          </span>
          <span
            className={isQuadrantMet ? "text-emerald-400" : "text-slate-700"}
            title={`RRG ${isQuadrantMet ? "Improving/Leading ✓" : "Weakening/Lagging ✗"}`}
          >
            R
          </span>
          <span
            className={isTrendMet ? "text-emerald-400" : "text-slate-700"}
            title={`20d trend ${isTrendMet ? "positive ✓" : "negative/null ✗"}`}
          >
            T
          </span>
        </div>
      )}
    </div>
  );
};

const SubSectorBreadth = ({ subSectors }: { subSectors: SubSectorSummary[] }) => {
  const withSignal = subSectors.filter(s => s.rrgQuadrant != null);
  const bullish = withSignal.filter(s => s.rrgQuadrant === "4" || s.rrgQuadrant === "3").length;
  const percent = withSignal.length > 0 ? Math.round((bullish / withSignal.length) * 100) : null;
  const color =
    percent == null ? "text-slate-600"
    : percent >= 60 ? "text-green-400"
    : percent >= 40 ? "text-amber-400"
    : "text-red-400";
  const title =
    withSignal.length > 0
      ? `${bullish}/${withSignal.length} sub-sectors bullish (Leading/Improving)`
      : `${subSectors.length} sub-sectors (no signal yet)`;
  return (
    <span className={`text-[8px] tabular-nums ${color}`} title={title}>
      {withSignal.length > 0 ? `${bullish}/${withSignal.length}↑` : `${subSectors.length}`}
    </span>
  );
};

export const TopSubChip = ({
  subSector,
  allSubSectors,
}: {
  subSector: SubSectorSummary;
  allSubSectors?: SubSectorSummary[];
}) => {
  const rs60 = subSector.rs60;
  const rsPercent = rs60 != null ? `${rs60 > 0 ? "+" : ""}${(rs60 * 100).toFixed(1)}%` : null;
  const hasBreadth = allSubSectors != null && allSubSectors.length > 1;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono bg-slate-700/60 border border-slate-600/50 text-slate-400"
      title={`Top sub-sector: ${subSector.name} (${subSector.etfTicker})${rsPercent ? ` — RS-60 vs sector: ${rsPercent}` : ""}`}
    >
      <span className="text-slate-500">▲</span>
      <span className="text-slate-300">{subSector.etfTicker}</span>
      {rsPercent && (
        <span className={rs60 == null ? "text-slate-400" : rs60 > 0 ? "text-emerald-400" : "text-red-400"}>
          {rsPercent}
        </span>
      )}
      {hasBreadth && <span className="mx-px text-slate-700">·</span>}
      {hasBreadth && <SubSectorBreadth subSectors={allSubSectors} />}
    </span>
  );
};

export const PriceRangeBar = ({ priceLevel }: { priceLevel?: PriceLevelDto }) => {
  if (!priceLevel || priceLevel.positionInRange == null || priceLevel.drawdownFromHigh == null) return null;
  const position = priceLevel.positionInRange;
  const positionPercent = Math.round(position * 100);
  const drawdownPercent = Math.round(priceLevel.drawdownFromHigh * 100);
  const barColor =
    position >= 0.8 ? "bg-amber-500"
    : position >= 0.5 ? "bg-emerald-500"
    : position >= 0.2 ? "bg-cyan-500"
    : "bg-blue-500";
  const entryNote =
    position >= 0.8 ? " Near 52w high — momentum-following entry."
    : position <= 0.2 ? " Near 52w low — potential deep value entry."
    : "";

  return (
    <div
      className="mt-1 flex flex-col items-end gap-0.5"
      title={`52-week range: position ${positionPercent}% of range. Drawdown from 52w high: ${drawdownPercent}%.${entryNote}`}
    >
      <div className="relative w-12 h-1 bg-slate-700/60 rounded-full overflow-visible">
        <div className={`absolute h-full rounded-full ${barColor} opacity-60`} style={{ width: `${positionPercent}%` }} />
        <div
          className={`absolute w-1 h-2.5 top-1/2 -translate-y-1/2 -translate-x-0.5 rounded-sm ${barColor}`}
          style={{ left: `${positionPercent}%` }}
        />
      </div>
      <span
        className={`text-[8px] tabular-nums font-mono ${
          drawdownPercent >= -5 ? "text-amber-500" : drawdownPercent >= -15 ? "text-slate-500" : "text-cyan-500"
        }`}
      >
        {drawdownPercent}%
      </span>
    </div>
  );
};

export const MacroFitCell = ({ macroFit }: { macroFit: number | null }) => {
  if (macroFit == null) return <span className="text-slate-700 text-xs">—</span>;
  const percent = Math.round(macroFit * 100);
  return (
    <div
      className="flex flex-col items-center gap-0.5"
      title={`Macro Fit: ${percent}% — historical RS win rate in current regime`}
    >
      <div className="w-12 h-1 rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            macroFit >= 0.6 ? "bg-violet-500" : macroFit >= 0.4 ? "bg-violet-400/50" : "bg-slate-600"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`text-[9px] tabular-nums ${
          macroFit >= 0.6 ? "text-violet-400" : macroFit >= 0.4 ? "text-violet-500" : "text-slate-600"
        }`}
      >
        {percent}%
      </span>
    </div>
  );
};

const MIN_WIN_RATE_SIGNALS = 3;

export const WinRateBadge = ({ winRate }: { winRate?: SignalWinRateDto }) => {
  if (!winRate || winRate.winRate == null || winRate.signalCount < MIN_WIN_RATE_SIGNALS) return null;
  const percent = Math.round(winRate.winRate * 100);
  const avgReturn = winRate.avgReturn30d;
  return (
    <div
      className="flex flex-col items-center gap-0"
      data-testid="win-rate-badge"
      title={`Historical win rate: ${percent}% of ${winRate.signalCount} BUY signals produced positive returns over 30 days${avgReturn != null ? `. Avg 30d return: ${avgReturn > 0 ? "+" : ""}${(avgReturn * 100).toFixed(1)}%` : ""}`}
    >
      <span
        className={`text-[8px] tabular-nums font-mono ${
          percent >= 65 ? "text-emerald-400" : percent >= 50 ? "text-amber-400" : "text-slate-500"
        }`}
      >
        {percent}% WR
      </span>
      {avgReturn != null && (
        <span
          className={`text-[8px] tabular-nums font-mono ${avgReturn > 0 ? "text-emerald-500/70" : "text-red-500/70"}`}
        >
          {avgReturn > 0 ? "+" : ""}{(avgReturn * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
};

export const AlertCountBadge = ({ activeAlertCount }: { activeAlertCount: number }) => {
  if (activeAlertCount === 0) return null;
  return (
    <span
      data-testid="alert-badge"
      className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-mono font-semibold bg-red-900/40 text-red-400 border border-red-700/50"
      title={`${activeAlertCount} active alert${activeAlertCount === 1 ? "" : "s"}`}
    >
      ⚠{activeAlertCount}
    </span>
  );
};
