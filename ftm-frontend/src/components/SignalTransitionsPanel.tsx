import { fetchSignalTransitions, SignalTransitionDto } from "@/lib/api";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

const SIGNAL_STYLE: Record<string, { badge: string; text: string }> = {
  BUY:    { badge: "bg-green-900/60 text-green-300 border-green-700/50",  text: "text-green-400"  },
  WATCH:  { badge: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",     text: "text-cyan-400"   },
  HOLD:   { badge: "bg-slate-700/60 text-slate-400 border-slate-600/60",  text: "text-slate-400"  },
  REDUCE: { badge: "bg-red-900/50 text-red-400 border-red-700/50",        text: "text-red-400"    },
};

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-slate-600 text-[10px]">—</span>;
  const s = SIGNAL_STYLE[signal] ?? SIGNAL_STYLE.HOLD;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${s.badge}`}>
      {signal}
    </span>
  );
}

function directionLabel(prev: string | null, current: string): { label: string; color: string } {
  const order: Record<string, number> = { BUY: 0, WATCH: 1, HOLD: 2, REDUCE: 3 };
  const prevOrd = prev != null ? (order[prev] ?? 2) : 4;
  const curOrd = order[current] ?? 2;
  if (curOrd < prevOrd) return { label: "↑ Upgrade", color: "text-emerald-400" };
  if (curOrd > prevOrd) return { label: "↓ Downgrade", color: "text-red-400" };
  return { label: "→ Lateral", color: "text-slate-400" };
}

export default async function SignalTransitionsPanel({ days = 7 }: { days?: number }) {
  let transitions: SignalTransitionDto[] = [];
  try {
    transitions = await fetchSignalTransitions(days);
  } catch {
    return null;
  }

  if (transitions.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Signal Changes
        </h2>
        <span className="text-[10px] text-slate-600">last {days} days</span>
        <span className="ml-auto text-[10px] text-slate-600">{transitions.length} transition{transitions.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {transitions.map(t => {
          const dir = directionLabel(t.previousSignal, t.currentSignal);
          const score = Math.round(t.currentScore * 100);
          const scoreColor = score >= 65 ? "text-green-400" : score >= 45 ? "text-yellow-400" : "text-red-400";
          const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(t.categoryId);
          return (
            <div
              key={t.categoryId}
              className={`bg-slate-800/60 border rounded-xl px-4 py-3 flex flex-col gap-2 ${
                t.currentSignal === "BUY" ? "border-green-700/40" :
                t.currentSignal === "REDUCE" ? "border-red-700/40" : "border-slate-700/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {hasDrilldown ? (
                    <Link href={`/sectors/${t.categoryId}`} className="hover:text-cyan-300 transition-colors">
                      <div className="text-slate-100 font-semibold text-sm truncate">{t.categoryName}</div>
                    </Link>
                  ) : (
                    <div className="text-slate-100 font-semibold text-sm truncate">{t.categoryName}</div>
                  )}
                  <div className="text-[10px] text-slate-500 font-mono">{t.etfTicker}</div>
                </div>
                <span className={`text-[9px] font-semibold shrink-0 ${dir.color}`}>{dir.label}</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <SignalBadge signal={t.previousSignal} />
                  <span className="text-slate-600 text-[10px]">→</span>
                  <SignalBadge signal={t.currentSignal} />
                </div>
                <span className={`text-xs font-mono font-semibold ml-auto ${scoreColor}`}>
                  {score}
                </span>
              </div>
              <div className="text-[9px] text-slate-600">
                {t.daysAgo}d ago · as of {t.comparisonDate}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
