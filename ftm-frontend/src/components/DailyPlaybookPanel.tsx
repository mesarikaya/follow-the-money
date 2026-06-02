import Link from "next/link";
import { CategorySummary, PriceLevelDto, SignalWinRateDto } from "@/lib/api";
import { deriveTradeSignal, TradeSignal, countBuyConditions, missingBuyConditions } from "@/lib/signals";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

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

  if (wr != null && (sig === "BUY" || sig === "REDUCE") && wr.signalCount >= 5) {
    const winPct = Math.round(wr.winRate * 100);
    const avgRet = wr.avgReturn30d != null ? (wr.avgReturn30d * 100).toFixed(1) : null;
    reasons.push(`historical win rate ${winPct}% (${wr.signalCount} signals${avgRet ? `, avg +${avgRet}% / 30d` : ""})`);
  }

  // Caution flags
  let caution: string | null = null;
  if (pl != null && sig === "BUY" && pl.drawdownFromHigh >= -0.04) {
    caution = `near 52w high (${(pl.drawdownFromHigh * 100).toFixed(0)}%) — scale in`;
  } else if (pl != null && sig === "BUY" && pl.drawdownFromHigh <= -0.20) {
    caution = `${(pl.drawdownFromHigh * 100).toFixed(0)}% off high — verify trend before adding`;
  } else if (cat.signalDaysActive != null && cat.signalDaysActive < 3 && (sig === "BUY" || sig === "REDUCE")) {
    caution = `signal only ${cat.signalDaysActive}d old — confirm before acting`;
  }

  return { reasons, caution };
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

function PlaybookRow({ entry, scoreHistory }: { entry: PlaybookEntry; scoreHistory: Record<string, number[]> }) {
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

        {entry.signal === "WATCH" && (
          <div className="mt-0.5 text-[9px] text-cyan-700">
            Missing: {missingBuyConditions(cat).join(" · ")}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <span
          className="text-[9px] font-mono text-slate-600 tabular-nums"
          title="Conviction score: composite of signal quality, macro alignment, percentile, momentum, and RS acceleration"
        >
          C{entry.conviction}
        </span>
        {cat.signalDaysActive != null && cat.signalDaysActive >= 2 && (
          <span className="text-[9px] text-slate-700 font-mono">{cat.signalDaysActive}d</span>
        )}
      </div>
    </div>
  );
}

type Props = {
  categories: CategorySummary[];
  winRateByCategory: Record<string, SignalWinRateDto>;
  priceLevelByCategory: Record<string, PriceLevelDto>;
  scoreHistory: Record<string, number[]>;
};

export default function DailyPlaybookPanel({
  categories,
  winRateByCategory,
  priceLevelByCategory,
  scoreHistory,
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

  // Sort: HIGH first, then MEDIUM, then WATCH; within tier by conviction desc
  entries.sort((a, b) => {
    const tierOrder = { HIGH: 0, MEDIUM: 1, WATCH: 2 };
    const tierDiff = tierOrder[a.convictionLabel] - tierOrder[b.convictionLabel];
    return tierDiff !== 0 ? tierDiff : b.conviction - a.conviction;
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
          <PlaybookRow key={entry.category.id} entry={entry} scoreHistory={scoreHistory} />
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
