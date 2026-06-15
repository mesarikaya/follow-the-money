import { SignalTransitionDto } from "@/lib/api";

const SIGNAL_BADGE: Record<string, { label: string; cls: string }> = {
  BUY:    { label: "BUY",    cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  WATCH:  { label: "WATCH",  cls: "bg-cyan-500/15 text-cyan-300 border-cyan-600/30"          },
  HOLD:   { label: "HOLD",   cls: "bg-slate-700/40 text-slate-400 border-slate-600/30"       },
  REDUCE: { label: "REDUCE", cls: "bg-red-500/20 text-red-300 border-red-500/40"             },
};

function signalBadge(signal: string | null) {
  const cfg = signal ? (SIGNAL_BADGE[signal] ?? SIGNAL_BADGE["HOLD"]) : SIGNAL_BADGE["HOLD"];
  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded border ${cfg.cls}`}>
      {signal ?? "—"}
    </span>
  );
}

function describeTransition(t: SignalTransitionDto): string {
  const from = t.previousSignal ?? "unknown";
  const to = t.currentSignal;
  if (from === "WATCH" && to === "BUY") return "Momentum crossed BUY threshold — institutional buy signal";
  if (from === "BUY" && to === "WATCH") return "Weakening — score slipped below BUY threshold";
  if (from === "HOLD" && to === "WATCH") return "Recovering — score entering accumulation zone";
  if (from === "WATCH" && to === "HOLD") return "Momentum fading — signal retreated below WATCH threshold";
  if ((from === "HOLD" || from === "WATCH") && to === "REDUCE") return "Deteriorating — crossed REDUCE threshold";
  if (from === "REDUCE" && to === "HOLD") return "Stabilising — no longer in sell territory";
  if (from === "BUY" && to === "REDUCE") return "Sharp reversal — moved directly to REDUCE";
  return `Signal changed ${from} → ${to}`;
}

function isUpgrade(t: SignalTransitionDto): boolean {
  const rank: Record<string, number> = { REDUCE: 0, HOLD: 1, WATCH: 2, BUY: 3 };
  return (rank[t.currentSignal] ?? 1) > (rank[t.previousSignal ?? "HOLD"] ?? 1);
}

type Props = {
  transitions: SignalTransitionDto[];
};

export default function DailySignalDiff({ transitions }: Props) {
  const todayChanges = transitions.filter(t => t.daysAgo === 0);
  const recentChanges = transitions.filter(t => t.daysAgo > 0 && t.daysAgo <= 1);
  const allChanges = [...todayChanges, ...recentChanges];

  if (allChanges.length === 0) return null;

  const upgrades = allChanges.filter(isUpgrade);
  const downgrades = allChanges.filter(t => !isUpgrade(t));

  return (
    <section className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">LAST 24H</span>
          <h2
            className="text-sm font-bold text-slate-100"
            style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.04em" }}
          >
            What Changed Today
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {upgrades.length > 0 && (
            <span className="text-emerald-400/80">↑{upgrades.length} upgrade{upgrades.length > 1 ? "s" : ""}</span>
          )}
          {downgrades.length > 0 && (
            <span className="text-red-400/80">↓{downgrades.length} downgrade{downgrades.length > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {allChanges.map(t => {
          const upgrade = isUpgrade(t);
          const arrowCls = upgrade ? "text-emerald-400" : "text-red-400";
          const conviction = t.convictionScore != null ? Math.round(t.convictionScore) : null;

          return (
            <div
              key={t.categoryId}
              className="flex items-start gap-3 py-2 border-b border-slate-800/50 last:border-0"
            >
              {/* Upgrade/downgrade arrow */}
              <span className={`shrink-0 text-sm font-bold mt-0.5 ${arrowCls}`}>
                {upgrade ? "↑" : "↓"}
              </span>

              {/* ETF + name */}
              <div className="shrink-0 flex flex-col w-20 min-w-0">
                <span className="text-[11px] font-mono font-semibold text-slate-200">{t.etfTicker}</span>
                <span className="text-[9px] text-slate-500 truncate">{t.categoryName}</span>
              </div>

              {/* Before → after */}
              <div className="shrink-0 flex items-center gap-1 mt-0.5">
                {signalBadge(t.previousSignal)}
                <span className="text-[9px] text-slate-600">→</span>
                {signalBadge(t.currentSignal)}
              </div>

              {/* Human-readable explanation */}
              <p className="flex-1 text-[10px] text-slate-400 leading-relaxed min-w-0">
                {describeTransition(t)}
              </p>

              {/* Score + conviction */}
              <div className="shrink-0 flex flex-col items-end gap-0.5 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400">
                  {Math.round(t.currentScore * 100)}
                </span>
                {conviction != null && (
                  <span className="text-[8px] text-slate-600 font-mono">
                    {conviction}% conv.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allChanges.length === 0 && (
        <p className="text-[10px] text-slate-600 text-center py-2">
          No signal changes in the last 24h — all sectors holding prior signals.
        </p>
      )}
    </section>
  );
}
