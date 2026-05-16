import ComingSoonPage from "@/components/ComingSoonPage";

const MOCK_PORTFOLIO_ALLOCATIONS = [
  { categoryName: "Technology",        allocationPercent: 25, compositeScore: 0.82, alignmentStatus: "aligned"    },
  { categoryName: "Financial",         allocationPercent: 15, compositeScore: 0.71, alignmentStatus: "aligned"    },
  { categoryName: "Healthcare",        allocationPercent: 12, compositeScore: 0.59, alignmentStatus: "neutral"    },
  { categoryName: "Energy",            allocationPercent: 10, compositeScore: 0.68, alignmentStatus: "aligned"    },
  { categoryName: "Consumer Disc.",    allocationPercent: 10, compositeScore: 0.45, alignmentStatus: "neutral"    },
  { categoryName: "Industrials",       allocationPercent: 8,  compositeScore: 0.52, alignmentStatus: "neutral"    },
  { categoryName: "Real Estate",       allocationPercent: 5,  compositeScore: 0.21, alignmentStatus: "misaligned" },
  { categoryName: "Utilities",         allocationPercent: 5,  compositeScore: 0.18, alignmentStatus: "misaligned" },
  { categoryName: "Bonds (Long-Term)", allocationPercent: 5,  compositeScore: 0.31, alignmentStatus: "misaligned" },
  { categoryName: "Cash",              allocationPercent: 5,  compositeScore: 0.50, alignmentStatus: "neutral"    },
];

const OVERALL_ALIGNMENT_SCORE = 0.67;

export default function PortfolioPage() {
  return (
    <ComingSoonPage
      title="Portfolio"
      milestone="M5"
      description="Enter your allocation, get an alignment score, and receive rebalancing recommendations."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Overall Alignment Score</p>
            <p className="text-3xl font-bold text-yellow-400">{Math.round(OVERALL_ALIGNMENT_SCORE * 100)}</p>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 rounded-full"
                style={{ width: `${OVERALL_ALIGNMENT_SCORE * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Misaligned</span>
              <span>Neutral</span>
              <span>Aligned</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Current Allocation vs Composite Score</h3>
          <div className="space-y-2">
            {MOCK_PORTFOLIO_ALLOCATIONS.map((row) => {
              const statusColor = row.alignmentStatus === "aligned" ? "text-emerald-400"
                               : row.alignmentStatus === "misaligned" ? "text-red-400" : "text-zinc-400";
              return (
                <div key={row.categoryName} className="flex items-center gap-3 bg-zinc-800/40 border border-zinc-700/50 rounded-md px-3 py-2">
                  <span className="w-36 text-sm text-zinc-300 shrink-0">{row.categoryName}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${row.allocationPercent * 2}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-8 text-right font-mono">{row.allocationPercent}%</span>
                  </div>
                  <span className={`text-xs font-mono w-12 text-right shrink-0 ${statusColor}`}>
                    {Math.round(row.compositeScore * 100)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-600">
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-zinc-400 inline-block rounded" /> Allocation %</span>
            <span className="flex items-center gap-1">Score = composite 0–100</span>
          </div>
        </div>
      </div>
    </ComingSoonPage>
  );
}
