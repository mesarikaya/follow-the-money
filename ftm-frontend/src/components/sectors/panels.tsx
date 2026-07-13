import Link from "next/link";
import { SubSectorSummary } from "@/lib/api";
import { SectorsSummary } from "@/lib/sectors/sectorMetrics";
import { TradeSignal } from "@/lib/signals";

/** The sectors-hub header read-out and the cross-sector sub-sector leaderboards. */

const MONO = { fontFamily: "var(--font-jetbrains-mono)" };
const DISPLAY = { fontFamily: "var(--font-rajdhani)" };

const QUADRANT_STRIP_CONFIG = [
  { key: "4", label: "↗ Leading",   colorClass: "text-green-400",  dotClass: "bg-green-500"  },
  { key: "3", label: "↖ Improving", colorClass: "text-cyan-400",   dotClass: "bg-cyan-500"   },
  { key: "2", label: "↘ Weakening", colorClass: "text-orange-400", dotClass: "bg-orange-500" },
  { key: "1", label: "↙ Lagging",   colorClass: "text-slate-400",  dotClass: "bg-slate-500"  },
];

const SIGNAL_CHIP_STYLES: Record<TradeSignal, string> = {
  BUY:    "text-green-400 bg-green-900/20",
  WATCH:  "text-cyan-400 bg-cyan-900/20",
  HOLD:   "text-slate-500 bg-slate-800/40",
  REDUCE: "text-red-400 bg-red-900/20",
};

const SIGNALS: TradeSignal[] = ["BUY", "WATCH", "HOLD", "REDUCE"];

export const SectorRotationStrip = ({
  summary,
  sectorCount,
}: {
  summary: SectorsSummary;
  sectorCount: number;
}) => {
  const { tickersByQuadrant, tickersBySignal, averageScore, bullishCount, marketBias, crossHorizonDivergenceCount } = summary;
  if (!summary.hasQuadrantData) return null;

  return (
    <>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50 flex-wrap">
        <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">Sector Rotation</span>
        {QUADRANT_STRIP_CONFIG.map(({ key, label, colorClass, dotClass }) => {
          const tickers = tickersByQuadrant[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
              <span className={`text-[11px] font-semibold ${colorClass}`} style={DISPLAY}>{label}</span>
              <span className="text-[11px] text-slate-400" style={MONO}>
                {tickers.length > 0 ? `(${tickers.length})` : "—"}
              </span>
              {tickers.length > 0 && (
                <span className="text-[10px] text-slate-600 hidden xl:inline" style={MONO}>
                  {tickers.join(" · ")}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <span className="text-[10px] text-slate-600 uppercase tracking-wider shrink-0">Signals</span>
        {SIGNALS.map(signal => {
          const tickers = tickersBySignal[signal];
          return (
            <span
              key={signal}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SIGNAL_CHIP_STYLES[signal]}`}
              style={{ ...DISPLAY, letterSpacing: "0.06em" }}
              title={`${tickers.length} sector${tickers.length !== 1 ? "s" : ""} on ${signal}: ${tickers.join(", ") || "none"}`}
            >
              {signal} {tickers.length}
            </span>
          );
        })}
        <span className="text-slate-700 text-[10px] mx-1">·</span>
        {averageScore != null && (
          <span
            className={`text-[10px] font-mono tabular-nums ${
              averageScore >= 60 ? "text-emerald-400" : averageScore >= 40 ? "text-slate-400" : "text-red-400"
            }`}
            title={`Average composite score across all 11 sectors: ${averageScore}/100`}
          >
            Avg {averageScore}
          </span>
        )}
        <span
          className={`text-[10px] font-semibold ${
            bullishCount >= 7 ? "text-emerald-400" : bullishCount >= 4 ? "text-amber-400" : "text-red-400"
          }`}
          title={`${bullishCount} of ${sectorCount} sectors in Leading or Improving RRG phase — ${marketBias}`}
        >
          {marketBias}
        </span>
        {crossHorizonDivergenceCount > 0 && (
          <span
            className="text-[10px] text-orange-400 font-mono"
            title={`${crossHorizonDivergenceCount} sector${crossHorizonDivergenceCount > 1 ? "s" : ""} with cross-horizon RS divergence (short-term direction contradicts medium-term)`}
          >
            ÷{crossHorizonDivergenceCount} horizon div
          </span>
        )}
      </div>
    </>
  );
};

export type SubSectorLeader = SubSectorSummary & { parentId: string };

const PARENT_SECTOR_TICKERS: Record<string, string> = {
  TECH: "XLK", HLTH: "XLV", FINL: "XLF", DISR: "XLY",
  INDU: "XLI", ENRG: "XLE", MATL: "XLB", UTIL: "XLU",
  REIT: "XLRE", STPL: "XLP", COMM: "XLC",
};

const LEADERBOARD_SIZE = 6;

const QUADRANT_ARROWS: Record<string, { arrow: string; colorClass: string }> = {
  "4": { arrow: "↗", colorClass: "text-green-400" },
  "3": { arrow: "↖", colorClass: "text-cyan-400" },
  "2": { arrow: "↘", colorClass: "text-orange-400" },
};

const LeaderRow = ({ leader, value }: { leader: SubSectorLeader; value: number }) => {
  const quadrant = QUADRANT_ARROWS[leader.rrgQuadrant ?? ""] ?? { arrow: "↙", colorClass: "text-slate-500" };
  return (
    <Link
      href={`/sectors/${leader.parentId}`}
      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/60 transition-colors group"
    >
      <span className={`text-[9px] w-4 text-center ${quadrant.colorClass}`} title={`RRG Q${leader.rrgQuadrant}`}>
        {quadrant.arrow}
      </span>
      <span className="text-[10px] font-mono text-slate-200 w-10 shrink-0">{leader.etfTicker}</span>
      <span className="text-[9px] text-slate-500 flex-1 truncate">{leader.name}</span>
      <span className="text-[9px] text-slate-600 shrink-0" style={MONO}>
        {PARENT_SECTOR_TICKERS[leader.parentId] ?? leader.parentId}
      </span>
      <span
        className={`text-[10px] font-mono tabular-nums shrink-0 ${value > 0 ? "text-emerald-400" : "text-slate-500"}`}
        style={MONO}
      >
        {value >= 0 ? "+" : ""}{(value * 100).toFixed(1)}%
      </span>
    </Link>
  );
};

const LeaderboardCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
    <div
      className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-widest"
      style={{ ...DISPLAY, letterSpacing: "0.08em" }}
    >
      {title}
    </div>
    <div className="space-y-0">{children}</div>
  </div>
);

export const SubSectorLeaderboard = ({ leaders }: { leaders: SubSectorLeader[] }) => {
  const strongest = leaders
    .filter(leader => leader.rs20 != null)
    .sort((a, b) => (b.rs20 ?? 0) - (a.rs20 ?? 0))
    .slice(0, LEADERBOARD_SIZE);

  if (strongest.length === 0) return null;

  const acceleration = (leader: SubSectorLeader) => (leader.rs20 ?? 0) - (leader.rs120 ?? 0);
  const fastestAccelerating = leaders
    .filter(leader => leader.rs20 != null && leader.rs120 != null)
    .sort((a, b) => acceleration(b) - acceleration(a))
    .slice(0, LEADERBOARD_SIZE);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
      <LeaderboardCard title="↗ Top RS Leaders (RS-20)">
        {strongest.map(leader => (
          <LeaderRow key={leader.id} leader={leader} value={leader.rs20 ?? 0} />
        ))}
      </LeaderboardCard>
      <LeaderboardCard title="⚡ Fastest RS Accelerators (RS-20 minus RS-120)">
        {fastestAccelerating.map(leader => (
          <LeaderRow key={leader.id} leader={leader} value={acceleration(leader)} />
        ))}
      </LeaderboardCard>
    </div>
  );
};
