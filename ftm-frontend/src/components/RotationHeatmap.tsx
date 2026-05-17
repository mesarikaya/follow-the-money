"use client";

import { CategorySummary } from "@/lib/api";

const QUADRANT_LABELS: Record<string, string> = {
  "1": "↗ Leading",
  "2": "↖ Improving",
  "3": "↘ Weakening",
  "4": "↙ Lagging",
};

function compositeScoreToColor(score: number | null): string {
  if (score === null) return "bg-slate-700 border-slate-600";
  if (score >= 0.7) return "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
  if (score >= 0.5) return "bg-blue-500/15 border-blue-500/30 text-blue-300";
  if (score >= 0.3) return "bg-amber-500/15 border-amber-500/30 text-amber-300";
  return "bg-red-500/15 border-red-500/30 text-red-300";
}

function formatCompositeScore(score: number | null): string {
  if (score === null) return "—";
  return Math.round(score * 100).toString();
}

function rrgQuadrantLabel(quadrant: string | null): string {
  if (!quadrant) return "—";
  return QUADRANT_LABELS[quadrant] ?? quadrant;
}

type Props = { categories: CategorySummary[] };

export default function RotationHeatmap({ categories }: Props) {
  const sorted = [...categories].sort((categoryA, categoryB) => {
    const scoreA = categoryA.compositeScore ?? -1;
    const scoreB = categoryB.compositeScore ?? -1;
    return scoreB - scoreA;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
      {sorted.map((category) => (
        <div
          key={category.id}
          className={`border rounded-md px-3 py-2 flex flex-col gap-1 ${compositeScoreToColor(category.compositeScore)}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{category.id}</span>
            <span className="text-xs font-mono font-bold">
              {formatCompositeScore(category.compositeScore)}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">{category.name}</p>
          <p className="text-xs text-slate-500">{rrgQuadrantLabel(category.rrgQuadrant)}</p>
        </div>
      ))}
    </div>
  );
}
