import { fetchSubSectors, SubSectorSummary } from "@/lib/api";

const QUADRANT_LABELS: Record<string, string> = {
  "1": "↗ Leading",
  "2": "↖ Improving",
  "3": "↘ Weakening",
  "4": "↙ Lagging",
};

const QUADRANT_COLORS: Record<string, string> = {
  "1": "text-emerald-400",
  "2": "text-blue-400",
  "3": "text-amber-400",
  "4": "text-red-400",
};

function rs60Color(rs60: number | null): string {
  if (rs60 === null) return "text-slate-500";
  if (rs60 >= 1.05) return "text-emerald-400";
  if (rs60 >= 1.0) return "text-blue-400";
  if (rs60 >= 0.95) return "text-amber-400";
  return "text-red-400";
}

function formatRs(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3);
}

function formatMom(value: number | null): string {
  if (value === null) return "—";
  const pct = (value * 100).toFixed(1);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}

function SubSectorCard({ sector }: { sector: SubSectorSummary }) {
  const quadrantLabel = sector.rrgQuadrant ? QUADRANT_LABELS[sector.rrgQuadrant] : "—";
  const quadrantColor = sector.rrgQuadrant ? QUADRANT_COLORS[sector.rrgQuadrant] : "text-slate-500";
  const rs60Class = rs60Color(sector.rs60);

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{sector.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">ETF: {sector.etfTicker}</p>
        </div>
        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-700/60 rounded px-2 py-1">
          {sector.id}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/40 rounded p-2">
          <p className="text-slate-500 mb-1">RS vs XLK</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">20d</span>
              <span className={`font-mono ${rs60Color(sector.rs20)}`}>{formatRs(sector.rs20)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">60d</span>
              <span className={`font-mono font-bold ${rs60Class}`}>{formatRs(sector.rs60)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">120d</span>
              <span className={`font-mono ${rs60Color(sector.rs120)}`}>{formatRs(sector.rs120)}</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 rounded p-2">
          <p className="text-slate-500 mb-1">Signals</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">MOM</span>
              <span className={`font-mono ${sector.momentum !== null && sector.momentum >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatMom(sector.momentum)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">RRG</span>
              <span className={`text-right ${quadrantColor}`}>{quadrantLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function SubSectorsPage() {
  let subSectors: SubSectorSummary[] = [];
  let error: string | null = null;

  try {
    subSectors = await fetchSubSectors("TECH");
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load sub-sectors";
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center px-6 py-3 border-b border-slate-700 bg-slate-800 sticky top-0 z-10 shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-slate-200">Technology Sub-Sectors</h1>
          <p className="text-xs text-slate-500 mt-0.5">RS signals vs XLK parent benchmark</p>
        </div>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {subSectors.length === 0 && !error && (
          <div className="text-slate-500 text-sm">
            No sub-sector data yet. Trigger ingestion to compute signals for SMH, BOTZ, WCLD, IGV.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {subSectors.map((sector) => (
            <SubSectorCard key={sector.id} sector={sector} />
          ))}
        </div>

        {subSectors.length > 0 && (
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Reading the signals
            </h3>
            <p className="text-xs text-slate-500">
              RS &gt; 1.0 means the sub-sector is outperforming XLK (Technology). The RRG quadrant shows
              momentum trajectory: Leading (↗) and Improving (↖) are bullish, Weakening (↘) and Lagging (↙) are
              bearish. All signals are computed vs XLK, not SPY, showing rotation <em>within</em> Technology.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
