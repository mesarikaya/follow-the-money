import Link from "next/link";
import { ThemeConstituent } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS, SECTOR_SHORT_NAMES, getParentSectorId } from "@/lib/sectors";
import { SIGNAL_CONFIG } from "@/components/themes/badges";

/** The constituent table on the theme detail page: one cell type per column, plus the row itself. */

export const SignalBadge = ({ signal }: { signal: string | null }) => {
  if (!signal) return <span className="text-slate-600 text-xs">—</span>;
  const cfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG.HOLD;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
  );
};

export const ScoreBar = ({ score }: { score: number | null }) => {
  if (score == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.65 ? "bg-emerald-500" : score >= 0.50 ? "bg-cyan-500" : score >= 0.35 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 0.65 ? "text-emerald-400" : score >= 0.50 ? "text-cyan-400" : score >= 0.35 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums ${textColor}`}>{pct}</span>
    </div>
  );
};

export const RsCell = ({ value }: { value: number | null }) => {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const color = value > 0.05 ? "text-emerald-400" : value > 0 ? "text-green-400" : value < -0.05 ? "text-red-400" : "text-amber-400";
  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {value > 0 ? "+" : ""}{(value * 100).toFixed(1)}%
    </span>
  );
};

export const FlowCell = ({ value }: { value: number | null }) => {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const isIn = value > 0.3;
  const isOut = value < -0.3;
  const color = isIn ? "text-emerald-400" : isOut ? "text-red-400" : "text-slate-400";
  const arrow = isIn ? "↑" : isOut ? "↓" : "→";
  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {arrow} {value.toFixed(2)}σ
    </span>
  );
};

export const TrendCell = ({ value }: { value: number | null }) => {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const isUp = value > 0.005;
  const isDown = value < -0.005;
  const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return <span className={`text-xs font-mono ${color}`}>{arrow} {(value * 100).toFixed(1)}pt</span>;
};

export const ConvictionDots = ({ score }: { score: number | null }) => {
  if (score == null) return <span className="text-slate-700 text-xs">—</span>;
  const filled = Math.round(score / 20);
  return (
    <div className="flex gap-0.5" title={`Conviction: ${score}/100`}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= filled ? "bg-blue-400" : "bg-slate-700"}`}
        />
      ))}
    </div>
  );
};

export const SectorChip = ({ categoryId, parentCategoryId }: { categoryId: string; parentCategoryId: string | null }) => {
  const parentId = parentCategoryId ?? getParentSectorId(categoryId);
  if (!parentId || !SECTOR_DRILLDOWN_IDS.has(parentId)) return <span className="text-slate-600 text-xs">—</span>;
  const shortName = SECTOR_SHORT_NAMES[parentId] ?? parentId;
  const isSelf = SECTOR_DRILLDOWN_IDS.has(categoryId);
  return (
    <Link
      href={`/sectors/${parentId}`}
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors hover:border-cyan-500/50 hover:text-cyan-300 ${
        isSelf
          ? "text-blue-300 bg-blue-900/20 border-blue-700/40"
          : "text-slate-400 bg-slate-800/60 border-slate-600/40"
      }`}
      title={`View ${parentId} sector drilldown`}
    >
      {shortName}
    </Link>
  );
};

const ConstituentRow = ({ constituent, index }: { constituent: ThemeConstituent; index: number }) => {
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(constituent.categoryId);
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors">
      <td className="py-2.5 px-3 text-xs text-slate-500 font-mono tabular-nums">{index + 1}</td>
      <td className="py-2.5 px-3">
        {hasDrilldown ? (
          <Link href={`/sectors/${constituent.categoryId}`} className="text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-colors">
            {constituent.name}
          </Link>
        ) : (
          <div className="text-xs font-semibold text-slate-200">{constituent.name}</div>
        )}
      </td>
      <td className="py-2.5 px-3">
        {hasDrilldown ? (
          <Link href={`/sectors/${constituent.categoryId}`} className="text-[11px] font-mono text-blue-300 bg-blue-900/20 px-1.5 py-0.5 rounded hover:text-cyan-300 transition-colors">
            {constituent.etfTicker}
          </Link>
        ) : (
          <span className="text-[11px] font-mono text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
            {constituent.etfTicker}
          </span>
        )}
      </td>
      <td className="py-2.5 px-3"><SectorChip categoryId={constituent.categoryId} parentCategoryId={constituent.parentCategoryId} /></td>
      <td className="py-2.5 px-3"><ScoreBar score={constituent.compositeScore} /></td>
      <td className="py-2.5 px-3"><RsCell value={constituent.rs60} /></td>
      <td className="py-2.5 px-3"><FlowCell value={constituent.flow20d} /></td>
      <td className="py-2.5 px-3"><TrendCell value={constituent.compositeTrend5d} /></td>
      <td className="py-2.5 px-3"><TrendCell value={constituent.compositeTrend20d} /></td>
      <td className="py-2.5 px-3"><SignalBadge signal={constituent.tradeSignal} /></td>
      <td className="py-2.5 px-3"><ConvictionDots score={constituent.convictionScore} /></td>
    </tr>
  );
};

const COLUMNS: { label: string; title?: string }[] = [
  { label: "#" },
  { label: "Name" },
  { label: "ETF" },
  { label: "Sector" },
  { label: "Score" },
  { label: "RS-60" },
  { label: "Flow" },
  { label: "5d", title: "5-day composite trend" },
  { label: "20d", title: "20-day composite trend" },
  { label: "Signal" },
  { label: "Conv" },
];

export const ConstituentTable = ({ constituents }: { constituents: ThemeConstituent[] }) => (
  <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden">
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-slate-700/60">
          {COLUMNS.map(column => (
            <th
              key={column.label}
              className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              title={column.title}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...constituents]
          .sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1))
          .map((constituent, index) => (
            <ConstituentRow key={constituent.categoryId} constituent={constituent} index={index} />
          ))}
      </tbody>
    </table>
  </div>
);
