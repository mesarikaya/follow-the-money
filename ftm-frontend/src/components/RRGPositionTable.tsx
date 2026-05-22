import { fetchRrg, fetchCategories } from "@/lib/api";
import { RRG_EXCLUDED_IDS } from "@/lib/rrg";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

const QUADRANT_CONFIG: Record<number, {
  label: string;
  shortLabel: string;
  order: number;
  colorClass: string;
  badgeClass: string;
  description: string;
}> = {
  1: { label: "↗ Leading",   shortLabel: "Leading",   order: 0, colorClass: "text-green-400",  badgeClass: "bg-green-500/10 text-green-400 border border-green-500/20",   description: "High RS, rising momentum — strongest rotation" },
  2: { label: "↖ Improving", shortLabel: "Improving", order: 1, colorClass: "text-cyan-400",   badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",     description: "Low RS, rising momentum — early-stage entry" },
  3: { label: "↘ Weakening", shortLabel: "Weakening", order: 2, colorClass: "text-orange-400", badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/20", description: "High RS, falling momentum — rotation peak" },
  4: { label: "↙ Lagging",   shortLabel: "Lagging",   order: 3, colorClass: "text-slate-400",  badgeClass: "bg-slate-500/15 text-slate-400 border border-slate-500/25",   description: "Low RS, falling momentum — avoid or short" },
};

function numericQuadrant(ratio: number, momentum: number): number {
  if (ratio >= 100 && momentum >= 100) return 1;
  if (ratio < 100 && momentum >= 100) return 2;
  if (ratio >= 100 && momentum < 100) return 3;
  return 4;
}

function directionArrow(current: number, previous: number | null): string {
  if (previous == null) return "·";
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return "→";
  return delta > 0 ? "↑" : "↓";
}

function CoordCell({ value, direction }: { value: number; direction: string }) {
  const pct = value.toFixed(3);
  const isAbove = value > 100;
  const colorClass = isAbove ? "text-emerald-400" : "text-red-400";
  const dirColor = direction === "↑" ? "text-emerald-500" : direction === "↓" ? "text-red-500" : "text-slate-600";
  return (
    <span className="flex items-center gap-1 tabular-nums justify-end" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
      <span className={`text-xs ${colorClass}`}>{pct}</span>
      <span className={`text-[10px] ${dirColor}`}>{direction}</span>
    </span>
  );
}

export default async function RRGPositionTable() {
  const [rrg, categoriesData] = await Promise.all([
    fetchRrg().catch(() => null),
    fetchCategories("MONTH").catch(() => null),
  ]);

  if (!rrg || rrg.categories.length === 0) return null;

  const etfTickers: Record<string, string> = {};
  if (categoriesData) {
    for (const cat of categoriesData.categories) {
      etfTickers[cat.id] = cat.etfTicker;
    }
  }

  const filtered = rrg.categories
    .filter((c) => !c.id.includes("_") && !RRG_EXCLUDED_IDS.has(c.id))
    .filter((c) => c.trail.length > 0);

  const rows = filtered.map((cat) => {
    const trail = cat.trail;
    const latest = trail[trail.length - 1];
    const prev   = trail.length >= 2 ? trail[trail.length - 2] : null;
    const prevQuadNum = prev ? numericQuadrant(prev.ratio, prev.momentum) : null;
    const quadrantChanged = prevQuadNum !== null && prevQuadNum !== cat.quadrant;
    const minAxisDist = Math.min(Math.abs(latest.ratio - 100), Math.abs(latest.momentum - 100));
    return {
      id: cat.id,
      name: cat.name,
      etfTicker: etfTickers[cat.id] ?? cat.id,
      quadrant: cat.quadrant,
      ratio: latest.ratio,
      momentum: latest.momentum,
      ratioDir: directionArrow(latest.ratio, prev?.ratio ?? null),
      momentumDir: directionArrow(latest.momentum, prev?.momentum ?? null),
      quadrantChanged,
      prevQuadrant: prevQuadNum,
      minAxisDist,
    };
  });

  rows.sort((a, b) => {
    const qa = QUADRANT_CONFIG[a.quadrant]?.order ?? 99;
    const qb = QUADRANT_CONFIG[b.quadrant]?.order ?? 99;
    if (qa !== qb) return qa - qb;
    return b.momentum - a.momentum;
  });

  const crossedRows = rows.filter(r => r.quadrantChanged);
  const nearBoundaryCount = rows.filter(r => !r.quadrantChanged && r.minAxisDist < 3).length;

  return (
    <section className="space-y-2">
      {crossedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-purple-900/20 border border-purple-700/30 text-xs">
          <span className="text-purple-300 font-semibold shrink-0">⚡ Quadrant Crossings</span>
          <span className="text-purple-700">·</span>
          {crossedRows.map((r, i) => {
            const prevLabel = QUADRANT_CONFIG[r.prevQuadrant!]?.shortLabel ?? "?";
            const currLabel = QUADRANT_CONFIG[r.quadrant]?.shortLabel ?? "?";
            return (
              <span key={r.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-purple-800 mr-1">·</span>}
                <span className="text-purple-200 font-mono">{r.etfTicker}</span>
                <span className="text-purple-500 text-[10px]">{prevLabel} → {currLabel}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Position Table</h2>
        <div className="flex items-center gap-3">
          {nearBoundaryCount > 0 && (
            <span className="text-[10px] text-amber-500/70" title="Sectors within 3 units of a quadrant boundary">
              ⊙ {nearBoundaryCount} near boundary
            </span>
          )}
          <span className="text-[10px] text-slate-600" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            sorted by quadrant · then momentum desc
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>ETF</th>
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Category</th>
              <th className="px-4 py-2.5 text-center" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Quadrant</th>
              <th className="px-4 py-2.5 text-right" title="RS-Ratio: normalized relative strength vs SPY. Above 100 = outperforming." style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>RS-Ratio</th>
              <th className="px-4 py-2.5 text-right" title="RS-Momentum: rate of change of RS-Ratio. Above 100 = improving." style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>RS-Mom</th>
              <th className="px-4 py-2.5 text-center" title="State: ⚡ crossed quadrant boundary · ⊙ near boundary (< 3 units) · number = units from nearest axis" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row) => {
              const qConfig = QUADRANT_CONFIG[row.quadrant];
              const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-800/40 transition-colors text-slate-200 ${row.quadrantChanged ? "bg-purple-900/10" : ""}`}
                >
                  <td className="px-4 py-2 font-medium" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {hasDrilldown ? (
                      <Link href={`/sectors/${row.id}`} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        {row.etfTicker}
                      </Link>
                    ) : (
                      <span className="text-cyan-400">{row.etfTicker}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{row.name}</td>
                  <td className="px-4 py-2 text-center">
                    {qConfig ? (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${qConfig.badgeClass}`}
                        title={qConfig.description}
                        style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
                      >
                        {qConfig.label}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <CoordCell value={row.ratio} direction={row.ratioDir} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <CoordCell value={row.momentum} direction={row.momentumDir} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {row.quadrantChanged ? (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/50"
                        title={`Crossed from ${QUADRANT_CONFIG[row.prevQuadrant!]?.shortLabel ?? "?"} to ${qConfig?.shortLabel ?? "?"} since last reading`}
                      >
                        ⚡ CROSSED
                      </span>
                    ) : row.minAxisDist < 1.5 ? (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/40"
                        title={`${row.minAxisDist.toFixed(1)} units from axis — imminent quadrant transition possible`}
                      >
                        ⚠ EDGE
                      </span>
                    ) : row.minAxisDist < 3 ? (
                      <span
                        className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-900/30 text-amber-500 border border-amber-700/30"
                        title={`${row.minAxisDist.toFixed(1)} units from axis — approaching quadrant boundary`}
                      >
                        ⊙ NEAR
                      </span>
                    ) : (
                      <span
                        className="text-[9px] tabular-nums text-slate-700"
                        title={`${row.minAxisDist.toFixed(1)} units from nearest axis — stable position`}
                        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        {row.minAxisDist.toFixed(1)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600 bg-slate-800/30">
          RS-Ratio &gt; 100 = outperforming SPY · RS-Momentum &gt; 100 = RS improving · ↑↓ = direction vs prior reading · ⚡ = quadrant crossing · ⊙ = near boundary
        </div>
      </div>
    </section>
  );
}
