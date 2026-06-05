import { fetchRrg } from "@/lib/api";
import { RRG_EXCLUDED_IDS } from "@/lib/rrg";

const QUADRANT_LABEL: Record<number, string> = {
  4: "↗ Leading",
  3: "↖ Improving",
  2: "↘ Weakening",
  1: "↙ Lagging",
};

const QUADRANT_BADGE: Record<number, string> = {
  4: "bg-green-500/10 text-green-400 border border-green-500/20",
  3: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  2: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  1: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

function velocityArrow(dx: number, dy: number): string {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > 157.5 || angle <= -157.5) return "←";
  if (angle > 112.5) return "↖";
  if (angle > 67.5) return "↑";
  if (angle > 22.5) return "↗";
  if (angle > -22.5) return "→";
  if (angle > -67.5) return "↘";
  if (angle > -112.5) return "↓";
  return "↙";
}

function crossingEstimate(
  ratio: number, momentum: number,
  dRatio: number, dMomentum: number
): { axis: "ratio" | "momentum"; steps: number } | null {
  const candidates: { axis: "ratio" | "momentum"; steps: number }[] = [];

  if (Math.abs(dRatio) > 0.05) {
    const steps = (100 - ratio) / dRatio;
    if (steps > 0 && steps <= 10) candidates.push({ axis: "ratio", steps });
  }

  if (Math.abs(dMomentum) > 0.05) {
    const steps = (100 - momentum) / dMomentum;
    if (steps > 0 && steps <= 10) candidates.push({ axis: "momentum", steps });
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => a.steps < b.steps ? a : b);
}

export default async function RRGVelocityPanel() {
  const rrg = await fetchRrg().catch(() => null);
  if (!rrg || rrg.categories.length === 0) return null;

  const WINDOW = 5;

  const rows = rrg.categories
    .filter((c) => !c.id.includes("_") && !RRG_EXCLUDED_IDS.has(c.id))
    .filter((c) => c.trail.length >= 2)
    .map((cat) => {
      const trail = cat.trail;
      const n = trail.length;

      const stepCount = Math.min(WINDOW, n - 1);
      const recent = trail.slice(n - stepCount - 1);
      const totalDRatio = recent[recent.length - 1].ratio - recent[0].ratio;
      const totalDMom   = recent[recent.length - 1].momentum - recent[0].momentum;
      const dRatio    = totalDRatio / stepCount;
      const dMomentum = totalDMom   / stepCount;
      const velocity  = Math.sqrt(dRatio ** 2 + dMomentum ** 2);

      const latest = trail[n - 1];
      const crossing = crossingEstimate(latest.ratio, latest.momentum, dRatio, dMomentum);

      return {
        id: cat.id,
        name: cat.name,
        quadrant: cat.quadrant,
        ratio: latest.ratio,
        momentum: latest.momentum,
        dRatio,
        dMomentum,
        velocity,
        crossing,
      };
    })
    .sort((a, b) => b.velocity - a.velocity);

  if (rows.length === 0) return null;

  const maxVelocity = rows[0].velocity || 1;
  const imminent = rows.filter((r) => r.crossing && r.crossing.steps <= 5);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-300">Rotation Velocity</h2>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Average speed through RRG space over last {WINDOW} readings — fast movers are most likely to cross quadrant boundaries next
          </p>
        </div>
        {imminent.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/20 border border-amber-700/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            <span className="text-[10px] text-amber-300 font-semibold">
              {imminent.length} imminent crossing{imminent.length > 1 ? "s" : ""} (≤5 steps)
            </span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Sector</th>
              <th className="px-4 py-2.5 text-center" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Quadrant</th>
              <th className="px-4 py-2.5 text-right" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Speed</th>
              <th className="px-4 py-2.5 text-center" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Direction</th>
              <th className="px-4 py-2.5 text-right" title="Per-step change in RS-Ratio" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Δ RS-Ratio</th>
              <th className="px-4 py-2.5 text-right" title="Per-step change in RS-Momentum" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Δ RS-Mom</th>
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Velocity Bar</th>
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Crossing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row) => {
              const qBadge = QUADRANT_BADGE[row.quadrant] ?? "bg-slate-700 text-slate-400 border border-slate-600";
              const qLabel = QUADRANT_LABEL[row.quadrant] ?? "—";
              const barWidth = Math.round((row.velocity / maxVelocity) * 100);
              const arrow = velocityArrow(row.dRatio, row.dMomentum);
              const ratioColor = row.dRatio > 0 ? "text-emerald-400" : row.dRatio < 0 ? "text-red-400" : "text-slate-500";
              const momColor   = row.dMomentum > 0 ? "text-emerald-400" : row.dMomentum < 0 ? "text-red-400" : "text-slate-500";
              const isImminent = row.crossing && row.crossing.steps <= 5;
              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-800/40 transition-colors text-slate-200 ${isImminent ? "bg-amber-950/15" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="font-mono text-cyan-400 text-[10px]">{row.id}</span>
                      <span className="text-slate-400 text-[10px] truncate max-w-[120px]">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${qBadge}`}>
                      {qLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-300" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {row.velocity.toFixed(3)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="text-lg text-slate-300 leading-none" title={`dRatio=${row.dRatio.toFixed(3)}, dMom=${row.dMomentum.toFixed(3)}`}>
                      {arrow}
                    </span>
                  </td>
                  <td className={`px-4 py-2 text-right font-mono tabular-nums ${ratioColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {row.dRatio > 0 ? "+" : ""}{row.dRatio.toFixed(3)}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono tabular-nums ${momColor}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {row.dMomentum > 0 ? "+" : ""}{row.dMomentum.toFixed(3)}
                  </td>
                  <td className="px-4 py-2 min-w-[100px]">
                    <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.velocity > maxVelocity * 0.66 ? "bg-amber-400" : row.velocity > maxVelocity * 0.33 ? "bg-blue-400" : "bg-slate-500"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {row.crossing ? (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isImminent
                            ? "bg-amber-900/40 text-amber-300 border border-amber-700/50"
                            : "bg-slate-700/40 text-slate-400 border border-slate-600/40"
                        }`}
                        title={`${row.id} will cross the ${row.crossing.axis === "ratio" ? "RS-Ratio=100" : "RS-Mom=100"} boundary in approximately ${row.crossing.steps.toFixed(1)} steps at current velocity`}
                      >
                        {row.crossing.axis === "ratio" ? "ratio" : "mom"} in ~{Math.ceil(row.crossing.steps)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600 bg-slate-800/30">
          Speed = √(ΔRatio² + ΔMom²) per step (avg over {WINDOW} readings) · Crossing = estimated steps at current velocity to axis
        </div>
      </div>
    </section>
  );
}
