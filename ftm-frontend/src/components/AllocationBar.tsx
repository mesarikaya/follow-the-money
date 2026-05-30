import Link from "next/link";
import { CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

function conviction(cat: CategorySummary): number {
  let score = 0;
  if ((cat.compositeScore ?? 0) >= 0.60) score++;
  if (cat.rrgQuadrant === "4" || cat.rrgQuadrant === "3") score++;
  if ((cat.compositeTrend20d ?? 0) > 0) score++;
  if ((cat.macroFit ?? 0) >= 0.60) score++;
  return score;
}

function ConvictionDots({ count }: { count: number }) {
  return (
    <span className="flex gap-px" title={`${count}/4 signals aligned`}>
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          className={`w-1 h-1 rounded-full ${i < count ? "bg-current opacity-80" : "bg-slate-600 opacity-40"}`}
        />
      ))}
    </span>
  );
}

function AllocationPill({ pct }: { pct: number }) {
  const color = pct >= 20 ? "text-emerald-300" : pct >= 12 ? "text-cyan-400" : "text-slate-400";
  return (
    <span className={`text-[9px] font-bold tabular-nums ${color}`} title={`Recommended allocation: ~${pct}% (score-weighted)`}>
      {pct}%
    </span>
  );
}

function AccelBadge({ trend5d, trend20d }: { trend5d: number | null; trend20d: number | null }) {
  if (trend5d == null || trend20d == null) return null;
  const accel = trend5d - trend20d;
  if (accel > 0.03) {
    return (
      <span
        className="text-[8px] text-emerald-300 font-bold"
        title={`Score acceleration: 5d trend (${Math.round(trend5d * 100)}pts) is significantly faster than 20d baseline (${Math.round(trend20d * 100)}pts) — momentum building`}
      >
        ↑↑
      </span>
    );
  }
  if (accel < -0.03) {
    return (
      <span
        className="text-[8px] text-amber-400 font-bold"
        title={`Score deceleration: 5d trend (${Math.round(trend5d * 100)}pts) is slower than 20d baseline — momentum fading`}
      >
        ↘
      </span>
    );
  }
  return null;
}

type Props = { categories: CategorySummary[] };

export default function AllocationBar({ categories }: Props) {
  const getSignal = (c: CategorySummary) => (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);

  const equitySectors = categories
    .filter(c => SECTOR_DRILLDOWN_IDS.has(c.id) && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (equitySectors.length < 3) return null;

  // Score-weighted allocation for top 5 sectors
  const overweight = equitySectors.slice(0, 5);
  const underweight = equitySectors.slice(-3).reverse();

  const totalScore = overweight.reduce((sum, c) => sum + (c.compositeScore ?? 0), 0);
  const weightedAllocations = overweight.map(c => ({
    ...c,
    allocationPct: totalScore > 0 ? Math.round(((c.compositeScore ?? 0) / totalScore) * 100) : 20,
    signal: getSignal(c),
  }));

  // Ensure allocations sum to 100
  const allocSum = weightedAllocations.reduce((s, c) => s + c.allocationPct, 0);
  if (allocSum !== 100 && weightedAllocations.length > 0) {
    weightedAllocations[0].allocationPct += 100 - allocSum;
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 flex items-start gap-6 flex-wrap text-xs">
      <div className="shrink-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Today&apos;s Positioning</div>
        <div className="text-[10px] text-slate-600">
          Score-weighted · equity sectors
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1.5 font-semibold">
          ↑ Overweight (score-weighted)
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {weightedAllocations.map(cat => {
            const pct = Math.round((cat.compositeScore ?? 0) * 100);
            const c = conviction(cat);
            const sigColor = cat.signal === "BUY" ? "border-green-700/60 bg-emerald-900/30" : cat.signal === "WATCH" ? "border-cyan-700/50 bg-cyan-900/20" : "border-emerald-700/40 bg-emerald-900/30";
            return (
              <Link
                key={cat.id}
                href={`/sectors/${cat.id}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border ${sigColor} hover:border-emerald-500/60 transition-colors group`}
                title={`${cat.name} — Score ${pct}/100 · ${c}/4 signals · Recommended allocation: ~${cat.allocationPct}%`}
              >
                <span className="font-mono font-bold text-emerald-300 group-hover:text-emerald-200 text-[11px]">
                  {cat.etfTicker}
                </span>
                <AllocationPill pct={cat.allocationPct} />
                <AccelBadge trend5d={cat.compositeTrend5d} trend20d={cat.compositeTrend20d} />
                <span className="text-emerald-400">
                  <ConvictionDots count={c} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-red-500 uppercase tracking-wider mb-1.5 font-semibold">
          ↓ Underweight / Avoid
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {underweight.map(cat => {
            const pct = Math.round((cat.compositeScore ?? 0) * 100);
            const c = conviction(cat);
            return (
              <Link
                key={cat.id}
                href={`/sectors/${cat.id}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-900/20 border border-red-800/30 hover:border-red-600/50 transition-colors group"
                title={`${cat.name} — Score ${pct}/100 · ${c}/4 signals aligned`}
              >
                <span className="font-mono font-bold text-red-400 group-hover:text-red-300 text-[11px]">
                  {cat.etfTicker}
                </span>
                <span className="text-[9px] text-red-700 tabular-nums">{pct}</span>
                <span className="text-red-500">
                  <ConvictionDots count={c} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 self-end text-[9px] text-slate-700 leading-relaxed text-right">
        Allocation % = score-weighted<br />
        ●●●● = score + RRG + trend + regime
      </div>
    </div>
  );
}
