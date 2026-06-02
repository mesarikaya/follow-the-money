import Link from "next/link";
import { CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

function ConvictionBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-emerald-400" : score >= 55 ? "text-cyan-400" : "text-slate-500";
  return (
    <span className={`text-[8px] font-mono tabular-nums ${color}`} title={`Conviction score: ${score}/100 — multi-factor quality rating`}>
      C{score}
    </span>
  );
}

function AllocationPill({ pct }: { pct: number }) {
  const color = pct >= 25 ? "text-emerald-300" : pct >= 15 ? "text-cyan-400" : "text-slate-400";
  return (
    <span className={`text-[9px] font-bold tabular-nums ${color}`} title={`Conviction-weighted allocation: ~${pct}%`}>
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
    .filter(c => SECTOR_DRILLDOWN_IDS.has(c.id) && c.compositeScore != null);

  if (equitySectors.length < 3) return null;

  const getConviction = (c: CategorySummary) => c.convictionScore ?? 0;

  // Overweight: BUY and high-WATCH signals, sorted by conviction score
  const buySignals = equitySectors
    .filter(c => getSignal(c) === "BUY")
    .sort((a, b) => getConviction(b) - getConviction(a))
    .slice(0, 5);

  // Underweight: REDUCE signals first, then lowest-scoring sectors
  const reduceSignals = equitySectors
    .filter(c => getSignal(c) === "REDUCE")
    .sort((a, b) => getConviction(a) - getConviction(b))
    .slice(0, 3);
  const underweight = reduceSignals.length > 0
    ? reduceSignals
    : [...equitySectors].sort((a, b) => (a.compositeScore ?? 0) - (b.compositeScore ?? 0)).slice(0, 3);

  // Conviction-weighted allocations (only BUY signals get positive weight)
  const totalConviction = buySignals.reduce((sum, c) => sum + Math.max(getConviction(c), 1), 0);
  const weightedAllocations = buySignals.map(c => ({
    ...c,
    allocationPct: totalConviction > 0 ? Math.round((Math.max(getConviction(c), 1) / totalConviction) * 100) : 20,
    signal: getSignal(c),
    convictionScore: getConviction(c),
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
          Conviction-weighted · BUY signals
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1.5 font-semibold">
          ↑ Overweight (conviction-weighted)
        </div>
        {weightedAllocations.length === 0 ? (
          <span className="text-[10px] text-slate-600">No BUY signals active</span>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {weightedAllocations.map(cat => {
              const sigColor = "border-green-700/60 bg-emerald-900/30";
              return (
                <Link
                  key={cat.id}
                  href={`/sectors/${cat.id}`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border ${sigColor} hover:border-emerald-500/60 transition-colors group`}
                  title={`${cat.name} — Conviction ${cat.convictionScore}/100 · Suggested allocation: ~${cat.allocationPct}%`}
                >
                  <span className="font-mono font-bold text-emerald-300 group-hover:text-emerald-200 text-[11px]">
                    {cat.etfTicker}
                  </span>
                  <AllocationPill pct={cat.allocationPct} />
                  <AccelBadge trend5d={cat.compositeTrend5d} trend20d={cat.compositeTrend20d} />
                  {cat.convictionScore > 0 && <ConvictionBadge score={cat.convictionScore} />}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-red-500 uppercase tracking-wider mb-1.5 font-semibold">
          ↓ Underweight / Avoid
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {underweight.map(cat => {
            const pct = Math.round((cat.compositeScore ?? 0) * 100);
            const sig = getSignal(cat);
            const isReduce = sig === "REDUCE";
            return (
              <Link
                key={cat.id}
                href={`/sectors/${cat.id}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors group ${isReduce ? "bg-red-900/25 border-red-700/50 hover:border-red-500/60" : "bg-red-900/15 border-red-800/30 hover:border-red-600/50"}`}
                title={`${cat.name} — Score ${pct}/100${isReduce ? " · REDUCE signal" : " · Lowest-scoring sector"}`}
              >
                <span className="font-mono font-bold text-red-400 group-hover:text-red-300 text-[11px]">
                  {cat.etfTicker}
                </span>
                <span className="text-[9px] text-red-700 tabular-nums">{pct}</span>
                {isReduce && <span className="text-[7px] text-red-500 uppercase font-bold tracking-wider">REDUCE</span>}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 self-end text-[9px] text-slate-700 leading-relaxed text-right">
        Allocation % = conviction-weighted<br />
        BUY signals only · C = conviction score
      </div>
    </div>
  );
}
