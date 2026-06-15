"use client";

import { ScoreDecompositionDto } from "@/lib/api";

type Segment = {
  key: keyof Omit<ScoreDecompositionDto, "categoryId" | "totalScore">;
  label: string;
  shortLabel: string;
  color: string;
};

const SEGMENTS: Segment[] = [
  { key: "relativeStrength60Contribution", label: "RS-60 (25%)", shortLabel: "RS60", color: "#6366f1" },
  { key: "relativeStrength120Contribution", label: "RS-120 (10%)", shortLabel: "RS120", color: "#8b5cf6" },
  { key: "persistence20dContribution", label: "Persistence (20%)", shortLabel: "PERS", color: "#10b981" },
  { key: "flow20dContribution", label: "Flow-20D (10%)", shortLabel: "FLOW", color: "#0ea5e9" },
  { key: "momentumContribution", label: "Momentum (15%)", shortLabel: "MOM", color: "#f59e0b" },
  { key: "macroFitContribution", label: "MacroFit (10%)", shortLabel: "MACRO", color: "#a855f7" },
  { key: "rrgContribution", label: "RRG (10%)", shortLabel: "RRG", color: "#14b8a6" },
];

type Props = {
  decomposition: ScoreDecompositionDto;
  showLabels?: boolean;
};

export default function ScoreBreakdownBar({ decomposition, showLabels = false }: Props) {
  const total = decomposition.totalScore ?? 0;
  if (total === 0) return null;

  const tooltipLines = SEGMENTS.map((s) => {
    const value = decomposition[s.key];
    if (value == null) return `${s.label}: n/a`;
    const contribution = Math.round((value / total) * 100);
    return `${s.label}: ${contribution}% of score`;
  }).join("\n");

  return (
    <div
      className="flex flex-col gap-0.5"
      title={`Score factor breakdown (total: ${Math.round(total * 100)})\n${tooltipLines}`}
      data-testid="score-breakdown-bar"
    >
      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-slate-700/60 gap-px">
        {SEGMENTS.map((s) => {
          const value = decomposition[s.key];
          if (value == null) return null;
          const widthPct = (value / total) * 100;
          return (
            <div
              key={s.key}
              style={{ width: `${widthPct.toFixed(1)}%`, backgroundColor: s.color }}
              className="h-full shrink-0"
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="flex gap-1.5 flex-wrap">
          {SEGMENTS.map((s) => {
            const value = decomposition[s.key];
            if (value == null) return null;
            const contribution = Math.round((value / total) * 100);
            return (
              <span
                key={s.key}
                className="text-[8px] tabular-nums text-slate-500"
                style={{ color: s.color }}
              >
                {s.shortLabel}:{contribution}%
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
