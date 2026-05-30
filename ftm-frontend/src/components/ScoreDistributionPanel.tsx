import { CategorySummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

const SIGNAL_COLOR: Record<TradeSignal, string> = {
  BUY:    "bg-green-500",
  WATCH:  "bg-cyan-500",
  HOLD:   "bg-slate-500",
  REDUCE: "bg-red-500",
};

const BUCKET_LABELS = ["0–19", "20–39", "40–59", "60–79", "80–100"];
const BUCKET_COLOR = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-emerald-500",
  "bg-green-400",
];

type BucketEntry = { ticker: string; score: number; signal: TradeSignal | null };

type Props = { categories: CategorySummary[] };

export default function ScoreDistributionPanel({ categories }: Props) {
  const equities = categories.filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null);
  if (equities.length < 3) return null;

  const buckets: BucketEntry[][] = [[], [], [], [], []];
  for (const cat of equities) {
    const score = Math.round((cat.compositeScore ?? 0) * 100);
    const idx = Math.min(Math.floor(score / 20), 4);
    const signal = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
    buckets[idx].push({ ticker: cat.etfTicker, score, signal });
  }

  const maxCount = Math.max(...buckets.map(b => b.length), 1);
  const avgScore = Math.round(equities.reduce((s, c) => s + (c.compositeScore ?? 0), 0) / equities.length * 100);
  const bullishCount = equities.filter(c => (c.compositeScore ?? 0) >= 0.6).length;
  const bearishCount = equities.filter(c => (c.compositeScore ?? 0) < 0.4).length;

  const marketBias =
    bullishCount > equities.length * 0.6 ? { label: "Risk-On", cls: "text-emerald-400" } :
    bearishCount > equities.length * 0.5 ? { label: "Risk-Off", cls: "text-red-400" } :
    { label: "Mixed", cls: "text-slate-400" };

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center justify-between gap-3 bg-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score Distribution</span>
          <span className="text-[9px] text-slate-600">equity sector composite scores 0–100</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[9px] text-slate-500">avg <span className="tabular-nums text-slate-300">{avgScore}</span></span>
          <span className={`text-[9px] font-medium ${marketBias.cls}`}>{marketBias.label}</span>
        </div>
      </div>

      <div className="px-4 py-3 flex items-end gap-2">
        {buckets.map((bucket, i) => {
          const barHeightPct = maxCount > 0 ? (bucket.length / maxCount) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Ticker chips above bar */}
              <div className="flex flex-col items-center gap-0.5 min-h-[40px] justify-end w-full">
                {bucket.map(entry => (
                  <div
                    key={entry.ticker}
                    className={`text-[8px] font-mono px-1 py-0.5 rounded ${entry.signal ? SIGNAL_COLOR[entry.signal] : "bg-slate-600"} text-white leading-none w-full text-center`}
                    title={`${entry.ticker}: score ${entry.score}/100${entry.signal ? ` · ${entry.signal}` : ""}`}
                  >
                    {entry.ticker}
                  </div>
                ))}
              </div>

              {/* Bar */}
              <div className="w-full flex flex-col justify-end" style={{ height: "48px" }}>
                <div
                  className={`w-full rounded-t transition-all ${BUCKET_COLOR[i]} opacity-60`}
                  style={{ height: `${Math.max(barHeightPct, bucket.length > 0 ? 8 : 0)}%` }}
                />
              </div>

              {/* Count */}
              <div className="text-[9px] tabular-nums text-slate-500">{bucket.length}</div>

              {/* Range label */}
              <div className="text-[8px] text-slate-600 whitespace-nowrap">{BUCKET_LABELS[i]}</div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-1.5 border-t border-slate-700/30 text-[9px] text-slate-600 flex items-center gap-4 flex-wrap">
        <span>{bearishCount} below 40 · {bullishCount} above 60</span>
        <span className="ml-auto flex items-center gap-3">
          {(["BUY", "WATCH", "HOLD", "REDUCE"] as TradeSignal[]).map(sig => (
            <span key={sig} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${SIGNAL_COLOR[sig]} inline-block`} />
              <span>{sig}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
