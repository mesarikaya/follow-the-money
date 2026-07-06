import CollapsibleSection from "@/components/CollapsibleSection";
import { SIGNAL_CONFIG } from "@/components/portfolio/signalStyles";
import { SectorExposureRow } from "@/lib/portfolio/portfolioMetrics";

/**
 * "Sector Exposure vs Target" table: each sector's actual weight vs its momentum-optimal target,
 * with a gap and an exposure bar. Purely presentational — it receives already-computed rows
 * (see {@link sectorExposureRows}) and renders them.
 */
export default function SectorExposureSection({
  rows,
  unclassifiedEur,
  totalEur,
}: {
  rows: SectorExposureRow[];
  unclassifiedEur: number;
  totalEur: number;
}) {
  if (rows.length === 0) return null;

  return (
    <CollapsibleSection title="Sector Exposure vs Target" defaultOpen={false}>
      <div className="overflow-x-auto rounded-xl border border-slate-700/60">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2">Sector</th>
              <th className="px-3 py-2 text-center">Signal</th>
              <th className="px-3 py-2 text-right">Actual</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2 text-right">Gap</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2">Exposure bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row) => {
              const gap = row.targetPct != null ? row.actualPct - row.targetPct : null;
              const isOver = gap != null && gap > 2;
              const isUnder = gap != null && gap < -2;
              const sig = row.signal;
              const cfg = sig ? SIGNAL_CONFIG[sig] : null;
              const actionNeeded =
                sig === "BUY" && isUnder ? "underweight BUY — consider adding" :
                sig === "REDUCE" && isOver ? "overweight REDUCE — consider trimming" :
                null;
              return (
                <tr key={row.id} className={`hover:bg-slate-800/30 transition-colors ${actionNeeded ? "bg-amber-950/10" : ""}`}>
                  <td className="px-3 py-2 text-slate-300 font-medium">
                    <span className="font-mono text-blue-400 text-[10px] mr-1">{row.id}</span>
                    <span className="text-slate-400">{row.name}</span>
                    {actionNeeded && (
                      <span className="ml-2 text-[9px] text-amber-400">{actionNeeded}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {cfg && sig ? (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.className}`}>{sig}</span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">{row.actualPct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">
                    {row.targetPct != null ? `${row.targetPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${
                    gap == null ? "text-slate-700" :
                    isOver ? "text-amber-400" :
                    isUnder ? "text-cyan-400" : "text-slate-500"
                  }`}>
                    {gap != null ? `${gap > 0 ? "+" : ""}${gap.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-400">
                    €{row.totalEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 min-w-[120px]">
                    <div className="relative h-2 bg-slate-700/60 rounded-full overflow-visible">
                      <div
                        className={`h-full rounded-full ${sig === "BUY" ? "bg-green-500/60" : sig === "REDUCE" ? "bg-red-500/60" : "bg-blue-500/50"}`}
                        style={{ width: `${Math.min(row.actualPct * 2, 100)}%` }}
                      />
                      {row.targetPct != null && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-emerald-500/80 rounded"
                          style={{ left: `${Math.min(row.targetPct * 2, 100)}%` }}
                          title={`Target: ${row.targetPct.toFixed(1)}%`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {unclassifiedEur > 0 && (
              <tr className="hover:bg-slate-800/30">
                <td className="px-3 py-2 text-amber-400 text-[10px]">Unclassified</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-400">{((unclassifiedEur / totalEur) * 100).toFixed(1)}%</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-400">
                  €{unclassifiedEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
