"use client";

import { CategorySummary } from "@/lib/api";
import { useState } from "react";

type Props = {
  categories: CategorySummary[];
  scoreHistory: Record<string, number[]>;
};

type CellInfo = {
  day: number;
  score: number;
  categoryName: string;
  date: string;
};

function scoreToColor(score: number): string {
  if (score >= 0.72) return "bg-emerald-500";
  if (score >= 0.60) return "bg-emerald-700";
  if (score >= 0.50) return "bg-lime-800/80";
  if (score >= 0.42) return "bg-yellow-900/80";
  if (score >= 0.30) return "bg-orange-900/80";
  return "bg-red-900";
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

function buildDayLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ScoreTimelineGrid({ categories, scoreHistory }: Props) {
  const [tooltip, setTooltip] = useState<CellInfo | null>(null);

  const rows = categories
    .filter(c => c.compositeScore != null && (scoreHistory[c.id]?.length ?? 0) >= 5)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 15);

  if (rows.length === 0) return null;

  const maxDays = Math.min(30, Math.max(...rows.map(r => scoreHistory[r.id]?.length ?? 0)));

  return (
    <section className="space-y-2" data-testid="score-timeline-grid">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          30-Day Score Timeline
        </h2>
        <span className="text-[10px] text-slate-600">daily composite score · red→yellow→green</span>
      </div>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 overflow-x-auto">
        {tooltip && (
          <div className="mb-2 text-[10px] text-slate-300 bg-slate-700/60 rounded px-2 py-1 inline-flex items-center gap-2">
            <span className="text-slate-400">{tooltip.date}</span>
            <span className="font-semibold">{tooltip.categoryName}</span>
            <span className="font-mono text-emerald-400">{Math.round(tooltip.score * 100)}</span>
          </div>
        )}
        <div className="space-y-1">
          {rows.map(cat => {
            const history = scoreHistory[cat.id] ?? [];
            const days = history.slice(-maxDays);
            const trendPts = cat.compositeTrend5d != null ? Math.round(cat.compositeTrend5d * 100) : null;

            return (
              <div key={cat.id} className="flex items-center gap-1.5">
                <span className={`text-[9px] font-mono w-8 shrink-0 ${signalColor(cat.tradeSignal)}`}>
                  {cat.etfTicker.slice(0, 4)}
                </span>
                <div className="flex items-center gap-[2px]">
                  {days.map((score, i) => {
                    const daysAgo = days.length - 1 - i;
                    return (
                      <div
                        key={i}
                        className={`w-[6px] h-[14px] rounded-[1px] cursor-default ${scoreToColor(score)} hover:ring-1 hover:ring-white/40`}
                        onMouseEnter={() =>
                          setTooltip({
                            day: i,
                            score,
                            categoryName: cat.name,
                            date: buildDayLabel(daysAgo),
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
                <span className="text-[9px] font-mono text-slate-500 w-5 shrink-0 text-right">
                  {Math.round((cat.compositeScore ?? 0) * 100)}
                </span>
                {trendPts != null && (
                  <span className={`text-[8px] font-mono shrink-0 ${trendPts > 0 ? "text-emerald-600" : trendPts < 0 ? "text-red-600" : "text-slate-600"}`}>
                    {trendPts > 0 ? `+${trendPts}` : trendPts}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[8px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-900 rounded-[1px] inline-block" /> &lt;30</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-900/80 rounded-[1px] inline-block" /> 30–42</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-yellow-900/80 rounded-[1px] inline-block" /> 42–50</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-lime-800/80 rounded-[1px] inline-block" /> 50–60</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-700 rounded-[1px] inline-block" /> 60–72</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 rounded-[1px] inline-block" /> &gt;72</span>
        </div>
      </div>
    </section>
  );
}
