import Link from "next/link";
import { fetchSubSectors, fetchCategoryScoreHistory, fetchSignalHistory, SignalHistoryEntry, SubSectorSummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import SubSectorTable from "@/components/SubSectorTable";
import RefreshButton from "@/components/RefreshButton";

function SectorScoreSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 5) return null;
  const W = 160, H = 40, padX = 2, padY = 4;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const toX = (i: number) => padX + (i / (scores.length - 1)) * (W - padX * 2);
  const toY = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);
  const last = scores[scores.length - 1];
  const first = scores[0];
  const isUp = last >= first;
  const color = last >= 0.65 ? "#34d399" : last >= 0.45 ? "#fbbf24" : "#f87171";
  const polyline = scores.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const fillPts = `${toX(0).toFixed(1)},${H} ${polyline} ${toX(scores.length - 1).toFixed(1)},${H}`;
  const trend5 = scores.length >= 5 ? last - scores[scores.length - 5] : 0;
  const trendStr = trend5 > 0.01 ? "↑" : trend5 < -0.01 ? "↓" : "→";
  const trendColor = trend5 > 0.01 ? "text-emerald-400" : trend5 < -0.01 ? "text-red-400" : "text-slate-500";
  void isUp;
  return (
    <div className="flex items-end gap-2" title={`Composite score trend (${scores.length}d) — most recent: ${Math.round(last * 100)}/100`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "80px", height: "20px" }}>
        <polygon points={fillPts} fill={color} opacity="0.12" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
        <circle cx={toX(scores.length - 1).toFixed(1)} cy={toY(last).toFixed(1)} r="2" fill={color} />
      </svg>
      <span className={`text-xs font-mono ${trendColor}`}>
        {trendStr} {Math.round(last * 100)}
      </span>
    </div>
  );
}

const SIGNAL_SERIES = [
  { key: "COMPOSITE", label: "Composite", stroke: "#22d3ee",   fillOp: 0.08 },
  { key: "RS_60",     label: "RS-60",     stroke: "#4ade80",   fillOp: 0.06 },
  { key: "MACRO_FIT", label: "Macro Fit", stroke: "#a78bfa",   fillOp: 0.06 },
] as const;

function SignalComponentChart({ entries }: { entries: SignalHistoryEntry[] }) {
  if (!entries || entries.length === 0) return null;

  const byType: Record<string, { date: string; value: number }[]> = {};
  for (const e of entries) {
    if (!byType[e.signalType]) byType[e.signalType] = [];
    byType[e.signalType].push({ date: e.signalDate, value: e.value });
  }

  const hasSeries = SIGNAL_SERIES.some(s => byType[s.key]?.length >= 5);
  if (!hasSeries) return null;

  const allDates = Array.from(
    new Set(entries.map(e => e.signalDate))
  ).sort();
  const dates = allDates.slice(-90);
  if (dates.length < 5) return null;

  const W = 540, H = 120, padL = 38, padR = 12, padT = 10, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const toX = (i: number, n: number) => padL + (i / (n - 1)) * innerW;

  function normSeries(key: string): { x: number; y: number; v: number }[] | null {
    const raw = byType[key];
    if (!raw || raw.length < 5) return null;
    const dateMap = new Map(raw.map(p => [p.date, p.value]));
    const pts = dates.map(d => dateMap.get(d) ?? null);
    const valid = pts.filter((v): v is number => v !== null);
    if (valid.length < 5) return null;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    return pts
      .map((v, i) => v !== null ? { x: toX(i, dates.length), y: padT + (1 - (v - min) / range) * innerH, v } : null)
      .filter((p): p is { x: number; y: number; v: number } => p !== null);
  }

  const seriesData = SIGNAL_SERIES.map(s => ({ ...s, pts: normSeries(s.key) }));

  function toPolyline(pts: { x: number; y: number }[]): string {
    return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }
  function toFillPoly(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return "";
    return `${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} ${toPolyline(pts)} ${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)}`;
  }

  const xLabelIdxs = [0, Math.floor(dates.length * 0.25), Math.floor(dates.length * 0.5), Math.floor(dates.length * 0.75), dates.length - 1];

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">Signal Components</div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          {SIGNAL_SERIES.map(s => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: s.stroke }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100px" }}>
        {/* Gridlines */}
        {[0.25, 0.5, 0.75].map((f, i) => {
          const y = padT + f * innerH;
          return (
            <line key={i} x1={padL} x2={W - padR} y1={y} y2={y}
              stroke="#334155" strokeWidth="0.5" strokeDasharray="3,4" />
          );
        })}
        {/* Y-axis labels */}
        {["Hi", "Mid", "Lo"].map((l, i) => (
          <text key={l} x={padL - 4} y={padT + [0.1, 0.5, 0.9][i] * innerH + 4}
            fontSize="7" fill="#64748b" textAnchor="end">{l}</text>
        ))}
        {/* Series */}
        {seriesData.map(({ key, stroke, fillOp, pts }) => {
          if (!pts || pts.length < 2) return null;
          return (
            <g key={key}>
              <polygon points={toFillPoly(pts)} fill={stroke} opacity={fillOp} />
              <polyline points={toPolyline(pts)} fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.85" />
              <circle cx={pts[pts.length - 1].x.toFixed(1)} cy={pts[pts.length - 1].y.toFixed(1)} r="2.5" fill={stroke} />
            </g>
          );
        })}
        {/* X-axis date labels */}
        {xLabelIdxs.map(i => {
          const d = dates[i];
          if (!d) return null;
          const x = toX(i, dates.length);
          const label = d.slice(5); // MM-DD
          return (
            <text key={i} x={x} y={H - 4} fontSize="7" fill="#475569" textAnchor="middle">{label}</text>
          );
        })}
        {/* X-axis baseline */}
        <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#334155" strokeWidth="0.5" />
      </svg>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Signal history (last {dates.length} trading days) — each series independently normalized to [Lo, Hi] for visual comparison
      </div>
    </div>
  );
}

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
  let scoreHistory: number[] = [];
  let signalHistory: SignalHistoryEntry[] = [];

  const [subSectorsResult, scoreHistoryResult, signalHistoryResult] = await Promise.allSettled([
    fetchSubSectors(sectorId),
    fetchCategoryScoreHistory(60),
    fetchSignalHistory(sectorId),
  ]);

  if (subSectorsResult.status === "fulfilled") {
    subSectors = subSectorsResult.value;
  } else {
    error = subSectorsResult.reason instanceof Error
      ? subSectorsResult.reason.message
      : "Failed to load sub-sectors";
  }
  if (scoreHistoryResult.status === "fulfilled") {
    scoreHistory = scoreHistoryResult.value[sectorId] ?? [];
  }
  if (signalHistoryResult.status === "fulfilled") {
    signalHistory = signalHistoryResult.value;
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
            <div className="flex flex-col items-end gap-2">
              {meta && (
                <span
                  className="text-sm text-cyan-400 bg-cyan-500/8 border border-cyan-500/20 px-3 py-1.5 rounded-lg"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {meta.etfTicker}
                </span>
              )}
              {scoreHistory.length > 5 && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-600">60d score</span>
                  <SectorScoreSparkline scores={scoreHistory} />
                </div>
              )}
            </div>
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

            {/* Signal component history chart */}
            {signalHistory.length > 0 && (
              <SignalComponentChart entries={signalHistory} />
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
