import Link from "next/link";
import { fetchSubSectors, SubSectorSummary } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

const SECTOR_META: Record<string, { name: string; etfTicker: string }> = {
  TECH: { name: "Information Technology", etfTicker: "XLK"  },
  HLTH: { name: "Health Care",            etfTicker: "XLV"  },
  FINL: { name: "Financials",             etfTicker: "XLF"  },
  DISR: { name: "Consumer Discretionary", etfTicker: "XLY"  },
  INDU: { name: "Industrials",            etfTicker: "XLI"  },
  ENRG: { name: "Energy",                 etfTicker: "XLE"  },
  MATL: { name: "Materials",              etfTicker: "XLB"  },
  UTIL: { name: "Utilities",              etfTicker: "XLU"  },
  REIT: { name: "Real Estate",            etfTicker: "XLRE" },
  STPL: { name: "Consumer Staples",       etfTicker: "XLP"  },
  COMM: { name: "Communication Services", etfTicker: "XLC"  },
};

const QUADRANT_CONFIG: Record<string, { label: string; colorClass: string; rowBorderClass: string }> = {
  "1": { label: "↗ Leading",   colorClass: "text-green-400",  rowBorderClass: "border-l-green-500" },
  "2": { label: "↖ Improving", colorClass: "text-cyan-400",   rowBorderClass: "border-l-cyan-500"  },
  "3": { label: "↘ Weakening", colorClass: "text-orange-400", rowBorderClass: "border-l-orange-500" },
  "4": { label: "↙ Lagging",   colorClass: "text-slate-400",  rowBorderClass: "border-l-slate-600"  },
};

function RsCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const colorClass = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  return (
    <span className={`font-mono tabular-nums ${colorClass}`}>
      {value > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function MomCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const colorClass = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  return (
    <span className={`font-mono tabular-nums ${colorClass}`}>
      {value > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function QuadrantBadge({ quadrant }: { quadrant: string | null }) {
  if (!quadrant) return <span className="text-slate-600 text-xs">—</span>;
  const config = QUADRANT_CONFIG[quadrant];
  if (!config) return <span className="text-slate-600 text-xs">—</span>;
  return <span className={`text-xs font-semibold ${config.colorClass}`}>{config.label}</span>;
}

function sortSubSectors(subSectors: SubSectorSummary[]): SubSectorSummary[] {
  return [...subSectors].sort((sectorA, sectorB) => {
    const quadrantA = sectorA.rrgQuadrant ? Number(sectorA.rrgQuadrant) : 99;
    const quadrantB = sectorB.rrgQuadrant ? Number(sectorB.rrgQuadrant) : 99;
    if (quadrantA !== quadrantB) return quadrantA - quadrantB;
    const rs60A = sectorA.rs60 ?? -Infinity;
    const rs60B = sectorB.rs60 ?? -Infinity;
    return rs60B - rs60A;
  });
}

export default async function SectorDrilldownPage({ params }: Props) {
  const { id } = await params;
  const sectorId = id.toUpperCase();
  const meta = SECTOR_META[sectorId];

  let subSectors: SubSectorSummary[] = [];
  let error: string | null = null;

  try {
    const raw = await fetchSubSectors(sectorId);
    subSectors = sortSubSectors(raw);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sub-sectors";
  }

  const quadrantCounts: Record<string, SubSectorSummary[]> = { "1": [], "2": [], "3": [], "4": [] };
  for (const s of subSectors) {
    if (s.rrgQuadrant && quadrantCounts[s.rrgQuadrant]) {
      quadrantCounts[s.rrgQuadrant].push(s);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <Link href="/sectors" className="hover:text-slate-300 transition-colors">Sub-Sectors</Link>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-300">{meta?.name ?? sectorId}</span>
        </nav>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-slate-100">{meta?.name ?? sectorId}</h1>
          {meta && (
            <span className="font-mono text-xs font-medium text-blue-300 bg-blue-950/40 border border-blue-800/30 px-1.5 py-0.5 rounded">
              {meta.etfTicker}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Relative strength vs {meta?.etfTicker ?? sectorId} — within-sector rotation signals
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        {subSectors.length === 0 && !error && (
          <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg text-sm text-slate-500">
            No sub-sector data yet for {meta?.name ?? sectorId}.
            Trigger ingestion to compute signals for the {meta?.etfTicker ?? sectorId} sub-sectors.
          </div>
        )}

        {subSectors.length > 0 && (
          <>
            {/* Quadrant summary cards */}
            <div className="grid grid-cols-4 gap-3">
              {(["1", "2", "3", "4"] as const).map((q) => {
                const config = QUADRANT_CONFIG[q];
                const members = quadrantCounts[q];
                return (
                  <div key={q} className="rounded-lg px-4 py-3 bg-slate-800/60 border border-slate-700/60">
                    <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${config.colorClass}`}>
                      {config.label}
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">{members.length}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {members.map((s) => s.etfTicker).join(" · ") || "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sub-sector table */}
            <div className="rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-3 w-8">#</th>
                    <th className="px-4 py-3">ETF</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 text-right" title={`60-day relative strength vs ${meta?.etfTicker ?? sectorId}`}>
                      vs {meta?.etfTicker ?? sectorId} (60d)
                    </th>
                    <th className="px-4 py-3 text-right" title="20-day relative strength">RS 20d</th>
                    <th className="px-4 py-3 text-right" title="120-day relative strength">RS 120d</th>
                    <th className="px-4 py-3 text-right" title="Price momentum">Momentum</th>
                    <th className="px-4 py-3 text-center" title="Relative Rotation Graph quadrant">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {subSectors.map((subSector, idx) => {
                    const quadrantConfig = subSector.rrgQuadrant
                      ? QUADRANT_CONFIG[subSector.rrgQuadrant]
                      : null;
                    const rowBorderClass = quadrantConfig?.rowBorderClass ?? "border-l-slate-700/40";

                    return (
                      <tr
                        key={subSector.id}
                        className={`hover:bg-slate-800/50 transition-colors text-slate-200 border-l-4 ${rowBorderClass}`}
                      >
                        <td className="px-4 py-2.5 text-slate-500 tabular-nums text-xs font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-blue-300 font-medium">{subSector.etfTicker}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-200">{subSector.name}</td>
                        <td className="px-4 py-2.5 text-right"><RsCell value={subSector.rs60} /></td>
                        <td className="px-4 py-2.5 text-right"><RsCell value={subSector.rs20} /></td>
                        <td className="px-4 py-2.5 text-right"><RsCell value={subSector.rs120} /></td>
                        <td className="px-4 py-2.5 text-right"><MomCell value={subSector.momentum} /></td>
                        <td className="px-4 py-2.5 text-center">
                          <QuadrantBadge quadrant={subSector.rrgQuadrant} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-slate-500 p-3 bg-slate-800/40 border border-slate-700/40 rounded-lg">
              <span className="font-semibold text-slate-400">Interpreting signals:</span>{" "}
              RS values compare each sub-sector ETF against {meta?.etfTicker ?? sectorId} (the parent sector).
              Positive = outperforming the sector. Leading (↗) and Improving (↖) indicate bullish rotation
              within {meta?.name ?? sectorId}. All signals are computed on daily closing prices.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
