import { fetchScreenerSnapshot, ScreenerSnapshotDto } from "@/lib/api";

async function loadSnapshot(): Promise<ScreenerSnapshotDto | null> {
  try {
    return await fetchScreenerSnapshot();
  } catch {
    return null;
  }
}

export default async function ScreenerSnapshotBanner() {
  const snapshot = await loadSnapshot();
  if (!snapshot || snapshot.totalCategories === 0) return null;

  return (
    <div
      data-testid="screener-snapshot-banner"
      className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
    >
      <span className="text-slate-500 font-mono text-[10px] uppercase tracking-widest shrink-0">
        Market
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        {snapshot.buyCount > 0 && (
          <SignalPill
            testId="snapshot-buy-count"
            count={snapshot.buyCount}
            label="BUY"
            dotColor="bg-emerald-400"
            pillClass="bg-emerald-900/50 text-emerald-400 border-emerald-700/40"
          />
        )}
        {snapshot.watchCount > 0 && (
          <SignalPill
            count={snapshot.watchCount}
            label="WATCH"
            dotColor="bg-cyan-400"
            pillClass="bg-cyan-900/50 text-cyan-400 border-cyan-700/40"
          />
        )}
        {snapshot.holdCount > 0 && (
          <SignalPill
            count={snapshot.holdCount}
            label="HOLD"
            dotColor="bg-slate-400"
            pillClass="bg-slate-700/50 text-slate-300 border-slate-600/40"
          />
        )}
        {snapshot.reduceCount > 0 && (
          <SignalPill
            count={snapshot.reduceCount}
            label="REDUCE"
            dotColor="bg-red-400"
            pillClass="bg-red-900/50 text-red-400 border-red-700/40"
          />
        )}
      </div>

      <div className="h-4 w-px bg-slate-600 hidden sm:block" aria-hidden />

      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
        <StatItem
          value={(snapshot.avgCompositeScore * 100).toFixed(0)}
          label="avg score"
        />
        <StatItem
          testId="snapshot-rs-breadth"
          value={`${snapshot.rsBreadthPct.toFixed(0)}%`}
          label="RS breadth"
        />
        <StatItem
          value={`${snapshot.momentumBreadthPct.toFixed(0)}%`}
          label="momentum"
        />
        <StatItem
          value={`${snapshot.riskOnPct.toFixed(0)}%`}
          label="risk-on"
        />
      </div>
    </div>
  );
}

function SignalPill({
  count,
  label,
  dotColor,
  pillClass,
  testId,
}: {
  count: number;
  label: string;
  dotColor: string;
  pillClass: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${pillClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotColor}`} aria-hidden />
      {count} {label}
    </span>
  );
}

function StatItem({
  value,
  label,
  testId,
}: {
  value: string;
  label: string;
  testId?: string;
}) {
  return (
    <span data-testid={testId}>
      <span className="text-slate-200 font-mono">{value}</span>
      <span className="ml-1">{label}</span>
    </span>
  );
}
