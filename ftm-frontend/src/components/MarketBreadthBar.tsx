import { CategorySummary } from "@/lib/api";

function scoreColor(score: number | null): string {
  if (score == null) return "bg-slate-600";
  if (score >= 0.7) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number | null): string {
  if (score == null) return "text-slate-500";
  if (score >= 0.7) return "text-emerald-400";
  if (score >= 0.4) return "text-amber-400";
  return "text-red-400";
}

export default function MarketBreadthBar({ categories }: { categories: CategorySummary[] }) {
  const equities = categories
    .filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (equities.length === 0) return null;

  const bullish  = equities.filter(c => (c.compositeScore ?? 0) >= 0.7);
  const moderate = equities.filter(c => { const s = c.compositeScore ?? 0; return s >= 0.4 && s < 0.7; });
  const bearish  = equities.filter(c => (c.compositeScore ?? 0) < 0.4);

  const total = equities.length;
  const bullPct  = Math.round((bullish.length  / total) * 100);
  const modPct   = Math.round((moderate.length / total) * 100);
  const bearPct  = Math.round((bearish.length  / total) * 100);

  const overallSignal =
    bullish.length > bearish.length + moderate.length ? "Risk-On" :
    bearish.length > bullish.length + moderate.length ? "Risk-Off" :
    "Mixed";

  const signalColor =
    bullish.length > bearish.length + moderate.length ? "text-emerald-400" :
    bearish.length > bullish.length + moderate.length ? "text-red-400" :
    "text-amber-400";

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Market Breadth</span>
          <span className="text-xs text-slate-600">equity sectors</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">{bullish.length} ↑ · {moderate.length} → · {bearish.length} ↓</span>
          <span className={`font-semibold ${signalColor}`}>{overallSignal}</span>
        </div>
      </div>

      {/* Segmented breadth bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {bullish.length > 0  && <div className="bg-emerald-500"  style={{ flex: bullish.length }}  title={`${bullish.length} bullish (score ≥70)`} />}
        {moderate.length > 0 && <div className="bg-amber-500/80" style={{ flex: moderate.length }} title={`${moderate.length} moderate (score 40–69)`} />}
        {bearish.length > 0  && <div className="bg-red-500/80"   style={{ flex: bearish.length }}  title={`${bearish.length} bearish (score <40)`} />}
      </div>

      {/* Individual sector dots + tickers */}
      <div className="flex items-center gap-2 flex-wrap">
        {equities.map((cat) => {
          const pct = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
          const dot = scoreColor(cat.compositeScore);
          const label = scoreTextColor(cat.compositeScore);
          return (
            <div
              key={cat.id}
              className="flex items-center gap-1 group cursor-default"
              title={`${cat.name} (${cat.etfTicker}): score ${pct ?? "—"}/100`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <span className={`text-[10px] font-mono ${label} leading-none`}>{cat.etfTicker}</span>
              {pct != null && (
                <span className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors leading-none">{pct}</span>
              )}
            </div>
          );
        })}
        <span className="ml-auto text-[10px] text-slate-700">≥70 · 40–69 · &lt;40</span>
      </div>
    </div>
  );
}
