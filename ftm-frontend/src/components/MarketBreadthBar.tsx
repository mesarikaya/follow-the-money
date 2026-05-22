import Link from "next/link";
import { CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

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

  const rsAccelCount   = equities.filter(c => c.rs60 != null && c.rs120 != null && c.rs60 > c.rs120 + 0.001).length;
  const rsDeccelCount  = equities.filter(c => c.rs60 != null && c.rs120 != null && c.rs60 < c.rs120 - 0.001).length;
  const rsNeutralCount = equities.filter(c => c.rs60 != null && c.rs120 != null).length - rsAccelCount - rsDeccelCount;
  const hasRsAccelData = equities.some(c => c.rs60 != null && c.rs120 != null);

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

      {/* Segmented breadth bar — composite score */}
      <div className="space-y-1">
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
          {bullish.length > 0  && <div className="bg-emerald-500"  style={{ flex: bullish.length }}  title={`${bullish.length} bullish (score ≥70)`} />}
          {moderate.length > 0 && <div className="bg-amber-500/80" style={{ flex: moderate.length }} title={`${moderate.length} moderate (score 40–69)`} />}
          {bearish.length > 0  && <div className="bg-red-500/80"   style={{ flex: bearish.length }}  title={`${bearish.length} bearish (score <40)`} />}
        </div>
        {hasRsAccelData && (rsAccelCount + rsDeccelCount + rsNeutralCount) > 0 && (
          <div className="flex h-1 rounded-full overflow-hidden gap-px" title="RS Momentum Breadth: sectors where RS-60 is accelerating vs RS-120">
            {rsAccelCount > 0  && <div className="bg-emerald-400/60" style={{ flex: rsAccelCount }}  title={`${rsAccelCount} RS accelerating (rs60>rs120)`} />}
            {rsNeutralCount > 0 && <div className="bg-slate-600/50"  style={{ flex: rsNeutralCount }} title={`${rsNeutralCount} RS neutral`} />}
            {rsDeccelCount > 0 && <div className="bg-red-400/60"     style={{ flex: rsDeccelCount }}  title={`${rsDeccelCount} RS decelerating (rs60<rs120)`} />}
          </div>
        )}
      </div>

      {/* Individual sector dots + tickers */}
      <div className="flex items-center gap-2 flex-wrap">
        {equities.map((cat) => {
          const pct = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
          const dot = scoreColor(cat.compositeScore);
          const label = scoreTextColor(cat.compositeScore);
          const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(cat.id);
          const accel = cat.rs60 != null && cat.rs120 != null ? cat.rs60 - cat.rs120 : null;
          const accelArrow = accel != null && accel > 0.001 ? "↗" : accel != null && accel < -0.001 ? "↘" : null;
          return hasDrilldown ? (
            <Link
              key={cat.id}
              href={`/sectors/${cat.id}`}
              className="flex items-center gap-1 group hover:opacity-80 transition-opacity"
              title={`${cat.name} (${cat.etfTicker}): score ${pct ?? "—"}/100${accel != null ? ` · RS accel: ${accel > 0 ? "+" : ""}${(accel * 100).toFixed(1)}pts` : ""}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <span className={`text-[10px] font-mono ${label} leading-none`}>{cat.etfTicker}</span>
              {pct != null && (
                <span className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors leading-none">{pct}</span>
              )}
              {accelArrow && <span className={`text-[8px] leading-none ${accel! > 0 ? "text-emerald-500/70" : "text-red-500/70"}`}>{accelArrow}</span>}
            </Link>
          ) : (
            <div
              key={cat.id}
              className="flex items-center gap-1 group cursor-default"
              title={`${cat.name} (${cat.etfTicker}): score ${pct ?? "—"}/100`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <span className={`text-[10px] font-mono ${label} leading-none`}>{cat.etfTicker}</span>
              {pct != null && (
                <span className="text-[9px] text-slate-600 leading-none">{pct}</span>
              )}
            </div>
          );
        })}
        <span className="ml-auto text-[10px] text-slate-700">score ≥70·40·&lt;40 / RS↗↘</span>
      </div>
    </div>
  );
}
