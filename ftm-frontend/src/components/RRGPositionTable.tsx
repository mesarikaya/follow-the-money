import { fetchRrg, fetchCategories } from "@/lib/api";

const EXCLUDED_IDS = new Set([
  "FTRS", "MTUM", "QUAL", "USMV", "VLUE",
  "SEMI", "AIRO", "CLOD", "SOFT",
]);

const QUADRANT_CONFIG: Record<number, {
  label: string;
  order: number;
  colorClass: string;
  badgeClass: string;
  description: string;
}> = {
  1: { label: "↗ Leading",   order: 0, colorClass: "text-green-400",  badgeClass: "bg-green-500/10 text-green-400 border border-green-500/20",   description: "High RS, rising momentum — strongest rotation" },
  2: { label: "↖ Improving", order: 1, colorClass: "text-cyan-400",   badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",     description: "Low RS, rising momentum — early-stage entry" },
  3: { label: "↘ Weakening", order: 2, colorClass: "text-orange-400", badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/20", description: "High RS, falling momentum — rotation peak" },
  4: { label: "↙ Lagging",   order: 3, colorClass: "text-slate-400",  badgeClass: "bg-slate-500/15 text-slate-400 border border-slate-500/25",   description: "Low RS, falling momentum — avoid or short" },
};

function directionArrow(current: number, previous: number | null): string {
  if (previous == null) return "·";
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return "→";
  return delta > 0 ? "↑" : "↓";
}

function CoordCell({ value, direction }: { value: number; direction: string }) {
  const pct = value.toFixed(3);
  const isAbove = value > 1;
  const colorClass = isAbove ? "text-emerald-400" : "text-red-400";
  const dirColor = direction === "↑" ? "text-emerald-500" : direction === "↓" ? "text-red-500" : "text-slate-600";
  return (
    <span className="flex items-center gap-1 tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
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
    .filter((c) => !c.id.includes("_") && !EXCLUDED_IDS.has(c.id))
    .filter((c) => c.trail.length > 0);

  const rows = filtered.map((cat) => {
    const trail = cat.trail;
    const latest = trail[trail.length - 1];
    const prev   = trail.length >= 2 ? trail[trail.length - 2] : null;
    return {
      id: cat.id,
      name: cat.name,
      etfTicker: etfTickers[cat.id] ?? cat.id,
      quadrant: cat.quadrant,
      ratio: latest.ratio,
      momentum: latest.momentum,
      ratioDir: directionArrow(latest.ratio, prev?.ratio ?? null),
      momentumDir: directionArrow(latest.momentum, prev?.momentum ?? null),
    };
  });

  rows.sort((a, b) => {
    const qa = QUADRANT_CONFIG[a.quadrant]?.order ?? 99;
    const qb = QUADRANT_CONFIG[b.quadrant]?.order ?? 99;
    if (qa !== qb) return qa - qb;
    return b.momentum - a.momentum;
  });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Position Table</h2>
        <span className="text-[10px] text-slate-600" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          sorted by quadrant · then momentum desc · ↑↓ = direction vs prior reading
        </span>
      </div>

      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>ETF</th>
              <th className="px-4 py-2.5" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Category</th>
              <th className="px-4 py-2.5 text-center" style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>Quadrant</th>
              <th className="px-4 py-2.5 text-right" title="RS-Ratio: normalized relative strength vs SPY. Above 1.0 = outperforming."
                style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>RS-Ratio</th>
              <th className="px-4 py-2.5 text-right" title="RS-Momentum: rate of change of RS-Ratio. Above 1.0 = improving."
                style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}>RS-Mom</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row) => {
              const qConfig = QUADRANT_CONFIG[row.quadrant];
              return (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors text-slate-200">
                  <td
                    className="px-4 py-2 text-cyan-400 font-medium"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {row.etfTicker}
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
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600 bg-slate-800/30">
          RS-Ratio &gt; 1.0 = outperforming SPY · RS-Momentum &gt; 1.0 = RS improving · ↑↓ = direction vs prior week
        </div>
      </div>
    </section>
  );
}
