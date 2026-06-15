"use client";

import { CategorySummary, ScoreDecompositionDto } from "@/lib/api";
import { useState } from "react";

type Props = {
  categories: CategorySummary[];
  scoreComponents: Record<string, ScoreDecompositionDto>;
};

type Column = {
  key: keyof ScoreDecompositionDto;
  label: string;
  abbr: string;
};

const COLUMNS: Column[] = [
  { key: "relativeStrength60Contribution", label: "RS-60", abbr: "RS60" },
  { key: "relativeStrength120Contribution", label: "RS-120", abbr: "RS120" },
  { key: "momentumContribution", label: "Momentum", abbr: "MOM" },
  { key: "persistence20dContribution", label: "Persistence", abbr: "PER" },
  { key: "macroFitContribution", label: "Macro Fit", abbr: "MAC" },
  { key: "rrgContribution", label: "RRG", abbr: "RRG" },
  { key: "flow20dContribution", label: "Flow", abbr: "FLO" },
];

function cellColor(value: number | null | undefined): string {
  if (value == null) return "bg-slate-800 text-slate-700";
  const v = Math.max(0, Math.min(1, value));
  if (v >= 0.75) return "bg-emerald-600/80 text-emerald-100";
  if (v >= 0.60) return "bg-emerald-800/70 text-emerald-300";
  if (v >= 0.48) return "bg-lime-900/60 text-lime-400";
  if (v >= 0.38) return "bg-yellow-900/60 text-yellow-400";
  if (v >= 0.25) return "bg-orange-900/60 text-orange-400";
  return "bg-red-900/60 text-red-400";
}

function signalColor(signal: string | null): string {
  switch (signal) {
    case "BUY":    return "text-emerald-400";
    case "WATCH":  return "text-cyan-400";
    case "HOLD":   return "text-slate-500";
    case "REDUCE": return "text-red-400";
    default:       return "text-slate-600";
  }
}

export default function ScoreComponentHeatmap({ categories, scoreComponents }: Props) {
  const [hoveredCell, setHoveredCell] = useState<{ catId: string; col: Column } | null>(null);

  const rows = categories
    .filter(c => scoreComponents[c.id] != null && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2" data-testid="score-component-heatmap">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Score Component Heatmap
        </h2>
        <span className="text-[10px] text-slate-600">contribution per factor · red→green</span>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 overflow-x-auto">
        {hoveredCell && (
          <div className="mb-2 text-[10px] text-slate-300 bg-slate-700/60 rounded px-2 py-1 inline-flex items-center gap-2">
            <span className="font-semibold">{rows.find(r => r.id === hoveredCell.catId)?.name}</span>
            <span className="text-slate-400">{hoveredCell.col.label}</span>
            <span className="font-mono text-emerald-400">
              {Math.round(((scoreComponents[hoveredCell.catId][hoveredCell.col.key] as number | null) ?? 0) * 100)}
            </span>
          </div>
        )}
        <table className="w-full border-separate border-spacing-[1px]">
          <thead>
            <tr>
              <th className="text-left pb-1.5 pr-2 w-10 shrink-0">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">ETF</span>
              </th>
              {COLUMNS.map(col => (
                <th key={col.key} className="text-center pb-1.5 min-w-[28px]">
                  <span className="text-[8px] text-slate-500 uppercase tracking-wider">{col.abbr}</span>
                </th>
              ))}
              <th className="text-center pb-1.5 min-w-[28px]">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider">TOT</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(cat => {
              const comp = scoreComponents[cat.id];
              return (
                <tr key={cat.id}>
                  <td className="pr-2 py-0.5">
                    <span className={`text-[9px] font-mono ${signalColor(cat.tradeSignal)}`}>
                      {cat.etfTicker.slice(0, 4)}
                    </span>
                  </td>
                  {COLUMNS.map(col => {
                    const val = comp[col.key] as number | null;
                    const pct = val != null ? Math.round(val * 100) : null;
                    const isHovered = hoveredCell?.catId === cat.id && hoveredCell.col.key === col.key;
                    return (
                      <td
                        key={col.key}
                        className={`text-center py-0.5 cursor-default transition-all ${cellColor(val)} ${isHovered ? "ring-1 ring-white/50" : ""}`}
                        style={{ width: "28px", height: "18px" }}
                        onMouseEnter={() => setHoveredCell({ catId: cat.id, col })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span className="text-[8px] tabular-nums">{pct ?? "—"}</span>
                      </td>
                    );
                  })}
                  <td
                    className={`text-center py-0.5 ${cellColor(comp.totalScore)}`}
                    style={{ width: "28px", height: "18px" }}
                  >
                    <span className="text-[8px] tabular-nums font-semibold">
                      {comp.totalScore != null ? Math.round(comp.totalScore * 100) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 flex items-center gap-3 text-[8px] text-slate-600 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-900/60 rounded-[1px] inline-block" /> &lt;25</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-900/60 rounded-[1px] inline-block" /> 25–38</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-yellow-900/60 rounded-[1px] inline-block" /> 38–48</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-lime-900/60 rounded-[1px] inline-block" /> 48–60</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-800/70 rounded-[1px] inline-block" /> 60–75</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-600/80 rounded-[1px] inline-block" /> &gt;75</span>
        </div>
      </div>
    </section>
  );
}
