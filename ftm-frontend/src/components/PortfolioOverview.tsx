import { RebalanceSuggestion } from "@/lib/api";

/**
 * At-a-glance portfolio header: total value, signal-alignment, cash vs invested split, and the
 * highest-conviction rebalance actions ("Do Now"). Pure/presentational — the page computes the
 * numbers and passes them in, so this stays trivially reusable and testable.
 */
type Props = {
  totalValueLabel: string;
  alignmentScore: number;
  alignmentLabel: "ALIGNED" | "PARTIAL" | "MISALIGNED";
  cashPct: number;
  investedPct: number;
  actions: RebalanceSuggestion[];
};

const ALIGNMENT_STYLE: Record<Props["alignmentLabel"], string> = {
  ALIGNED: "text-emerald-300 border-emerald-700/60 bg-emerald-900/20",
  PARTIAL: "text-amber-300 border-amber-700/60 bg-amber-900/20",
  MISALIGNED: "text-rose-300 border-rose-700/60 bg-rose-900/20",
};

function Stat({
  label,
  value,
  className = "text-slate-100",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${className}`}>{value}</span>
    </div>
  );
}

export default function PortfolioOverview({
  totalValueLabel,
  alignmentScore,
  alignmentLabel,
  cashPct,
  investedPct,
  actions,
}: Props) {
  return (
    <section
      data-testid="portfolio-overview"
      className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-4 mb-5"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Stat label="Total Value" value={totalValueLabel} />
        <Stat
          label="Alignment"
          value={`${alignmentLabel} · ${alignmentScore.toFixed(2)}`}
          className={`px-1.5 rounded border ${ALIGNMENT_STYLE[alignmentLabel]}`}
        />
        <Stat label="Invested" value={`${investedPct.toFixed(1)}%`} className="text-cyan-300" />
        <Stat label="Cash" value={`${cashPct.toFixed(1)}%`} className="text-slate-300" />
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700/50">
        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">
          Do Now
        </div>
        {actions.length === 0 ? (
          <span className="text-xs text-slate-500">
            Portfolio matches signal-optimal weights — no rebalance needed.
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2" data-testid="do-now-actions">
            {actions.map((a) => {
              const add = a.action === "INCREASE";
              const tone = add
                ? "border-emerald-700/60 bg-emerald-900/25 text-emerald-200"
                : "border-rose-700/60 bg-rose-900/25 text-rose-200";
              const sign = a.deltaPct > 0 ? "+" : "";
              return (
                <span
                  key={a.categoryId}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${tone}`}
                  title={`${a.categoryName}: current ${a.currentAllocationPct.toFixed(1)}% → optimal ${a.optimalAllocationPct.toFixed(1)}%${
                    a.tradeSignal ? ` · signal ${a.tradeSignal}` : ""
                  }`}
                >
                  <span className="font-semibold">
                    {add ? "▲ Add" : "▼ Trim"} {a.categoryName}
                  </span>
                  <span className="tabular-nums opacity-90">
                    {sign}
                    {a.deltaPct.toFixed(1)}%
                  </span>
                  {a.tradeSignal && (
                    <span
                      className={`text-[9px] px-1 rounded ${
                        a.signalAligned ? "bg-emerald-800/60 text-emerald-200" : "bg-slate-700/60 text-slate-300"
                      }`}
                    >
                      {a.tradeSignal}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
