import ComingSoonPage from "@/components/ComingSoonPage";

const MOCK_FLOW_DATA = [
  { categoryName: "Technology",        flowZScore: 2.4,  flowMillionUsd:  830, trend: "inflow"  },
  { categoryName: "Financial",         flowZScore: 1.8,  flowMillionUsd:  540, trend: "inflow"  },
  { categoryName: "Energy",            flowZScore: 1.2,  flowMillionUsd:  290, trend: "inflow"  },
  { categoryName: "Healthcare",        flowZScore: 0.6,  flowMillionUsd:  120, trend: "inflow"  },
  { categoryName: "Real Estate",       flowZScore: -0.3, flowMillionUsd: -60,  trend: "outflow" },
  { categoryName: "Utilities",         flowZScore: -1.1, flowMillionUsd: -220, trend: "outflow" },
  { categoryName: "Consumer Staples",  flowZScore: -1.9, flowMillionUsd: -410, trend: "outflow" },
  { categoryName: "Bonds (Long-Term)", flowZScore: -2.6, flowMillionUsd: -670, trend: "outflow" },
];

export default function CapitalFlowsPage() {
  return (
    <ComingSoonPage
      title="Capital Flows"
      milestone="M4"
      description="Flow z-scores and ranked inflow / outflow leaders for all 19 categories."
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 px-3 mb-3">
          <span>Category</span>
          <span>Flow z-score / 20-day flow (USD)</span>
        </div>
        {MOCK_FLOW_DATA.map((row) => {
          const barWidth = Math.min(Math.abs(row.flowZScore) / 3, 1) * 100;
          const isInflow = row.trend === "inflow";
          return (
            <div key={row.categoryName} className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-md px-3 py-2">
              <span className="w-40 text-sm text-slate-300 shrink-0">{row.categoryName}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isInflow ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`text-xs w-12 text-right font-mono ${isInflow ? "text-emerald-400" : "text-red-400"}`}>
                  {isInflow ? "+" : ""}{row.flowZScore.toFixed(1)}σ
                </span>
              </div>
              <span className={`text-xs w-20 text-right font-mono shrink-0 ${isInflow ? "text-emerald-400/70" : "text-red-400/70"}`}>
                {isInflow ? "+" : ""}{row.flowMillionUsd}M
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-2 text-xs text-slate-600">
          <div className="w-3 h-1 bg-slate-600 rounded" />
          <span>±1.5σ threshold for alerts</span>
        </div>
      </div>
    </ComingSoonPage>
  );
}
