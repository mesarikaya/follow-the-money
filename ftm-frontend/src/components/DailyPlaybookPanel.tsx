import Link from "next/link";
import { CategorySummary, PriceLevelDto, SignalWinRateDto, SubSectorSummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal, countBuyConditions, missingBuyConditions } from "@/lib/signals";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import Sparkline from "@/components/Sparkline";

type PlaybookEntry = {
  category: CategorySummary;
  signal: TradeSignal;
  conviction: number;
  convictionLabel: "HIGH" | "MEDIUM" | "WATCH";
  reasons: string[];
  caution: string | null;
  winRate: SignalWinRateDto | null;
  priceLevel: PriceLevelDto | null;
  action: "BUY" | "TRIM" | "MONITOR";
};

function computeConviction(cat: CategorySummary): number {
  const score = cat.compositeScore ?? 0;
  const sig = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
  const macroFit = cat.macroFit ?? 0;
  const pct = cat.scorePercentile252d ?? 0;
  const trend5d = cat.compositeTrend5d ?? 0;
  const trend20d = cat.compositeTrend20d ?? 0;

  let points = 0;

  // Signal quality
  if (sig === "BUY") points += 30;
  else if (sig === "REDUCE") points += 25;
  else if (sig === "WATCH" && countBuyConditions(cat) === 2) points += 15;
  else return 0;

  // Score level
  if (score >= 0.80) points += 20;
  else if (score >= 0.65) points += 15;
  else if (score >= 0.50) points += 8;

  // Macro alignment
  if (macroFit >= 0.75) points += 18;
  else if (macroFit >= 0.55) points += 12;
  else if (macroFit >= 0.35) points += 5;

  // Historical percentile
  if (pct >= 0.85) points += 15;
  else if (pct >= 0.70) points += 10;
  else if (pct >= 0.50) points += 5;

  // Momentum: 5d vs 20d acceleration
  const accel = trend5d - trend20d;
  if (sig === "BUY" && accel >= 0.02) points += 12;
  else if (sig === "REDUCE" && accel <= -0.02) points += 12;
  else if (Math.abs(accel) <= 0.01) points += 4;

  // RS acceleration (short vs long)
  if (cat.rs60 != null && cat.rs120 != null) {
    const rsAccel = cat.rs60 - cat.rs120;
    if (sig === "BUY" && rsAccel > 0.003) points += 5;
    else if (sig === "REDUCE" && rsAccel < -0.003) points += 5;

    // RS-20 all-aligned bonus: rs20 > rs60 > rs120 confirms near-term momentum building
    if (cat.rs20 != null) {
      const allAlignedBullish = cat.rs20 > cat.rs60 && cat.rs60 > cat.rs120;
      const allAlignedBearish = cat.rs20 < cat.rs60 && cat.rs60 < cat.rs120;
      if (sig === "BUY" && allAlignedBullish) points += 5;
      else if (sig === "REDUCE" && allAlignedBearish) points += 5;
    }
  }

  // Institutional flow confirmation (matches backend TradeSignalDeriver logic)
  const flowZ = cat.flow20d;
  if (flowZ != null) {
    if (sig === "BUY" && flowZ > 1.5) points += 5;
    else if (sig === "REDUCE" && flowZ < -1.5) points += 5;
  }

  return Math.min(points, 100);
}

function buildReasons(
  cat: CategorySummary,
  sig: TradeSignal,
  pl: PriceLevelDto | null,
  wr: SignalWinRateDto | null
): { reasons: string[]; caution: string | null } {
  const reasons: string[] = [];
  const score = Math.round((cat.compositeScore ?? 0) * 100);
  const pct = cat.scorePercentile252d;
  const macroFit = cat.macroFit;
  const trend5d = cat.compositeTrend5d;
  const trend20d = cat.compositeTrend20d;
  const rrg = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;

  if (pct != null && pct >= 0.80) {
    reasons.push(`${Math.round(pct * 100)}th pct. in 252d — near historical high`);
  } else if (pct != null && pct <= 0.20) {
    reasons.push(`${Math.round(pct * 100)}th pct. in 252d — near historical low`);
  }

  if (macroFit != null && macroFit >= 0.60) {
    reasons.push(`macro aligned ${Math.round(macroFit * 100)}%`);
  }

  if (trend5d != null && trend20d != null) {
    const accel = trend5d - trend20d;
    const t5pts = Math.round(trend5d * 100);
    if (sig === "BUY" && accel >= 0.02 && t5pts > 0) {
      reasons.push(`accelerating (+${t5pts} pts 5d)`);
    } else if (sig === "REDUCE" && accel <= -0.02 && t5pts < 0) {
      reasons.push(`decelerating (${t5pts} pts 5d)`);
    } else if (t5pts !== 0) {
      reasons.push(`${t5pts > 0 ? "+" : ""}${t5pts} pts this week`);
    }
  }

  if (rrg === 4) reasons.push("RRG: Leading quadrant");
  else if (rrg === 3) reasons.push("RRG: Improving quadrant");
  else if (rrg === 2) reasons.push("RRG: Weakening");
  else if (rrg === 1) reasons.push("RRG: Lagging");

  const rs20 = cat.rs20;
  const rs60 = cat.rs60;
  const rs120 = cat.rs120;
  if (rs20 != null && rs60 != null && rs120 != null) {
    if (sig === "BUY" && rs20 > rs60 && rs60 > rs120) {
      reasons.push(`RS all-aligned ↑ (20d > 60d > 120d) — momentum building across horizons`);
    } else if (sig === "REDUCE" && rs20 < rs60 && rs60 < rs120) {
      reasons.push(`RS all-aligned ↓ (20d < 60d < 120d) — deteriorating across all horizons`);
    } else if (sig === "BUY" && rs20 > rs60) {
      const rs20Pts = Math.round((rs20 - rs60) * 100);
      if (rs20Pts >= 1) reasons.push(`RS-20 ${rs20Pts}pt ahead of RS-60 — short-term gaining`);
    }
  }

  if (wr != null && wr.winRate != null && (sig === "BUY" || sig === "REDUCE") && wr.signalCount >= 5) {
    const winPct = Math.round(wr.winRate * 100);
    const avgRet30 = wr.avgReturn30d != null ? (wr.avgReturn30d * 100).toFixed(1) : null;
    const avgRet90 = wr.avgReturn90d != null ? (wr.avgReturn90d * 100).toFixed(1) : null;
    const returnDetail = avgRet30 ? `, avg +${avgRet30}%/30d${avgRet90 ? ` · +${avgRet90}%/90d` : ""}` : "";
    reasons.push(`historical win rate ${winPct}% (${wr.signalCount} signals${returnDetail})`);
  }

  const flowZ = cat.flow20d;
  if (flowZ != null) {
    if (sig === "BUY" && flowZ > 1.5) {
      reasons.push(`institutional flow surge ${flowZ.toFixed(1)}σ — confirms BUY`);
    } else if (sig === "REDUCE" && flowZ < -1.5) {
      reasons.push(`institutional outflow ${flowZ.toFixed(1)}σ — confirms REDUCE`);
    } else if (sig === "BUY" && flowZ > 0.8) {
      reasons.push(`flow ${flowZ.toFixed(1)}σ above avg`);
    } else if (sig === "REDUCE" && flowZ < -0.8) {
      reasons.push(`flow ${flowZ.toFixed(1)}σ below avg`);
    }
  }

  // Caution flags
  let caution: string | null = null;
  if (pl != null && pl.drawdownFromHigh != null && sig === "BUY" && pl.drawdownFromHigh >= -0.04) {
    caution = `near 52w high (${(pl.drawdownFromHigh * 100).toFixed(0)}%) — scale in`;
  } else if (pl != null && pl.drawdownFromHigh != null && sig === "BUY" && pl.drawdownFromHigh <= -0.20) {
    caution = `${(pl.drawdownFromHigh * 100).toFixed(0)}% off high — verify trend before adding`;
  } else if (cat.signalDaysActive != null && cat.signalDaysActive < 3 && (sig === "BUY" || sig === "REDUCE")) {
    caution = `signal only ${cat.signalDaysActive}d old — confirm before acting`;
  }

  return { reasons, caution };
}

function computeBuyRiskFactors(cat: CategorySummary): string[] {
  const risks: string[] = [];
  const rrg = cat.rrgQuadrant != null ? parseInt(cat.rrgQuadrant) : null;
  if (rrg != null && rrg === 3) risks.push("RRG not yet Leading");
  const pct = cat.scorePercentile252d;
  if (pct != null && pct >= 0.88) risks.push("near 252d extreme");
  const vol = cat.realizedVol20d;
  if (vol != null && vol >= 0.30) risks.push(`high vol ${(vol * 100).toFixed(0)}% (size down)`);
  const trend5d = cat.compositeTrend5d;
  if (trend5d != null && trend5d < -0.03) risks.push("score declining");
  return risks;
}

function computeTrimRiskFactors(cat: CategorySummary): string[] {
  const risks: string[] = [];
  const rrg = cat.rrgQuadrant != null ? parseInt(cat.rrgQuadrant) : null;
  // Selling into RRG Leading strength is timing risk
  if (rrg != null && rrg === 4) risks.push("still RRG Leading");
  const pct = cat.scorePercentile252d;
  if (pct != null && pct <= 0.15) risks.push("near 252d low (oversold bounce risk)");
  const trend5d = cat.compositeTrend5d;
  if (trend5d != null && trend5d >= 0.05) risks.push("score still rising");
  const vol = cat.realizedVol20d;
  if (vol != null && vol >= 0.35) risks.push(`high vol ${(vol * 100).toFixed(0)}%`);
  return risks;
}

function ConvictionDot({ level }: { level: "HIGH" | "MEDIUM" | "WATCH" }) {
  const styles = {
    HIGH:   "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.6)]",
    MEDIUM: "bg-amber-400",
    WATCH:  "bg-cyan-500",
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${styles[level]}`} />;
}

function ActionLabel({ action }: { action: "BUY" | "TRIM" | "MONITOR" }) {
  const cfg = {
    BUY:     { label: "ADD",     cls: "bg-green-900/50 text-green-300 border-green-700/60" },
    TRIM:    { label: "TRIM",    cls: "bg-red-900/50 text-red-300 border-red-700/60" },
    MONITOR: { label: "MONITOR", cls: "bg-cyan-900/40 text-cyan-400 border-cyan-700/50" },
  };
  const { label, cls } = cfg[action];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function PlaybookRow({ entry, scoreHistory, subSectors }: { entry: PlaybookEntry; scoreHistory: Record<string, number[]>; subSectors?: SubSectorSummary[] }) {
  const cat = entry.category;
  const score = Math.round((cat.compositeScore ?? 0) * 100);
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(cat.id);
  const history = scoreHistory[cat.id];

  const scoreColor =
    score >= 70 ? "text-emerald-400" :
    score >= 50 ? "text-amber-400" :
    "text-red-400";

  const drawdown = entry.priceLevel?.drawdownFromHigh;
  const posInRange = entry.priceLevel?.positionInRange;

  return (
    <div className="px-4 py-2.5 border-b border-slate-700/30 last:border-0 flex items-start gap-3">
      <div className="flex items-center gap-2 mt-0.5 shrink-0">
        <ConvictionDot level={entry.convictionLabel} />
        <ActionLabel action={entry.action} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {hasDrilldown ? (
            <Link
              href={`/sectors/${cat.id}`}
              className="font-mono text-sm font-bold text-blue-300 hover:text-cyan-300 transition-colors"
            >
              {cat.etfTicker}
            </Link>
          ) : (
            <span className="font-mono text-sm font-bold text-blue-300">{cat.etfTicker}</span>
          )}
          <span className="text-[10px] text-slate-500 truncate">{cat.name}</span>
          <span className={`ml-auto font-mono text-sm font-bold tabular-nums ${scoreColor}`}>{score}</span>
          <span className="text-[10px] text-slate-600">/100</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {entry.reasons.map((r, i) => (
            <span key={i} className="text-[10px] text-slate-400">
              {i > 0 && <span className="text-slate-700 mr-2">·</span>}
              {r}
            </span>
          ))}
        </div>

        {(entry.caution || drawdown != null || posInRange != null) && (
          <div className="mt-0.5 flex items-center gap-3 flex-wrap">
            {entry.caution && (
              <span className="text-[9px] text-amber-500/80">⚠ {entry.caution}</span>
            )}
            {drawdown != null && Math.abs(drawdown) >= 0.05 && (
              <span
                className="text-[9px] text-slate-600"
                title={`${(drawdown * 100).toFixed(1)}% from 52w high. Position in 52w range: ${posInRange != null ? Math.round(posInRange * 100) + "%" : "n/a"}`}
              >
                {(drawdown * 100).toFixed(0)}% off high
              </span>
            )}
            {history && history.length >= 5 && (() => {
              const recentSlope = history[history.length - 1] - history[Math.max(0, history.length - 6)];
              const slopePts = Math.round(recentSlope * 100);
              if (Math.abs(slopePts) < 3) return null;
              return (
                <span className={`text-[9px] font-mono ${slopePts > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  5d trend {slopePts > 0 ? "+" : ""}{slopePts}pts
                </span>
              );
            })()}
          </div>
        )}

        {entry.signal === "BUY" && (() => {
          const risks = computeBuyRiskFactors(cat);
          if (risks.length === 0) return null;
          return (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[9px] text-orange-500/70">
                {risks.length === 1 ? "⚠ risk:" : `⚠ ${risks.length} risks:`}
              </span>
              <span className="text-[9px] text-orange-600/60">{risks.join(" · ")}</span>
            </div>
          );
        })()}
        {entry.signal === "REDUCE" && (() => {
          const risks = computeTrimRiskFactors(cat);
          if (risks.length === 0) return null;
          return (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[9px] text-amber-600/70">
                {risks.length === 1 ? "⚠ caution:" : `⚠ ${risks.length} cautions:`}
              </span>
              <span className="text-[9px] text-amber-700/60">{risks.join(" · ")}</span>
            </div>
          );
        })()}

        {entry.signal === "WATCH" && (
          <div className="mt-0.5 flex items-center gap-3">
            <span className="text-[9px] text-cyan-700">
              Missing: {missingBuyConditions(cat).join(" · ")}
            </span>
            {(() => {
              const trend5d = cat.compositeTrend5d;
              const score = cat.compositeScore;
              if (trend5d == null || score == null || trend5d <= 0) return null;
              const dailyRate = trend5d / 5; // compositeTrend5d is 5d total change, not per-day
              const gapToBuy = 0.65 - score;
              if (gapToBuy <= 0 || dailyRate <= 0) return null;
              const days = Math.ceil(gapToBuy / dailyRate);
              if (days > 14) return null;
              return (
                <span
                  className="text-[9px] font-mono text-emerald-600/70"
                  title={`At current 5d trend (+${(trend5d * 100).toFixed(1)}pts/5d), score would reach BUY threshold (65) in ~${days} trading days`}
                >
                  ~{days}d to BUY
                </span>
              );
            })()}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {history && history.length >= 5 && (
          <Sparkline values={history.slice(-20)} width={44} height={14} />
        )}
        <span
          className="text-[9px] font-mono text-slate-600 tabular-nums"
          title="Conviction score: composite of signal quality, macro alignment, percentile, momentum, and RS acceleration"
        >
          C{entry.conviction}
        </span>
        {cat.signalDaysActive != null && cat.signalDaysActive >= 2 && (
          <span className="text-[9px] text-slate-700 font-mono">{cat.signalDaysActive}d</span>
        )}
        <SubSectorBreadth subSectors={subSectors} />
      </div>
    </div>
  );
}

type Props = {
  categories: CategorySummary[];
  winRateByCategory: Record<string, SignalWinRateDto>;
  priceLevelByCategory: Record<string, PriceLevelDto>;
  scoreHistory: Record<string, number[]>;
  subSectorsByParent?: Record<string, SubSectorSummary[]>;
};

function SubSectorBreadth({ subSectors }: { subSectors: SubSectorSummary[] | undefined }) {
  if (!subSectors || subSectors.length === 0) return null;
  const bullish = subSectors.filter(s => {
    const q = s.rrgQuadrant != null ? Number(s.rrgQuadrant) : 0;
    return q === 3 || q === 4;
  }).length;
  const bullishPct = Math.round((bullish / subSectors.length) * 100);
  const color = bullishPct >= 60 ? "text-emerald-600" : bullishPct >= 40 ? "text-amber-600" : "text-slate-600";
  const barColor = bullishPct >= 60 ? "bg-emerald-500" : bullishPct >= 40 ? "bg-amber-500" : "bg-slate-600";

  return (
    <span className="flex items-center gap-1" title={`${bullish}/${subSectors.length} sub-sectors in Leading/Improving RRG phase (${bullishPct}% bullish)`}>
      <span className={`text-[9px] font-mono tabular-nums ${color}`}>{bullish}/{subSectors.length}</span>
      <span className="relative w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
        <span className={`absolute inset-y-0 left-0 ${barColor} rounded-full`} style={{ width: `${bullishPct}%` }} />
      </span>
    </span>
  );
}

export default function DailyPlaybookPanel({
  categories,
  winRateByCategory,
  priceLevelByCategory,
  scoreHistory,
  subSectorsByParent = {},
}: Props) {
  const equities = categories.filter(c => c.type === "EQUITY_SECTOR");
  if (equities.length < 3) return null;

  const entries: PlaybookEntry[] = [];

  for (const cat of equities) {
    const sig = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
    if (!sig || sig === "HOLD") continue;

    // Prefer server-computed conviction score; fall back to frontend computation
    const conviction = cat.convictionScore != null ? cat.convictionScore : computeConviction(cat);
    if (conviction < 35) continue;

    const pl = priceLevelByCategory[cat.id] ?? null;
    const wr = winRateByCategory[cat.id] ?? null;
    const { reasons, caution } = buildReasons(cat, sig, pl, wr);

    const convictionLabel: "HIGH" | "MEDIUM" | "WATCH" =
      conviction >= 75 ? "HIGH" :
      conviction >= 55 ? "MEDIUM" :
      "WATCH";

    const action: "BUY" | "TRIM" | "MONITOR" =
      sig === "BUY" ? "BUY" :
      sig === "REDUCE" ? "TRIM" :
      "MONITOR";

    entries.push({ category: cat, signal: sig, conviction, convictionLabel, reasons, caution, winRate: wr, priceLevel: pl, action });
  }

  if (entries.length === 0) return null;

  // Sort: tier (HIGH→MEDIUM→WATCH), then within tier by:
  //   1. Momentum alignment (5d trend in signal direction) — accelerating entries rank higher
  //   2. Conviction score descending
  entries.sort((a, b) => {
    const tierOrder = { HIGH: 0, MEDIUM: 1, WATCH: 2 };
    const tierDiff = tierOrder[a.convictionLabel] - tierOrder[b.convictionLabel];
    if (tierDiff !== 0) return tierDiff;

    // Momentum alignment bonus: reward entries where short-term trend aligns with signal
    const momentumScore = (e: PlaybookEntry): number => {
      const t5d = e.category.compositeTrend5d ?? 0;
      const t20d = e.category.compositeTrend20d ?? 0;
      const accel = t5d - t20d;
      if (e.signal === "BUY"    && accel >= 0.02) return 2;
      if (e.signal === "BUY"    && t5d > 0)       return 1;
      if (e.signal === "REDUCE" && accel <= -0.02) return 2;
      if (e.signal === "REDUCE" && t5d < 0)        return 1;
      return 0;
    };

    const mDiff = momentumScore(b) - momentumScore(a);
    if (mDiff !== 0) return mDiff;
    return b.conviction - a.conviction;
  });

  const topEntries = entries.slice(0, 5);
  const highCount = topEntries.filter(e => e.convictionLabel === "HIGH").length;
  const headerLabel =
    highCount >= 2 ? "Multiple high-conviction setups" :
    highCount === 1 ? "1 high-conviction setup" :
    "Developing setups";

  const headerColor =
    highCount >= 2 ? "text-emerald-300" :
    highCount === 1 ? "text-amber-300" :
    "text-slate-400";

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-700/40 bg-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Playbook</span>
          <span className={`text-[10px] ${headerColor}`}>{headerLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_1px_rgba(52,211,153,0.5)]" />
            High conviction
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Watch
          </span>
        </div>
      </div>

      <div>
        {topEntries.map(entry => (
          <PlaybookRow
            key={entry.category.id}
            entry={entry}
            scoreHistory={scoreHistory}
            subSectors={subSectorsByParent[entry.category.id]}
          />
        ))}
      </div>

      <div className="px-4 py-1.5 border-t border-slate-700/30 text-[9px] text-slate-600 flex items-center gap-2">
        <span>C = conviction score (signal · macro · percentile · momentum · RS accel)</span>
        <Link href="/portfolio" className="ml-auto text-slate-600 hover:text-slate-400 transition-colors">
          → Portfolio →
        </Link>
      </div>
    </div>
  );
}
