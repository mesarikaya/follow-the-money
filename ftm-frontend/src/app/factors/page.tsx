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

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  MTUM: "Follows stocks with strong recent price momentum. Leads in risk-on environments.",
  QUAL: "Targets high-ROE, low-leverage stocks. Defensive in drawdowns.",
  USMV: "Minimizes portfolio volatility. Outperforms in choppy markets.",
  VLUE: "Selects undervalued stocks by price-to-book and earnings. Mean-reversion play.",
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

function FactorCard({ factor }: { factor: SubSectorSummary }) {
  const quadrantLabel = factor.rrgQuadrant ? QUADRANT_LABELS[factor.rrgQuadrant] : "—";
  const quadrantColor = factor.rrgQuadrant ? QUADRANT_COLORS[factor.rrgQuadrant] : "text-slate-500";
  const rs60Class = rs60Color(factor.rs60);
  const description = FACTOR_DESCRIPTIONS[factor.id] ?? "";

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">{factor.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-700/60 rounded px-2 py-1 shrink-0">
          {factor.etfTicker}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/40 rounded p-2">
          <p className="text-slate-500 mb-1">RS vs SPY</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">20d</span>
              <span className={`font-mono ${rs60Color(factor.rs20)}`}>{formatRs(factor.rs20)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">60d</span>
              <span className={`font-mono font-bold ${rs60Class}`}>{formatRs(factor.rs60)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">120d</span>
              <span className={`font-mono ${rs60Color(factor.rs120)}`}>{formatRs(factor.rs120)}</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/40 rounded p-2">
          <p className="text-slate-500 mb-1">Momentum</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">MOM</span>
              <span className={`font-mono ${factor.momentum !== null && factor.momentum >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatMom(factor.momentum)}
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

export default async function FactorFlowsPage() {
  let factors: SubSectorSummary[] = [];
  let error: string | null = null;

  try {
    factors = await fetchSubSectors("FTRS");
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load factor data";
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-baseline justify-between">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Factor Flows
          </h1>
          <span className="text-[11px] text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            4 factor ETFs · MTUM · QUAL · USMV · VLUE
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Smart-money rotation across factor ETFs vs SPY. MTUM leading = risk-on; USMV leading = risk-off.
        </p>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {factors.length === 0 && !error && (
          <div className="text-slate-500 text-sm">
            No factor data yet. Trigger ingestion to compute signals for MTUM, QUAL, USMV, VLUE.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {factors.map((factor) => (
            <FactorCard key={factor.id} factor={factor} />
          ))}
        </div>

        {factors.length > 0 && (
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Factor rotation signals
            </h3>
            <p className="text-xs text-slate-500">
              RS &gt; 1.0 means the factor is outperforming SPY. When Momentum (MTUM) leads and Low
              Volatility (USMV) lags, the market is in a risk-on environment. The reverse suggests
              risk aversion. Quality (QUAL) leading Value (VLUE) often signals late-cycle dynamics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
