import Link from "next/link";
import { fetchCategories, CategorySummary } from "@/lib/api";

const EQUITY_SECTOR_IDS = new Set([
  "TECH", "HLTH", "FINL", "DISR", "INDU", "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM",
]);

const SUB_SECTOR_COUNTS: Record<string, number> = {
  TECH: 8,
  HLTH: 6,
  FINL: 6,
  DISR: 6,
  INDU: 5,
  ENRG: 8,
  MATL: 7,
  UTIL: 3,
  REIT: 5,
  STPL: 3,
  COMM: 5,
};

const QUADRANT_CONFIG: Record<string, { label: string; colorClass: string; borderClass: string }> = {
  "1": { label: "↗ Leading",   colorClass: "text-green-400",  borderClass: "border-green-500/40" },
  "2": { label: "↖ Improving", colorClass: "text-cyan-400",   borderClass: "border-cyan-500/40"  },
  "3": { label: "↘ Weakening", colorClass: "text-orange-400", borderClass: "border-orange-500/40" },
  "4": { label: "↙ Lagging",   colorClass: "text-slate-400",  borderClass: "border-slate-600/40"  },
};

const QUADRANT_LEFT_BORDER: Record<string, string> = {
  "1": "border-l-green-500",
  "2": "border-l-cyan-500",
  "3": "border-l-orange-500",
  "4": "border-l-slate-500",
};

function RsValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 font-mono text-xs">—</span>;
  const pct = (value * 100).toFixed(1);
  const colorClass = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  return (
    <span className={`font-mono text-xs tabular-nums ${colorClass}`}>
      {value > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function SectorCard({ sector }: { sector: CategorySummary }) {
  const quadrant = sector.rrgQuadrant ?? null;
  const quadrantConfig = quadrant ? QUADRANT_CONFIG[quadrant] : null;
  const leftBorderClass = quadrant ? QUADRANT_LEFT_BORDER[quadrant] : "border-l-slate-700";
  const subSectorCount = SUB_SECTOR_COUNTS[sector.id] ?? 0;

  return (
    <Link
      href={`/sectors/${sector.id}`}
      className={`group block rounded-xl border border-slate-700 border-l-4 ${leftBorderClass} bg-slate-800/60 hover:bg-slate-800 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 p-4`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-slate-100 text-sm leading-tight mb-1">{sector.name}</h3>
          <span className="font-mono text-xs font-medium text-blue-300 bg-blue-950/40 border border-blue-800/30 px-1.5 py-0.5 rounded">
            {sector.etfTicker}
          </span>
        </div>
        <svg
          className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5 transition-colors"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className="space-y-2">
        {quadrantConfig ? (
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${quadrantConfig.borderClass} ${quadrantConfig.colorClass} bg-slate-900/50`}>
            {quadrantConfig.label}
          </div>
        ) : (
          <span className="text-slate-600 text-xs">No signal</span>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>vs SPY (60d)</span>
          <RsValue value={sector.rs60} />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Sub-sectors</span>
          <span className="font-mono text-slate-300">{subSectorCount}</span>
        </div>
      </div>
    </Link>
  );
}

export default async function SectorsHubPage() {
  let sectors: CategorySummary[] = [];
  let error: string | null = null;

  try {
    const response = await fetchCategories("MONTH");
    sectors = response.categories.filter((c) => EQUITY_SECTOR_IDS.has(c.id));
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sectors";
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <h1 className="text-base font-semibold text-slate-100">Sub-Sectors</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Select a sector to view within-sector rotation signals
        </p>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sectors.map((sector) => (
            <SectorCard key={sector.id} sector={sector} />
          ))}
        </div>

        {sectors.length === 0 && !error && (
          <p className="text-slate-500 text-sm">No sector data available. Trigger ingestion first.</p>
        )}

        <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Signal methodology:</span>{" "}
          Rotation quadrant (Leading/Improving/Weakening/Lagging) is derived from the Relative Rotation Graph
          using 60-day RS ratio and momentum vs SPY. Within each sector, sub-sector signals measure rotation
          relative to the parent sector ETF — not SPY.
        </div>
      </main>
    </div>
  );
}
