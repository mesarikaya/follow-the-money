import { Fragment } from "react";
import { CategorySummary } from "@/lib/api";

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  EQUITY_SECTOR:  { label: "Equity",         className: "bg-blue-900/50 text-blue-300 border border-blue-800/40" },
  FIXED_INCOME:   { label: "Fixed Income",   className: "bg-purple-900/50 text-purple-300 border border-purple-800/40" },
  PRECIOUS_METAL: { label: "Precious Metal", className: "bg-yellow-900/50 text-yellow-300 border border-yellow-800/40" },
  CURRENCY:       { label: "Currency",       className: "bg-emerald-900/50 text-emerald-300 border border-emerald-800/40" },
  CASH:           { label: "Cash",           className: "bg-slate-700 text-slate-300 border border-slate-600" },
  ALTERNATIVE:    { label: "Alternative",    className: "bg-slate-700 text-slate-300 border border-slate-600" },
};

const TYPE_SECTION_LABELS: Record<string, string> = {
  PRECIOUS_METAL: "Precious Metals",
  FIXED_INCOME:   "Fixed Income",
  CASH:           "Cash",
};

const RRG_QUADRANT_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "↗ Leading",   color: "text-green-400" },
  2: { label: "↖ Improving", color: "text-blue-400"  },
  3: { label: "↘ Weakening", color: "text-orange-400" },
  4: { label: "↙ Lagging",   color: "text-slate-400"  },
};

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const filledCount = Math.round(score * 5);
  const barColor = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div
      className="flex items-center gap-1.5"
      title={`Composite signal score: ${pct}/100. Combines RS-60, momentum, and macro-regime alignment.`}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-3.5 rounded-[2px] ${i < filledCount ? barColor : "bg-slate-700"}`}
          />
        ))}
      </div>
      <span className={`text-xs tabular-nums font-medium ${score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
        {pct}
      </span>
    </div>
  );
}

function RsCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  return (
    <span className={`tabular-nums ${color}`} title="60-day relative strength vs benchmark. Positive = outperforming.">
      {value > 0 ? "+" : ""}{pct}%
    </span>
  );
}

export default function CategoryTable({ categories }: { categories: CategorySummary[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 w-8">#</th>
            <th className="px-4 py-3">ETF</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right" title="Latest closing price">Close</th>
            <th className="px-4 py-3 text-center" title="Composite signal score: 0-100 bar. Combines RS-60, momentum, and macro-regime alignment.">Score</th>
            <th className="px-4 py-3 text-right" title="60-day relative strength vs benchmark">vs Benchmark (60d)</th>
            <th className="px-4 py-3 text-center" title="Relative Rotation Graph quadrant based on RS ratio and momentum">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {categories.map((cat, idx) => {
            const typeConfig = TYPE_CONFIG[cat.type] ?? TYPE_CONFIG.ALTERNATIVE;
            const quadrantInfo = cat.rrgQuadrant != null ? RRG_QUADRANT_LABELS[Number(cat.rrgQuadrant)] : null;
            const prevType = idx > 0 ? categories[idx - 1].type : null;
            const showDivider = prevType !== cat.type && TYPE_SECTION_LABELS[cat.type] != null;

            return (
              <Fragment key={cat.id}>
                {showDivider && (
                  <tr>
                    <td colSpan={8} className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-900/60 uppercase tracking-widest border-t border-slate-700/60">
                      {TYPE_SECTION_LABELS[cat.type]}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-slate-800/50 transition-colors text-slate-200">
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums text-xs">{cat.rank}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-300 font-medium">{cat.etfTicker}</td>
                  <td className="px-4 py-2.5 font-medium">{cat.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeConfig.className}`}>
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                    {cat.latestClose != null ? `$${Number(cat.latestClose).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-center">
                      <ScoreBar score={cat.compositeScore} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RsCell value={cat.rs60} />
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {quadrantInfo ? (
                      <span className={quadrantInfo.color}>{quadrantInfo.label}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2.5 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-500 bg-slate-800/40 flex-wrap">
        {(["EQUITY_SECTOR", "PRECIOUS_METAL", "FIXED_INCOME", "CASH"] as const).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_CONFIG[type].className}`}>
              {TYPE_CONFIG[type].label}
            </span>
          </span>
        ))}
        <span className="ml-auto" title="Score bars: 5 cells = 0-100 composite signal score">
          Score: ██████ = strong · ███ = moderate · █ = weak
        </span>
      </div>
    </div>
  );
}
