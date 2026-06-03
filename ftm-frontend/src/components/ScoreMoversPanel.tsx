import { CategorySummary } from "@/lib/api";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type Mover = {
  id: string;
  name: string;
  etfTicker: string;
  trendPts: number;
  scorePct: number;
  signal: string | null;
  conviction: number | null;
  flow20d: number | null;
  rsAlignedBull: boolean;
  rsAlignedBear: boolean;
};

function MoverRow({ mover, direction }: { mover: Mover; direction: "up" | "down" }) {
  const isUp = direction === "up";
  const color = isUp ? "text-emerald-400" : "text-red-400";
  const arrow = isUp ? "▲" : "▼";
  const signalColors: Record<string, string> = {
    BUY:    "text-green-400",
    WATCH:  "text-cyan-400",
    HOLD:   "text-slate-500",
    REDUCE: "text-red-400",
  };
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(mover.id);
  const convictionColor = mover.conviction != null
    ? mover.conviction >= 75 ? "text-emerald-400" : mover.conviction >= 55 ? "text-amber-400" : "text-slate-600"
    : null;

  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`${color} text-[10px] w-3 shrink-0`}>{arrow}</span>
      <span className={`tabular-nums text-[10px] font-mono font-semibold ${color} w-6 shrink-0`}>
        {isUp ? "+" : ""}{mover.trendPts}
      </span>
      <span className="text-[10px] font-mono text-blue-300 shrink-0 w-8">
        {hasDrilldown ? (
          <Link href={`/sectors/${mover.id}`} className="hover:text-cyan-300 transition-colors">
            {mover.etfTicker}
          </Link>
        ) : mover.etfTicker}
      </span>
      <span className="text-[10px] text-slate-400 truncate flex-1">{mover.name}</span>
      {mover.conviction != null && mover.conviction >= 55 && convictionColor && (
        <span className={`text-[8px] font-mono shrink-0 ${convictionColor}`} title={`Conviction score ${mover.conviction}/100`}>C{mover.conviction}</span>
      )}
      {mover.rsAlignedBull && isUp && (
        <span className="text-[7px] font-mono text-emerald-500 shrink-0" title="RS-20 > RS-60 > RS-120 — all timeframes aligned bullish">⊕</span>
      )}
      {mover.rsAlignedBear && !isUp && (
        <span className="text-[7px] font-mono text-red-500 shrink-0" title="RS-20 < RS-60 < RS-120 — all timeframes aligned bearish">⊖</span>
      )}
      {mover.flow20d != null && Math.abs(mover.flow20d) >= 0.8 && (
        <span
          className={`text-[7px] font-mono shrink-0 ${Math.abs(mover.flow20d) >= 1.5 ? (mover.flow20d > 0 ? "text-emerald-400" : "text-red-400") : (mover.flow20d > 0 ? "text-cyan-500" : "text-orange-400")}`}
          title={`Flow z-score: ${mover.flow20d > 0 ? "+" : ""}${mover.flow20d.toFixed(1)}σ — ${Math.abs(mover.flow20d) >= 1.5 ? "institutional surge" : "above-average flow"}`}
        >
          F{mover.flow20d > 0 ? (Math.abs(mover.flow20d) >= 1.5 ? "⬆" : "↑") : (Math.abs(mover.flow20d) >= 1.5 ? "⬇" : "↓")}
        </span>
      )}
      <span className={`text-[9px] shrink-0 ${signalColors[mover.signal ?? "HOLD"] ?? "text-slate-500"}`}>
        {mover.scorePct}
      </span>
    </div>
  );
}

export default function ScoreMoversPanel({ categories }: { categories: CategorySummary[] }) {
  const withTrend = categories
    .filter(c => c.compositeTrend5d != null)
    .map(c => ({
      id: c.id,
      name: c.name,
      etfTicker: c.etfTicker,
      trendPts: Math.round((c.compositeTrend5d ?? 0) * 100),
      scorePct: Math.round((c.compositeScore ?? 0) * 100),
      signal: c.tradeSignal,
      conviction: c.convictionScore ?? null,
      flow20d: c.flow20d ?? null,
      rsAlignedBull: c.rs20 != null && c.rs60 != null && c.rs120 != null && c.rs20 > c.rs60 && c.rs60 > c.rs120,
      rsAlignedBear: c.rs20 != null && c.rs60 != null && c.rs120 != null && c.rs20 < c.rs60 && c.rs60 < c.rs120,
    }))
    .filter(m => Math.abs(m.trendPts) >= 2);

  const gainers = [...withTrend].sort((a, b) => b.trendPts - a.trendPts).slice(0, 4);
  const losers = [...withTrend].sort((a, b) => a.trendPts - b.trendPts).slice(0, 4);

  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">5-Day Score Movers</h2>
        <span className="text-[10px] text-slate-600">composite score change · last 5 sessions</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5">
          <div className="text-[9px] text-emerald-600 font-semibold uppercase tracking-widest mb-1.5">
            Improving
          </div>
          {gainers.length > 0 ? (
            <div className="divide-y divide-slate-700/40">
              {gainers.map(m => <MoverRow key={m.id} mover={m} direction="up" />)}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600">No significant gains</span>
          )}
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5">
          <div className="text-[9px] text-red-600 font-semibold uppercase tracking-widest mb-1.5">
            Deteriorating
          </div>
          {losers.length > 0 ? (
            <div className="divide-y divide-slate-700/40">
              {losers.map(m => <MoverRow key={m.id} mover={m} direction="down" />)}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600">No significant declines</span>
          )}
        </div>
      </div>
    </section>
  );
}
