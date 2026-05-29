import Link from "next/link";
import { CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

function conviction(cat: CategorySummary): number {
  let score = 0;
  if ((cat.compositeScore ?? 0) >= 0.60) score++;
  if (cat.rrgQuadrant === "4" || cat.rrgQuadrant === "3") score++;
  if ((cat.compositeTrend20d ?? 0) > 0) score++;
  return score;
}

function ConvictionDots({ count }: { count: number }) {
  return (
    <span className="flex gap-px" title={`${count}/3 signals aligned`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`w-1 h-1 rounded-full ${i < count ? "bg-current opacity-80" : "bg-slate-600 opacity-40"}`}
        />
      ))}
    </span>
  );
}

type Props = { categories: CategorySummary[] };

export default function AllocationBar({ categories }: Props) {
  const equitySectors = categories
    .filter(c => SECTOR_DRILLDOWN_IDS.has(c.id) && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (equitySectors.length < 3) return null;

  const overweight = equitySectors.slice(0, 5);
  const underweight = equitySectors.slice(-3).reverse();
  const topN = overweight.length;
  const allocationPct = Math.round(100 / topN);

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 flex items-start gap-6 flex-wrap text-xs">
      <div className="shrink-0">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">Today&apos;s Positioning</div>
        <div className="text-[10px] text-slate-600">
          Equity sectors · equal-weight · composite signal rank
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1.5 font-semibold">
          ↑ Overweight ({allocationPct}% each)
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {overweight.map(cat => {
            const pct = Math.round((cat.compositeScore ?? 0) * 100);
            const c = conviction(cat);
            return (
              <Link
                key={cat.id}
                href={`/sectors/${cat.id}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-900/30 border border-emerald-700/40 hover:border-emerald-500/60 transition-colors group"
                title={`${cat.name} — Score ${pct}/100 · ${c}/3 signals aligned`}
              >
                <span className="font-mono font-bold text-emerald-300 group-hover:text-emerald-200 text-[11px]">
                  {cat.etfTicker}
                </span>
                <span className="text-[9px] text-emerald-600 tabular-nums">{pct}</span>
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
                title={`${cat.name} — Score ${pct}/100 · ${c}/3 signals aligned`}
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
        ●●● = score + RRG + trend<br />
        all signals aligned
      </div>
    </div>
  );
}
