import { CategorySummary } from "@/lib/api";

type ExtremeEntry = {
  id: string;
  name: string;
  etfTicker: string;
  score: number;
  delta: number; // distance from extreme as fraction (0 = exactly at extreme)
  persistence20d: number | null;
  flow20d: number | null;
  rsAlignedBull: boolean;
  rsAlignedBear: boolean;
};

function PersistencePip({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round((value / 20) * 100);
  const cls =
    pct >= 60 ? "bg-emerald-500 text-emerald-300" :
    pct >= 40 ? "bg-slate-500 text-slate-400" :
    "bg-red-500 text-red-400";
  return (
    <span
      className={`text-[8px] tabular-nums font-mono px-1 py-0.5 rounded ${cls} bg-opacity-20`}
      title={`Persistence: ${value}/20 days outperformed benchmark (${pct}%)`}
    >
      P{value}
    </span>
  );
}

export default function ScoreExtremesPanel({
  categories,
  scoreHistory,
}: {
  categories: CategorySummary[];
  scoreHistory: Record<string, number[]>;
}) {
  const atHighs: ExtremeEntry[] = [];
  const atLows: ExtremeEntry[] = [];

  for (const cat of categories) {
    if (cat.compositeScore == null) continue;
    const history = scoreHistory[cat.id];
    if (!history || history.length < 5) continue;

    const max30d = Math.max(...history);
    const min30d = Math.min(...history);
    const range = max30d - min30d;
    if (range < 0.05) continue; // too flat to be meaningful

    const current = cat.compositeScore;
    const fromHigh = (max30d - current) / range;
    const fromLow = (current - min30d) / range;

    const persistence20d = cat.persistence20d ?? null;
    const flow20d = cat.flow20d ?? null;
    const rs20 = cat.rs20 ?? null;
    const rs60 = cat.rs60 ?? null;
    const rs120 = cat.rs120 ?? null;
    const rsAlignedBull = rs20 != null && rs60 != null && rs120 != null && rs20 > rs60 && rs60 > rs120;
    const rsAlignedBear = rs20 != null && rs60 != null && rs120 != null && rs20 < rs60 && rs60 < rs120;
    if (fromHigh <= 0.08) {
      atHighs.push({ id: cat.id, name: cat.name, etfTicker: cat.etfTicker, score: current, delta: fromHigh, persistence20d, flow20d, rsAlignedBull, rsAlignedBear });
    } else if (fromLow <= 0.08) {
      atLows.push({ id: cat.id, name: cat.name, etfTicker: cat.etfTicker, score: current, delta: fromLow, persistence20d, flow20d, rsAlignedBull, rsAlignedBear });
    }
  }

  if (atHighs.length === 0 && atLows.length === 0) return null;

  atHighs.sort((a, b) => a.delta - b.delta);
  atLows.sort((a, b) => a.delta - b.delta);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-800/40 border border-green-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            30d Score High
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">near 30-day peak</span>
        </div>
        {atHighs.length === 0 ? (
          <p className="text-[11px] text-slate-600 py-2">None near 30d high</p>
        ) : (
          atHighs.map((entry, i) => {
            const isFragile = entry.persistence20d != null && entry.persistence20d < 8;
            const flowDistrib = entry.flow20d != null && entry.flow20d <= -0.8;
            const flowConfirm = entry.flow20d != null && entry.flow20d >= 1.5;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-2 py-1.5 ${i < atHighs.length - 1 ? "border-b border-slate-700/40" : ""}`}
              >
                <span className="font-mono text-xs text-blue-300 w-9 shrink-0">{entry.etfTicker}</span>
                <span className="flex-1 text-xs text-slate-300 truncate">{entry.name}</span>
                {flowDistrib && (
                  <span
                    className="text-[8px] text-rose-400 border border-rose-700/50 px-1 py-0.5 rounded shrink-0"
                    title={`Distribution signal: score at 30d high but institutional outflows (flow z=${entry.flow20d?.toFixed(1)}σ) — smart money reducing exposure`}
                  >
                    ⬇ Distrib
                  </span>
                )}
                {flowConfirm && (
                  <span
                    className="text-[8px] text-teal-400 border border-teal-700/50 px-1 py-0.5 rounded shrink-0"
                    title={`Flow confirmed: score at 30d high with strong institutional inflows (flow z=+${entry.flow20d?.toFixed(1)}σ) — trend may extend`}
                  >
                    ⬆ Confirmed
                  </span>
                )}
                {!flowDistrib && !flowConfirm && isFragile && (
                  <span className="text-[8px] text-amber-400 border border-amber-700/50 px-1 py-0.5 rounded shrink-0" title="Fragile leadership: score at 30d high but persistence is low — momentum may not be sustainable">
                    ⚠ Fragile
                  </span>
                )}
                {entry.rsAlignedBull && (
                  <span className="text-[8px] text-emerald-400 font-semibold shrink-0" title="RS-20 > RS-60 > RS-120: all-horizon momentum aligned bullish">⊕</span>
                )}
                <PersistencePip value={entry.persistence20d} />
                <span className="text-xs tabular-nums text-green-400 shrink-0">
                  {Math.round(entry.score * 100)}
                </span>
                {entry.delta === 0 ? (
                  <span className="text-[9px] text-green-500 font-semibold shrink-0">▲ HIGH</span>
                ) : (
                  <span className="text-[9px] text-slate-500 shrink-0">≈ high</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="bg-slate-800/40 border border-red-800/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            30d Score Low
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">near 30-day trough</span>
        </div>
        {atLows.length === 0 ? (
          <p className="text-[11px] text-slate-600 py-2">None near 30d low</p>
        ) : (
          atLows.map((entry, i) => {
            const isRecovering = entry.persistence20d != null && entry.persistence20d >= 8;
            const flowAccum = entry.flow20d != null && entry.flow20d >= 1.5;
            const flowConfirmsBear = entry.flow20d != null && entry.flow20d <= -0.8;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-2 py-1.5 ${i < atLows.length - 1 ? "border-b border-slate-700/40" : ""}`}
              >
                <span className="font-mono text-xs text-blue-300 w-9 shrink-0">{entry.etfTicker}</span>
                <span className="flex-1 text-xs text-slate-300 truncate">{entry.name}</span>
                {flowAccum && (
                  <span
                    className="text-[8px] text-teal-400 border border-teal-700/50 px-1 py-0.5 rounded shrink-0"
                    title={`Accumulation signal: score at 30d low but institutional inflows surging (flow z=+${entry.flow20d?.toFixed(1)}σ) — smart money buying the dip`}
                  >
                    ⬆ Accum
                  </span>
                )}
                {flowConfirmsBear && (
                  <span
                    className="text-[8px] text-rose-400 border border-rose-700/50 px-1 py-0.5 rounded shrink-0"
                    title={`Confirmed weakness: score at 30d low with institutional outflows (flow z=${entry.flow20d?.toFixed(1)}σ) — distribution ongoing`}
                  >
                    ⬇ Distrib
                  </span>
                )}
                {!flowAccum && !flowConfirmsBear && isRecovering && (
                  <span className="text-[8px] text-cyan-400 border border-cyan-700/50 px-1 py-0.5 rounded shrink-0" title="Score at 30d low but persistence is still healthy — potential divergence, watch for reversal">
                    ↑ Diverging
                  </span>
                )}
                {entry.rsAlignedBear && (
                  <span className="text-[8px] text-red-400 font-semibold shrink-0" title="RS-20 < RS-60 < RS-120: all-horizon momentum aligned bearish">⊖</span>
                )}
                <PersistencePip value={entry.persistence20d} />
                <span className="text-xs tabular-nums text-red-400 shrink-0">
                  {Math.round(entry.score * 100)}
                </span>
                {entry.delta === 0 ? (
                  <span className="text-[9px] text-red-500 font-semibold shrink-0">▼ LOW</span>
                ) : (
                  <span className="text-[9px] text-slate-500 shrink-0">≈ low</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
