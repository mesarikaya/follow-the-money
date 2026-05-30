import Link from "next/link";
import { fetchSubSectors, SubSectorSummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import SubSectorTable from "@/components/SubSectorTable";
import RefreshButton from "@/components/RefreshButton";

function buildConfluenceNarrative(
  bullishCount: number,
  bearishCount: number,
  total: number,
  sectorName: string,
  signalCounts: Record<string, SubSectorSummary[]>,
): { text: string; strength: "strong" | "moderate" | "mixed" | "weak" } | null {
  if (total === 0) return null;
  const bullishPct = Math.round((bullishCount / total) * 100);
  const buyCount = signalCounts["BUY"]?.length ?? 0;
  const watchCount = signalCounts["WATCH"]?.length ?? 0;

  if (bullishPct >= 75) {
    return {
      text: `${bullishCount} of ${total} ${sectorName} sub-sectors are in Leading or Improving phases — broad-based rotation strength. ${buyCount > 0 ? `${buyCount} BUY signal${buyCount > 1 ? "s" : ""} confirm entry readiness.` : "Watch for BUY signals to confirm."}`,
      strength: "strong",
    };
  }
  if (bullishPct >= 50) {
    return {
      text: `${bullishCount} of ${total} sub-sectors show bullish RRG momentum in ${sectorName}. ${watchCount + buyCount > 0 ? `${watchCount + buyCount} actionable signal${watchCount + buyCount > 1 ? "s" : ""} present.` : "Signals mixed — size positions cautiously."}`,
      strength: "moderate",
    };
  }
  if (bullishPct >= 25) {
    return {
      text: `Rotation in ${sectorName} is mixed — ${bullishCount} bullish vs ${bearishCount} bearish sub-sectors. Select only the Leading names; avoid sector-wide exposure.`,
      strength: "mixed",
    };
  }
  return {
    text: `${bearishCount} of ${total} ${sectorName} sub-sectors are in Weakening or Lagging phases — broad deterioration in sector rotation. Reduce or avoid until momentum stabilizes.`,
    strength: "weak",
  };
}

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
  const signalCounts: Record<string, SubSectorSummary[]> = { BUY: [], WATCH: [], HOLD: [], REDUCE: [] };
  for (const s of subSectors) {
    if (s.rrgQuadrant && quadrantCounts[s.rrgQuadrant]) {
      quadrantCounts[s.rrgQuadrant].push(s);
    }
    const sig = (s.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(s);
    if (sig && signalCounts[sig]) signalCounts[sig].push(s);
  }

  const bullishCount = (quadrantCounts["4"]?.length ?? 0) + (quadrantCounts["3"]?.length ?? 0);
  const bearishCount = (quadrantCounts["2"]?.length ?? 0) + (quadrantCounts["1"]?.length ?? 0);
  const total = subSectors.filter(s => s.rrgQuadrant != null).length;
  const confluenceNarrative = buildConfluenceNarrative(bullishCount, bearishCount, total, meta?.name ?? sectorId, signalCounts);

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
          <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg space-y-3">
            <p className="text-sm text-slate-400 font-medium">
              No sub-sector data yet for {meta?.name ?? sectorId}.
            </p>
            <p className="text-xs text-slate-500">
              These {meta?.etfTicker ?? sectorId} sub-sector ETFs were seeded in the database but have not been ingested yet.
              Click <strong>Refresh Data</strong> to fetch 5 years of price history for all sub-sectors.
              First ingestion takes 8–15 minutes; subsequent daily runs add ~30 seconds.
            </p>
            <RefreshButton />
          </div>
        )}

        {subSectors.length > 0 && subSectors.every(s => s.rs60 == null && s.compositeScore == null) && (
          <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-700/40 text-amber-300 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 shrink-0 mt-0.5">⚠</span>
              <div>
                <span className="font-semibold">Signals pending for {meta?.name ?? sectorId} sub-sectors.</span>{" "}
                Price history has not been ingested for these ETFs yet. Click Refresh Data to start.
                First ingestion takes 8–15 minutes for new tickers.
              </div>
            </div>
            <div className="pl-5">
              <RefreshButton />
            </div>
          </div>
        )}

        {subSectors.length > 0 && (
          <>
            {/* Quadrant summary cards */}
            <div className="grid grid-cols-4 gap-3">
              {(["4", "3", "2", "1"] as const).map((q) => {
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

            {/* Trade signal summary strip */}
            {subSectors.some(s => s.compositeScore != null) && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">Trade Signal</span>
                {([
                  { key: "BUY",    cls: "bg-green-900/40 text-green-300 border-green-700/50"  },
                  { key: "WATCH",  cls: "bg-cyan-900/30 text-cyan-300 border-cyan-700/40"     },
                  { key: "HOLD",   cls: "bg-slate-700/40 text-slate-400 border-slate-600/50"  },
                  { key: "REDUCE", cls: "bg-red-900/30 text-red-400 border-red-700/40"        },
                ] as const).map(({ key, cls }) => {
                  const count = signalCounts[key]?.length ?? 0;
                  const tickers = (signalCounts[key] ?? []).map(s => s.etfTicker).join(", ");
                  return (
                    <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cls}`} title={tickers || undefined}>
                      <span className="text-[10px] font-bold" style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.06em" }}>{key}</span>
                      <span className="text-sm font-bold" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{count}</span>
                      {tickers && <span className="text-[9px] opacity-60 hidden xl:inline">{tickers}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Rotation confluence narrative */}
            {confluenceNarrative && (
              <div
                className={`px-4 py-3 rounded-lg border text-sm leading-relaxed ${
                  confluenceNarrative.strength === "strong"
                    ? "bg-green-900/20 border-green-700/40 text-green-300"
                    : confluenceNarrative.strength === "moderate"
                    ? "bg-cyan-900/20 border-cyan-700/40 text-cyan-300"
                    : confluenceNarrative.strength === "mixed"
                    ? "bg-amber-900/15 border-amber-700/40 text-amber-300"
                    : "bg-red-900/15 border-red-700/40 text-red-300"
                }`}
              >
                <span
                  className="font-semibold mr-1"
                  style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.02em" }}
                >
                  {confluenceNarrative.strength === "strong"
                    ? "Strong Confluence:"
                    : confluenceNarrative.strength === "moderate"
                    ? "Moderate Confluence:"
                    : confluenceNarrative.strength === "mixed"
                    ? "Mixed Rotation:"
                    : "Broad Weakness:"}
                </span>
                {confluenceNarrative.text}
              </div>
            )}

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
