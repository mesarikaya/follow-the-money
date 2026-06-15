import { ApproachingSignalDto } from "@/lib/api";

const CONFIDENCE_CONFIG = {
  HIGH:   { cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", dot: "bg-emerald-400" },
  MEDIUM: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",       dot: "bg-amber-400"   },
  LOW:    { cls: "bg-slate-700/40 text-slate-400 border-slate-600/30",       dot: "bg-slate-500"   },
} as const;

const SIGNAL_COLOR: Record<string, string> = {
  BUY:    "text-emerald-400",
  WATCH:  "text-cyan-400",
  HOLD:   "text-slate-400",
  REDUCE: "text-red-400",
};

const ARROW: Record<string, string> = {
  BUY:    "→ BUY",
  WATCH:  "→ WATCH",
  REDUCE: "→ REDUCE",
};

function ScoreGapBar({ currentScore, projectedSignal }: { currentScore: number; projectedSignal: string }) {
  const fallingToReduce = projectedSignal === "REDUCE";
  const threshold = projectedSignal === "BUY" ? 0.65 : projectedSignal === "WATCH" ? 0.50 : 0.35;

  // For falling-to-REDUCE: bar shows how much of the danger zone has been consumed (score dropping toward threshold).
  // A full bar = score has reached threshold = sell signal triggered.
  // For rising signals: bar shows progress toward the next threshold.
  const pct = fallingToReduce
    ? Math.min(((1 - currentScore) / (1 - threshold)) * 100, 100)
    : Math.min((currentScore / threshold) * 100, 100);

  const color =
    projectedSignal === "BUY"    ? "bg-emerald-500/60" :
    projectedSignal === "REDUCE" ? "bg-red-500/60" :
    "bg-cyan-500/60";

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div
        className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden"
        title={`Score ${Math.round(currentScore * 100)} → ${fallingToReduce ? "sell" : "buy"} threshold at ${Math.round(threshold * 100)}`}
      >
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono tabular-nums text-slate-600 shrink-0">
        {Math.round(currentScore * 100)}→{Math.round(threshold * 100)}
      </span>
    </div>
  );
}

function ApproachingRow({ signal }: { signal: ApproachingSignalDto }) {
  const conf = CONFIDENCE_CONFIG[signal.confidence];
  const projColor = SIGNAL_COLOR[signal.projectedSignal] ?? "text-slate-400";
  const projArrow = ARROW[signal.projectedSignal] ?? `→ ${signal.projectedSignal}`;
  const rising = signal.dailyVelocity > 0;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0 group">
      {/* Days countdown */}
      <div
        className={`shrink-0 min-w-[44px] text-center px-2 py-1 rounded border text-[11px] font-bold font-mono tabular-nums ${conf.cls}`}
        title={`Confidence: ${signal.confidence} — momentum continues at ${(signal.dailyVelocity * 100).toFixed(2)}pt/day`}
      >
        {signal.estimatedDays}d
      </div>

      {/* ETF + name */}
      <div className="flex flex-col min-w-0 shrink-0 w-24">
        <span className="text-[11px] font-mono font-semibold text-slate-200">{signal.etfTicker}</span>
        <span className="text-[10px] text-slate-500 truncate">{signal.categoryName}</span>
      </div>

      {/* Signal transition */}
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-[10px] font-bold ${SIGNAL_COLOR[signal.currentSignal] ?? "text-slate-500"}`}>
          {signal.currentSignal}
        </span>
        <span className={`text-[10px] font-bold ${projColor}`}>{projArrow}</span>
      </div>

      {/* Score-to-threshold bar */}
      <ScoreGapBar currentScore={signal.currentScore} projectedSignal={signal.projectedSignal} />

      {/* Velocity */}
      <span
        className={`shrink-0 text-[9px] font-mono tabular-nums ${rising ? "text-emerald-500" : "text-red-500"}`}
        title={`Daily momentum: ${rising ? "+" : ""}${(signal.dailyVelocity * 100).toFixed(2)}pt/day`}
      >
        {rising ? "+" : ""}{(signal.dailyVelocity * 100).toFixed(2)}
      </span>
    </div>
  );
}

type Props = {
  signals: ApproachingSignalDto[];
};

export default function ApproachingSignalsPanel({ signals }: Props) {
  if (signals.length === 0) return null;

  const highCount = signals.filter(s => s.confidence === "HIGH").length;
  const approachingBuy = signals.filter(s => s.projectedSignal === "BUY").length;
  const approachingReduce = signals.filter(s => s.projectedSignal === "REDUCE").length;

  return (
    <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2
            className="text-sm font-semibold text-slate-200"
            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
          >
            Approaching Signals
          </h2>
          <span
            className="text-[10px] text-slate-600 cursor-help"
            title="Momentum-velocity projections: how many trading days until each category crosses the next signal threshold at its current 5-day momentum rate. HIGH confidence = ≤7 days. Assumes momentum continues unchanged."
          >(?)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {highCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              {highCount} HIGH
            </span>
          )}
          {approachingBuy > 0 && (
            <span className="text-emerald-500/70">↑{approachingBuy} BUY</span>
          )}
          {approachingReduce > 0 && (
            <span className="text-red-500/70">↓{approachingReduce} REDUCE</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-[9px] text-slate-600">
        <span>Days · ETF / Sector · Signal transition · Score bar · Velocity (pt/day)</span>
      </div>

      <div>
        {signals.map(s => (
          <ApproachingRow key={s.categoryId} signal={s} />
        ))}
      </div>
    </section>
  );
}
