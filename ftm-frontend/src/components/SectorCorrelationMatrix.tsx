"use client";

import { CategorySummary } from "@/lib/api";

function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;

  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA  += a[i];
    sumB  += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }
  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (den === 0) return null;
  return Math.max(-1, Math.min(1, num / den));
}

function corrColor(r: number | null): { bg: string; text: string } {
  if (r === null) return { bg: "bg-slate-800", text: "text-slate-600" };
  if (r >= 0.75)  return { bg: "bg-emerald-900/80", text: "text-emerald-300" };
  if (r >= 0.40)  return { bg: "bg-emerald-900/30", text: "text-emerald-500" };
  if (r >= 0.10)  return { bg: "bg-slate-700/40",   text: "text-slate-400"  };
  if (r >= -0.10) return { bg: "bg-slate-800/30",   text: "text-slate-500"  };
  if (r >= -0.40) return { bg: "bg-red-900/30",     text: "text-red-500"    };
  return              { bg: "bg-red-900/70",         text: "text-red-300"    };
}

type Props = {
  categories: CategorySummary[];
  scoreHistory: Record<string, number[]>;
};

export default function SectorCorrelationMatrix({ categories, scoreHistory }: Props) {
  const equities = categories.filter(c => c.type === "EQUITY_SECTOR" && scoreHistory[c.id]?.length >= 5);
  if (equities.length < 3) return null;

  const correlations: Record<string, Record<string, number | null>> = {};
  for (const a of equities) {
    correlations[a.id] = {};
    for (const b of equities) {
      correlations[a.id][b.id] = a.id === b.id ? 1 : pearsonCorrelation(scoreHistory[a.id], scoreHistory[b.id]);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Score Correlation Matrix</h2>
        <span className="text-[10px] text-slate-600" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          30d composite score · Pearson r
        </span>
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 overflow-x-auto">
        <table className="text-[10px] w-full" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          <thead>
            <tr>
              <th className="w-10 text-left py-1 px-1 text-slate-600" />
              {equities.map(cat => (
                <th key={cat.id} className="py-1 px-1 text-center text-slate-500 font-normal w-10" title={cat.name}>
                  {cat.etfTicker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equities.map(rowCat => (
              <tr key={rowCat.id}>
                <td className="py-0.5 px-1 text-slate-500 font-medium text-right pr-2 whitespace-nowrap" title={rowCat.name}>
                  {rowCat.etfTicker}
                </td>
                {equities.map(colCat => {
                  const r = rowCat.id === colCat.id ? 1 : correlations[rowCat.id][colCat.id];
                  const { bg, text } = corrColor(r);
                  const isDiag = rowCat.id === colCat.id;
                  return (
                    <td
                      key={colCat.id}
                      className={`py-0.5 px-0.5`}
                      title={isDiag ? rowCat.name : `${rowCat.etfTicker} vs ${colCat.etfTicker}: r=${r?.toFixed(2) ?? "n/a"}`}
                    >
                      <div className={`w-9 h-6 rounded flex items-center justify-center tabular-nums ${bg} ${text}`}>
                        {isDiag ? (
                          <span className="text-slate-600">—</span>
                        ) : r !== null ? (
                          r.toFixed(2)
                        ) : (
                          <span className="text-slate-700">·</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex items-center gap-4 text-[9px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-900/80 inline-block" />
            <span>Strong positive (r≥0.75)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-900/30 inline-block" />
            <span>Moderate positive</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-700/40 inline-block" />
            <span>Neutral</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-900/30 inline-block" />
            <span>Negative</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-900/70 inline-block" />
            <span>Strong negative (r≤−0.75)</span>
          </span>
          <span className="ml-auto">n ≥ 5 daily observations required</span>
        </div>
      </div>
    </section>
  );
}
