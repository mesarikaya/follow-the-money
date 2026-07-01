import { ThemeSnapshot } from "@/lib/api";

type Props = {
  snapshot: ThemeSnapshot;
};

type SignalPill = {
  label: string;
  count: number;
  color: string;
  bg: string;
};

function signalPill(label: string, count: number, color: string, bg: string): SignalPill {
  return { label, count, color, bg };
}

function phaseBar(snapshot: ThemeSnapshot): { phase: string; count: number; color: string }[] {
  return [
    { phase: "Breakout", count: snapshot.breakoutCount, color: "bg-emerald-500" },
    { phase: "Momentum", count: snapshot.momentumCount, color: "bg-sky-500" },
    { phase: "Building", count: snapshot.buildingCount, color: "bg-amber-500" },
    { phase: "Fading", count: snapshot.fadingCount, color: "bg-orange-500" },
    { phase: "Weak", count: snapshot.weakCount, color: "bg-red-600" },
  ].filter(p => p.count > 0);
}

function marketSentimentLabel(snapshot: ThemeSnapshot): { label: string; color: string } {
  const bullish = snapshot.buyCount + snapshot.watchCount;
  const bearish = snapshot.holdCount + snapshot.reduceCount;
  const ratio = snapshot.totalThemes > 0 ? bullish / snapshot.totalThemes : 0;
  if (ratio >= 0.6) return { label: "Risk-On", color: "text-emerald-400" };
  if (ratio >= 0.4) return { label: "Mixed", color: "text-amber-400" };
  return { label: "Risk-Off", color: "text-red-400" };
}

export default function ThemeMarketSnapshot({ snapshot }: Props) {
  const pills: SignalPill[] = [
    signalPill("BUY", snapshot.buyCount, "text-emerald-300", "bg-emerald-900/40 border-emerald-700/50"),
    signalPill("WATCH", snapshot.watchCount, "text-sky-300", "bg-sky-900/40 border-sky-700/50"),
    signalPill("HOLD", snapshot.holdCount, "text-amber-300", "bg-amber-900/40 border-amber-700/50"),
    signalPill("REDUCE", snapshot.reduceCount, "text-red-300", "bg-red-900/40 border-red-700/50"),
  ];

  const phases = phaseBar(snapshot);
  const sentiment = marketSentimentLabel(snapshot);
  const avgScorePct = Math.round(snapshot.averageCompositeScore * 100);
  const momentumBalance = snapshot.gainingMomentumCount - snapshot.losingMomentumCount;

  return (
    <section
      data-testid="theme-market-snapshot"
      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">
          Theme Market Snapshot
          <span className="ml-2 text-xs text-slate-500 font-normal">
            {snapshot.totalThemes} themes
          </span>
        </h2>
        <span className={`text-xs font-semibold ${sentiment.color}`}>
          {sentiment.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {pills.map(({ label, count, color, bg }) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium ${bg} ${color}`}
          >
            {label}
            <span className="font-bold">{count}</span>
          </span>
        ))}
      </div>

      {phases.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-slate-500 mb-1.5">Phase distribution</p>
          <div className="flex h-2 rounded overflow-hidden gap-px">
            {phases.map(({ phase, count, color }) => (
              <div
                key={phase}
                className={`${color} h-full`}
                style={{ flex: count }}
                title={`${phase}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 mt-1.5">
            {phases.map(({ phase, count, color }) => (
              <span key={phase} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
                {phase} {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-700/50 pt-3">
        <span>
          Avg score{" "}
          <span className="font-semibold text-slate-200">{avgScorePct}</span>
        </span>
        <span data-testid="momentum-balance">
          Momentum{" "}
          <span className={`font-semibold ${momentumBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {momentumBalance >= 0 ? "+" : ""}{momentumBalance}
          </span>
          <span className="text-slate-500 ml-1">
            (↑{snapshot.gainingMomentumCount} ↓{snapshot.losingMomentumCount})
          </span>
        </span>
      </div>
    </section>
  );
}
