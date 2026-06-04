import Link from "next/link";
import { CategorySummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

function TrendChip({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive: boolean;
}) {
  const pts = Math.round(value * 100);
  const bg = positive ? "bg-emerald-900/30 border-emerald-700/50" : "bg-red-900/30 border-red-700/50";
  const text = positive ? "text-emerald-400" : "text-red-400";
  const arrow = positive ? "↑" : "↓";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold tabular-nums ${bg} ${text}`}
      title={`${label} composite score change: ${pts > 0 ? "+" : ""}${pts} pts`}
    >
      <span className="text-[8px] text-current opacity-60">{label}</span>
      {arrow}{Math.abs(pts)}
    </span>
  );
}

function RsConfirmBadge({ rs20, rs60, rs120, trendPositive }: { rs20: number | null; rs60: number | null; rs120: number | null; trendPositive: boolean }) {
  if (rs60 == null || rs120 == null) return null;
  const rsAccel = rs60 - rs120;
  const rsAccelPositive = rsAccel > 0.001;
  const rsAccelNegative = rsAccel < -0.001;

  // Check full RS-20 all-aligned (overrides the 2-horizon badge)
  const allAlignedBull = rs20 != null && rs60 != null && rs120 != null && rs20 > rs60 && rs60 > rs120;
  const allAlignedBear = rs20 != null && rs60 != null && rs120 != null && rs20 < rs60 && rs60 < rs120;

  if (allAlignedBull) {
    return (
      <span
        className="text-[9px] px-1 py-0.5 rounded tabular-nums font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700/40"
        title="RS-20 > RS-60 > RS-120: all three horizons aligned bullish — momentum conviction at maximum"
      >
        ⊕RS
      </span>
    );
  }
  if (allAlignedBear) {
    return (
      <span
        className="text-[9px] px-1 py-0.5 rounded tabular-nums font-semibold bg-red-900/50 text-red-300 border border-red-700/40"
        title="RS-20 < RS-60 < RS-120: all three horizons aligned bearish — momentum deteriorating on every timeframe"
      >
        ⊖RS
      </span>
    );
  }

  if (!rsAccelPositive && !rsAccelNegative) return null;
  const confirms = (trendPositive && rsAccelPositive) || (!trendPositive && rsAccelNegative);
  const ptsAbs = Math.round(Math.abs(rsAccel) * 100);

  return (
    <span
      className={`text-[9px] px-1 py-0.5 rounded tabular-nums font-semibold ${confirms ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/30" : "bg-amber-900/40 text-amber-400 border border-amber-700/30"}`}
      title={`RS acceleration (60d vs 120d): ${rsAccelPositive ? "+" : ""}${Math.round(rsAccel * 100)} pts. ${confirms ? "Confirms" : "Diverges from"} score trend.`}
    >
      {rsAccelPositive ? "↗" : "↘"}RS{ptsAbs > 0 ? ptsAbs : ""}
    </span>
  );
}

function MomentumRow({ cat, isLast }: { cat: CategorySummary; isLast: boolean }) {
  const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
  const barColor =
    cat.compositeScore == null
      ? "bg-slate-700"
      : cat.compositeScore >= 0.7
        ? "bg-emerald-500"
        : cat.compositeScore >= 0.4
          ? "bg-amber-500"
          : "bg-red-500";

  const t20 = cat.compositeTrend20d;
  const t10 = cat.compositeTrend10d;
  const t5 = cat.compositeTrend5d;
  const trendPositive = (t20 ?? 0) >= 0;
  const tripleConfirmed = t5 != null && t10 != null && t20 != null &&
    (trendPositive ? (t5 > 0 && t10 > 0 && t20 > 0) : (t5 < 0 && t10 < 0 && t20 < 0));
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(cat.id);

  return (
    <div
      className={`flex items-center gap-3 py-2 ${!isLast ? "border-b border-slate-700/50" : ""}`}
    >
      {hasDrilldown ? (
        <Link href={`/sectors/${cat.id}`} className="font-mono text-xs text-blue-300 hover:text-cyan-300 transition-colors w-9 shrink-0">
          {cat.etfTicker}
        </Link>
      ) : (
        <span className="font-mono text-xs text-blue-300 w-9 shrink-0">{cat.etfTicker}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-1.5 rounded-full overflow-hidden bg-slate-700 flex-1 max-w-[64px]">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${score ?? 0}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-slate-500">{score ?? "—"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {t5 != null && Math.abs(Math.round(t5 * 100)) >= 1 && (
          <TrendChip label="5d" value={t5} positive={t5 >= 0} />
        )}
        {t20 != null && Math.abs(Math.round(t20 * 100)) >= 2 && (
          <TrendChip label="20d" value={t20} positive={t20 >= 0} />
        )}
        <RsConfirmBadge rs20={cat.rs20 ?? null} rs60={cat.rs60 ?? null} rs120={cat.rs120 ?? null} trendPositive={trendPositive} />
        {tripleConfirmed && (
          <span
            className={`text-[9px] font-bold px-1 py-0.5 rounded ${trendPositive ? "text-emerald-300 bg-emerald-900/50 border border-emerald-700/50" : "text-red-300 bg-red-900/50 border border-red-700/50"}`}
            title="5d, 10d, and 20d trends all agree — high momentum conviction"
          >
            ●●●
          </span>
        )}
      </div>
    </div>
  );
}

export default function MomentumLeadersPanel({ categories }: { categories: CategorySummary[] }) {
  const withTrend = categories.filter(
    (c) => c.compositeTrend20d != null && c.type === "EQUITY_SECTOR",
  );
  if (withTrend.length === 0) return null;

  const sorted = [...withTrend].sort(
    (a, b) => (b.compositeTrend20d ?? 0) - (a.compositeTrend20d ?? 0),
  );

  const leaders = sorted.slice(0, 3);
  const laggards = sorted.slice(-3).reverse();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-800/40 border border-emerald-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Accelerating
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">20d score gain</span>
        </div>
        {leaders.map((cat, i) => (
          <MomentumRow key={cat.id} cat={cat} isLast={i === leaders.length - 1} />
        ))}
      </div>

      <div className="bg-slate-800/40 border border-red-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Decelerating
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">20d score loss</span>
        </div>
        {laggards.map((cat, i) => (
          <MomentumRow key={cat.id} cat={cat} isLast={i === laggards.length - 1} />
        ))}
      </div>
    </div>
  );
}
