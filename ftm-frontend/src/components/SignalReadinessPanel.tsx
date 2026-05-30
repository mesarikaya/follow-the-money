import Link from "next/link";
import { CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

type Condition = {
  key: string;
  label: string;
  met: boolean;
  tooltip: string;
};

function buildConditions(cat: CategorySummary): Condition[] {
  const score = cat.compositeScore ?? 0;
  const quadrant = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;
  const trend20d = cat.compositeTrend20d;
  const macroFit = cat.macroFit ?? 0;

  return [
    {
      key: "score",
      label: "Score",
      met: score >= 0.65,
      tooltip: `Composite score: ${Math.round(score * 100)}/100 (need ≥65)`,
    },
    {
      key: "rrg",
      label: "RRG",
      met: quadrant === 3 || quadrant === 4,
      tooltip: `RRG quadrant: ${quadrant === 4 ? "Leading ↗" : quadrant === 3 ? "Improving ↖" : quadrant === 2 ? "Weakening ↘" : quadrant === 1 ? "Lagging ↙" : "Unknown"} (need Improving or Leading)`,
    },
    {
      key: "trend",
      label: "Trend",
      met: trend20d != null && trend20d > 0,
      tooltip: `20d score trend: ${trend20d != null ? (trend20d > 0 ? `+${Math.round(trend20d * 100)}pt rising` : `${Math.round(trend20d * 100)}pt falling`) : "unavailable"} (need positive)`,
    },
    {
      key: "regime",
      label: "Regime",
      met: macroFit >= 0.60,
      tooltip: `Macro fit: ${Math.round(macroFit * 100)}% win rate in current regime (≥60% is favorable)`,
    },
  ];
}

const SIGNAL_ORDER: Record<TradeSignal, number> = { BUY: 0, WATCH: 1, HOLD: 2, REDUCE: 3 };
const SIGNAL_STYLE: Record<TradeSignal, { badge: string; rowBg: string }> = {
  BUY:    { badge: "bg-green-900/60 text-green-300 border-green-700/60",  rowBg: "border-l-green-500"  },
  WATCH:  { badge: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",     rowBg: "border-l-cyan-500"   },
  HOLD:   { badge: "bg-slate-700/60 text-slate-400 border-slate-600/60",  rowBg: "border-l-slate-600"  },
  REDUCE: { badge: "bg-red-900/50 text-red-400 border-red-700/50",        rowBg: "border-l-red-600"    },
};

function ConditionDot({ met, label, tooltip }: { met: boolean; label: string; tooltip: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={tooltip}>
      <span
        className={`w-2 h-2 rounded-full transition-colors ${met ? "bg-emerald-400" : "bg-slate-700 border border-slate-600"}`}
      />
      <span className={`text-[7px] font-mono ${met ? "text-emerald-500" : "text-slate-700"}`}>
        {label[0]}
      </span>
    </div>
  );
}

function SectorRow({ cat }: { cat: CategorySummary }) {
  const signal = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
  const conditions = buildConditions(cat);
  const metCount = conditions.filter(c => c.met).length;
  const allMet = metCount === conditions.length;
  const signalStyle = signal ? SIGNAL_STYLE[signal] : SIGNAL_STYLE.HOLD;
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(cat.id);
  const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;

  const scoreColor = score == null
    ? "text-slate-600"
    : score >= 65 ? "text-green-400" : score >= 40 ? "text-yellow-400" : "text-red-400";

  const missingConditions = conditions.filter(c => !c.met);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 border-l-2 ${signalStyle.rowBg} hover:bg-slate-800/40 transition-colors rounded-r-lg`}
    >
      {/* Ticker + name */}
      <div className="w-28 shrink-0">
        {hasDrilldown ? (
          <Link href={`/sectors/${cat.id}`} className="font-mono text-xs font-bold text-cyan-400 hover:text-cyan-200 transition-colors">
            {cat.etfTicker}
          </Link>
        ) : (
          <span className="font-mono text-xs font-bold text-slate-400">{cat.etfTicker}</span>
        )}
        <div className="text-[9px] text-slate-600 truncate">{cat.name}</div>
      </div>

      {/* Score */}
      <div className={`text-xs tabular-nums font-bold w-8 shrink-0 text-right ${scoreColor}`}>
        {score ?? "—"}
      </div>

      {/* Condition dots */}
      <div className="flex items-center gap-2 shrink-0">
        {conditions.map(c => (
          <ConditionDot key={c.key} met={c.met} label={c.label} tooltip={c.tooltip} />
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {conditions.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${i < metCount ? (allMet ? "bg-green-500 w-5" : "bg-cyan-500 w-5") : "bg-slate-700 w-5"}`}
              />
            ))}
          </div>
          <span className="text-[8px] text-slate-600 tabular-nums ml-1">{metCount}/4</span>
        </div>
        {!allMet && missingConditions.length > 0 && (
          <div className="text-[8px] text-slate-600 truncate mt-0.5">
            needs: {missingConditions.map(c => c.label).join(", ")}
          </div>
        )}
      </div>

      {/* Signal badge */}
      {signal && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${signalStyle.badge}`}>
          {signal}
        </span>
      )}
    </div>
  );
}

type Props = { categories: CategorySummary[] };

export default function SignalReadinessPanel({ categories }: Props) {
  const equities = categories
    .filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null)
    .map(cat => ({
      ...cat,
      signal: (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat),
      conditionsMet: buildConditions(cat).filter(c => c.met).length,
    }))
    .sort((a, b) => {
      // Sort by conditions met desc, then by score desc
      if (b.conditionsMet !== a.conditionsMet) return b.conditionsMet - a.conditionsMet;
      const so = (SIGNAL_ORDER[a.signal ?? "HOLD"] ?? 99) - (SIGNAL_ORDER[b.signal ?? "HOLD"] ?? 99);
      if (so !== 0) return so;
      return (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
    });

  if (equities.length === 0) return null;

  const buyCount = equities.filter(c => c.signal === "BUY").length;
  const watchCount = equities.filter(c => c.signal === "WATCH").length;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center justify-between gap-3 bg-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signal Readiness</span>
          <span className="text-[9px] text-slate-600">conditions met toward BUY: Score + RRG + Trend + Regime</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {buyCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-green-900/40 border border-green-700/40 text-green-400">
              {buyCount} BUY
            </span>
          )}
          {watchCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-900/30 border border-cyan-700/40 text-cyan-400">
              {watchCount} WATCH
            </span>
          )}
        </div>
      </div>

      <div className="px-2 py-2 space-y-0.5">
        {equities.map(cat => (
          <SectorRow key={cat.id} cat={cat} />
        ))}
      </div>

      <div className="px-4 py-2 border-t border-slate-700/30 text-[9px] text-slate-600 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> condition met
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-600 inline-block" /> condition missing
        </span>
        <span className="ml-auto">S=Score≥65 · R=RRG Improving+ · T=Trend+ · Regime=MacroFit≥60%</span>
      </div>
    </div>
  );
}
