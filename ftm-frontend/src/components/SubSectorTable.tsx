"use client";

import { useState } from "react";
import { SubSectorSummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

type SortCol = "rs60" | "rs20" | "rs120" | "momentum" | "compositeScore" | "quadrant" | "acceleration" | "compositeTrend5d" | "persistence20d";
type SortDir = "asc" | "desc";

const QUADRANT_ORDER: Record<string, number> = { "4": 0, "3": 1, "2": 2, "1": 3 };

const TRADE_SIGNAL_CONFIG: Record<TradeSignal, { label: string; className: string }> = {
  BUY:    { label: "BUY",    className: "bg-green-500/20 text-green-300 border border-green-500/40" },
  WATCH:  { label: "WATCH",  className: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   className: "bg-slate-600/30 text-slate-400 border border-slate-500/30" },
  REDUCE: { label: "REDUCE", className: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

const QUADRANT_CONFIG: Record<string, {
  label: string;
  colorClass: string;
  badgeClass: string;
  rowBorderClass: string;
}> = {
  "4": {
    label: "↗ Leading",
    colorClass: "text-green-400",
    badgeClass: "bg-green-500/10 text-green-400 border border-green-500/25",
    rowBorderClass: "border-l-green-500",
  },
  "3": {
    label: "↖ Improving",
    colorClass: "text-cyan-400",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25",
    rowBorderClass: "border-l-cyan-500",
  },
  "2": {
    label: "↘ Weakening",
    colorClass: "text-orange-400",
    badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/25",
    rowBorderClass: "border-l-orange-500",
  },
  "1": {
    label: "↙ Lagging",
    colorClass: "text-slate-400",
    badgeClass: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
    rowBorderClass: "border-l-slate-600",
  },
};

function RsCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const colorClass = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  return (
    <span className={`tabular-nums ${colorClass}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
      {value > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function TrendPip({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return null;
  const delta = Math.round(Math.abs(value * 100));
  const isUp = value > 0.005;
  const isDown = value < -0.005;
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  const colorClass = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500";
  return (
    <span
      className={`text-[9px] tabular-nums ${colorClass}`}
      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      title={`${label}: ${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}pt`}
    >
      {arrow}{delta > 0 ? delta : ""}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const filledCount = Math.round(score * 5);
  const barColor = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  const textColor = score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center justify-center gap-1" title={`Composite score: ${pct}/100`}>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`w-1.5 h-3 rounded-[2px] ${i < filledCount ? barColor : "bg-slate-700"}`} />
        ))}
      </div>
      <span className={`text-[11px] tabular-nums font-medium ${textColor}`}>{pct}</span>
    </div>
  );
}

function PersistenceCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = Math.round((value / 20) * 100);
  const colorClass = pct >= 60 ? "text-emerald-400" : pct >= 40 ? "text-slate-400" : "text-red-400";
  const filled = Math.round((value / 20) * 5);
  return (
    <div
      className="flex items-center gap-1.5 justify-end"
      title={`Persistence: ${value}/20 days outperformed benchmark (${pct}%)`}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`w-1 h-2.5 rounded-[1px] ${i < filled ? (pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-slate-500" : "bg-red-500") : "bg-slate-700"}`} />
        ))}
      </div>
      <span className={`tabular-nums text-[10px] ${colorClass}`} style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {value}d
      </span>
    </div>
  );
}

function AccelCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const isPos = value > 0;
  const isFlat = Math.abs(value) < 0.001;
  const colorClass = isFlat ? "text-slate-400" : isPos ? "text-emerald-400" : "text-red-400";
  const arrow = isFlat ? "→" : isPos ? "↗" : "↘";
  return (
    <span
      className={`tabular-nums text-[11px] ${colorClass}`}
      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      title="RS Acceleration = RS60 − RS120. Positive = near-term outperformance accelerating vs long-term."
    >
      {arrow} {value > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function SortArrow({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (col !== sortCol) return <span className="text-slate-700 ml-0.5">↕</span>;
  return <span className="text-cyan-400 ml-0.5">{sortDir === "desc" ? "↓" : "↑"}</span>;
}

function acceleration(row: SubSectorSummary): number | null {
  if (row.rs60 == null || row.rs120 == null) return null;
  return row.rs60 - row.rs120;
}

function sortRows(rows: SubSectorSummary[], col: SortCol, dir: SortDir): SubSectorSummary[] {
  return [...rows].sort((a, b) => {
    let valA: number;
    let valB: number;

    if (col === "quadrant") {
      valA = a.rrgQuadrant ? (QUADRANT_ORDER[a.rrgQuadrant] ?? 99) : 99;
      valB = b.rrgQuadrant ? (QUADRANT_ORDER[b.rrgQuadrant] ?? 99) : 99;
    } else if (col === "acceleration") {
      valA = acceleration(a) ?? -Infinity;
      valB = acceleration(b) ?? -Infinity;
    } else if (col === "compositeTrend5d") {
      valA = a.compositeTrend5d ?? -Infinity;
      valB = b.compositeTrend5d ?? -Infinity;
    } else if (col === "persistence20d") {
      valA = a.persistence20d ?? -Infinity;
      valB = b.persistence20d ?? -Infinity;
    } else {
      valA = (a[col] as number | null) ?? -Infinity;
      valB = (b[col] as number | null) ?? -Infinity;
    }

    const diff = valA - valB;
    return dir === "desc" ? -diff : diff;
  });
}

const TH_STYLE = {
  fontFamily: "var(--font-rajdhani)",
  fontWeight: 600,
  letterSpacing: "0.08em",
} as const;

export default function SubSectorTable({
  subSectors,
  parentEtfTicker,
  parentName,
}: {
  subSectors: SubSectorSummary[];
  parentEtfTicker: string;
  parentName: string;
}) {
  const [sortCol, setSortCol] = useState<SortCol>("rs60");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir(col === "quadrant" ? "asc" : "desc");
    }
  };

  const sorted = sortRows(subSectors, sortCol, sortDir);

  const thCls = (col: SortCol) =>
    `px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors ${sortCol === col ? "text-cyan-400" : ""}`;

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 text-[10px] uppercase">
            <th className="px-4 py-3 w-8" style={TH_STYLE}>#</th>
            <th className="px-4 py-3" style={TH_STYLE}>ETF</th>
            <th className="px-4 py-3" style={TH_STYLE}>Name</th>
            <th
              className={`px-4 py-3 text-center ${thCls("compositeScore")}`}
              style={TH_STYLE}
              onClick={() => handleSort("compositeScore")}
              title="Composite signal score (0–100). ↑/↓ pips show 5d and 20d score trends."
            >
              Score<SortArrow col="compositeScore" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-center ${thCls("compositeTrend5d")}`}
              style={TH_STYLE}
              onClick={() => handleSort("compositeTrend5d")}
              title="5-day composite score trend. Positive = improving score over last 5 days."
            >
              Trend<SortArrow col="compositeTrend5d" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-right ${thCls("rs60")}`}
              style={TH_STYLE}
              onClick={() => handleSort("rs60")}
              title={`60-day relative strength vs ${parentEtfTicker}`}
            >
              vs {parentEtfTicker} (60d)<SortArrow col="rs60" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-right ${thCls("rs20")}`}
              style={TH_STYLE}
              onClick={() => handleSort("rs20")}
              title="20-day relative strength"
            >
              RS 20d<SortArrow col="rs20" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-right ${thCls("rs120")}`}
              style={TH_STYLE}
              onClick={() => handleSort("rs120")}
              title="120-day relative strength"
            >
              RS 120d<SortArrow col="rs120" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-right ${thCls("acceleration")}`}
              style={TH_STYLE}
              onClick={() => handleSort("acceleration")}
              title="RS Acceleration = RS60 − RS120. Positive means near-term RS is outpacing long-term RS — momentum building."
            >
              Accel<SortArrow col="acceleration" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-right ${thCls("momentum")}`}
              style={TH_STYLE}
              onClick={() => handleSort("momentum")}
              title="Price momentum"
            >
              Momentum<SortArrow col="momentum" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-right ${thCls("persistence20d")}`}
              style={TH_STYLE}
              onClick={() => handleSort("persistence20d")}
              title="Persistence: days in last 20 where this sub-sector outperformed its parent sector benchmark. Higher = more consistent outperformance."
            >
              Persist<SortArrow col="persistence20d" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th
              className={`px-4 py-3 text-center ${thCls("quadrant")}`}
              style={TH_STYLE}
              onClick={() => handleSort("quadrant")}
              title="RRG quadrant — click to group by rotation phase"
            >
              Signal<SortArrow col="quadrant" sortCol={sortCol} sortDir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((subSector, idx) => {
            const qConfig = subSector.rrgQuadrant ? QUADRANT_CONFIG[subSector.rrgQuadrant] : null;
            const rowBorderClass = qConfig?.rowBorderClass ?? "border-l-slate-700/40";
            const signal = (subSector.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(subSector);
            const signalCfg = signal ? TRADE_SIGNAL_CONFIG[signal] : null;
            return (
              <tr
                key={subSector.id}
                className={`hover:bg-slate-800/50 transition-colors text-slate-200 border-l-[3px] ${rowBorderClass}`}
              >
                <td
                  className="px-4 py-2.5 text-slate-500 tabular-nums text-xs"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {idx + 1}
                </td>
                <td
                  className="px-4 py-2.5 text-cyan-400 font-medium"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {subSector.etfTicker}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-200">{subSector.name}</td>
                <td className="px-4 py-2.5">
                  <ScoreBar score={subSector.compositeScore} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  {subSector.compositeTrend5d != null ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <TrendPip value={subSector.compositeTrend5d} label="5d trend" />
                      <TrendPip value={subSector.compositeTrend20d} label="20d trend" />
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-xs"><RsCell value={subSector.rs60} /></td>
                <td className="px-4 py-2.5 text-right text-xs"><RsCell value={subSector.rs20} /></td>
                <td className="px-4 py-2.5 text-right text-xs"><RsCell value={subSector.rs120} /></td>
                <td className="px-4 py-2.5 text-right text-xs"><AccelCell value={acceleration(subSector)} /></td>
                <td className="px-4 py-2.5 text-right text-xs">
                  {subSector.momentum != null ? (
                    <span
                      className={`tabular-nums ${subSector.momentum >= 0 ? "text-green-400" : "text-red-400"}`}
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      {subSector.momentum >= 0 ? "+" : ""}
                      {(subSector.momentum * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-xs">
                  <PersistenceCell value={subSector.persistence20d} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    {signalCfg ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${signalCfg.className}`}
                        style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.06em" }}
                        title={`Trade signal: ${signal} — derived from composite score, RRG quadrant, and 20d trend`}
                      >
                        {signalCfg.label}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                    {qConfig && (
                      <span
                        className={`text-[9px] ${qConfig.colorClass} opacity-70`}
                        style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.03em" }}
                      >
                        {qConfig.label}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-slate-700 text-[10px] text-slate-600 bg-slate-800/30">
        Click any column header to sort · RS values vs {parentEtfTicker} ({parentName}) · Accel = RS60 − RS120 (↗ building, ↘ fading) · Persist = days outperforming {parentEtfTicker} in last 20
      </div>
    </div>
  );
}
