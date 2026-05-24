import Link from "next/link";
import { fetchSubSectors, SubSectorSummary } from "@/lib/api";
import SubSectorTable from "@/components/SubSectorTable";

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

const QUADRANT_SUMMARY: Record<string, { label: string; colorClass: string }> = {
  "4": { label: "↗ Leading",   colorClass: "text-green-400"  },
  "3": { label: "↖ Improving", colorClass: "text-cyan-400"   },
  "2": { label: "↘ Weakening", colorClass: "text-orange-400" },
  "1": { label: "↙ Lagging",   colorClass: "text-slate-400"  },
};

export default async function SectorDrilldownPage({ params }: Props) {
  const { id } = await params;
  const sectorId = id.toUpperCase();
  const meta = SECTOR_META[sectorId];

  let subSectors: SubSectorSummary[] = [];
  let error: string | null = null;

  try {
    subSectors = await fetchSubSectors(sectorId);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sub-sectors";
  }

  const quadrantCounts: Record<string, SubSectorSummary[]> = { "4": [], "3": [], "2": [], "1": [] };
  for (const s of subSectors) {
    if (s.rrgQuadrant && quadrantCounts[s.rrgQuadrant]) {
      quadrantCounts[s.rrgQuadrant].push(s);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header with breadcrumb + sector banner */}
      <header className="shrink-0 border-b border-slate-700">
        {/* Breadcrumb */}
        <div className="px-6 pt-4 pb-2">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/sectors" className="hover:text-cyan-400 transition-colors">
              Sub-Sectors
            </Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-300">{meta?.name ?? sectorId}</span>
          </nav>
        </div>

        {/* Sector banner */}
        <div className="mx-6 mb-4 p-4 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-900/40 border border-slate-700/60 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-slate-100 font-bold leading-tight"
                style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
              >
                {meta?.name ?? sectorId}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Relative strength vs{" "}
                <span className="text-cyan-400" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  {meta?.etfTicker ?? sectorId}
                </span>{" "}
                — within-sector rotation signals
              </p>
            </div>
            {meta && (
              <span
                className="text-sm text-cyan-400 bg-cyan-500/8 border border-cyan-500/20 px-3 py-1.5 rounded-lg"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {meta.etfTicker}
              </span>
            )}
          </div>
        </div>
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
                const config = QUADRANT_SUMMARY[q];
                const members = quadrantCounts[q];
                return (
                  <div key={q} className="rounded-lg px-4 py-3 bg-slate-800/60 border border-slate-700/60">
                    <div
                      className={`text-[10px] uppercase mb-1 ${config.colorClass}`}
                      style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600, letterSpacing: "0.08em" }}
                    >
                      {config.label}
                    </div>
                    <div
                      className="text-2xl font-bold text-white"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      {members.length}
                    </div>
                    <div
                      className="text-[11px] text-slate-500 truncate mt-0.5"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      {members.map((s) => s.etfTicker).join(" · ") || "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sortable sub-sector table */}
            <SubSectorTable
              subSectors={subSectors}
              parentEtfTicker={meta?.etfTicker ?? sectorId}
              parentName={meta?.name ?? sectorId}
            />

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
