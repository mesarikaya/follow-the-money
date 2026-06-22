import Link from "next/link";
import { fetchThemeCorrelation, ThemeCorrelationMatrix } from "@/lib/api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function correlationColor(r: number): string {
  if (r >= 0.7) return "bg-emerald-600/80";
  if (r >= 0.5) return "bg-emerald-700/60";
  if (r >= 0.3) return "bg-emerald-800/40";
  if (r >= 0.1) return "bg-slate-700/40";
  if (r > -0.1) return "bg-slate-700/20";
  if (r > -0.3) return "bg-red-900/30";
  if (r > -0.5) return "bg-red-800/50";
  return "bg-red-700/70";
}

function correlationTextColor(r: number): string {
  if (r >= 0.5) return "text-emerald-300";
  if (r >= 0.1) return "text-slate-400";
  if (r > -0.1) return "text-slate-600";
  if (r > -0.5) return "text-red-400";
  return "text-red-300";
}

function CorrelationLegend() {
  return (
    <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
      <span className="text-slate-600 uppercase tracking-wider">Co-movement:</span>
      {[
        { label: "Strong ↑", cls: "bg-emerald-600/80" },
        { label: "Moderate ↑", cls: "bg-emerald-800/40" },
        { label: "Neutral", cls: "bg-slate-700/20" },
        { label: "Moderate ↓", cls: "bg-red-800/50" },
        { label: "Strong ↓", cls: "bg-red-700/70" },
      ].map(({ label, cls }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`inline-block w-3 h-3 rounded-sm ${cls} border border-slate-700/30`} />
          {label}
        </span>
      ))}
    </div>
  );
}

type CellProps = {
  r: number;
  themeIdA: string;
  themeIdB: string;
  isDiagonal: boolean;
};

function CorrelationCell({ r, themeIdA, themeIdB, isDiagonal }: CellProps) {
  const formatted = r.toFixed(2);
  if (isDiagonal) {
    return (
      <td className="p-0">
        <div className="w-[52px] h-[28px] flex items-center justify-center bg-slate-700/50 border border-slate-600/30">
          <span className="text-[9px] font-mono text-slate-400 font-semibold">1.00</span>
        </div>
      </td>
    );
  }
  return (
    <td className="p-0">
      <Link
        href={`/themes/compare?a=${themeIdA}&b=${themeIdB}`}
        title={`r = ${formatted} · Click to compare ${themeIdA} vs ${themeIdB}`}
        data-testid={`corr-cell-${themeIdA}-${themeIdB}`}
        className={`w-[52px] h-[28px] flex items-center justify-center border border-slate-700/20 hover:border-slate-500/60 transition-colors cursor-pointer ${correlationColor(r)}`}
      >
        <span className={`text-[9px] font-mono ${correlationTextColor(r)}`}>{formatted}</span>
      </Link>
    </td>
  );
}

function CorrelationHeatmap({ data }: { data: ThemeCorrelationMatrix }) {
  const { themeIds, themeNames, matrix } = data;
  const shortNames = themeNames.map(n => {
    if (n.length <= 14) return n;
    const words = n.split(" ");
    return words.slice(0, 2).join(" ");
  });

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse" data-testid="correlation-heatmap">
        <thead>
          <tr>
            <th className="w-[120px]" />
            {themeIds.map((id, j) => (
              <th key={id} className="w-[52px] pb-1">
                <div
                  className="text-[7px] font-mono text-slate-500 uppercase tracking-wide writing-mode-vertical truncate"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60, overflow: "hidden" }}
                  title={themeNames[j]}
                >
                  {shortNames[j]}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {themeIds.map((rowId, i) => (
            <tr key={rowId}>
              <td className="pr-2 py-0">
                <Link
                  href={`/themes/${rowId}`}
                  className="text-[9px] font-mono text-slate-400 hover:text-slate-200 transition-colors truncate block text-right"
                  title={themeNames[i]}
                >
                  {shortNames[i]}
                </Link>
              </td>
              {themeIds.map((colId, j) => (
                <CorrelationCell
                  key={colId}
                  r={matrix[i][j]}
                  themeIdA={rowId}
                  themeIdB={colId}
                  isDiagonal={i === j}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightSummary({ data }: { data: ThemeCorrelationMatrix }) {
  const { themeIds, themeNames, matrix } = data;
  const n = themeIds.length;

  let maxR = -Infinity, minR = Infinity;
  let maxPair = ["", ""], minPair = ["", ""];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = matrix[i][j];
      if (r > maxR) { maxR = r; maxPair = [themeNames[i], themeNames[j]]; }
      if (r < minR) { minR = r; minPair = [themeNames[i], themeNames[j]]; }
    }
  }

  const avgOff = n > 1
    ? themeIds.reduce((sum, _, i) =>
        sum + themeIds.reduce((s, _, j) => i !== j ? s + matrix[i][j] : s, 0), 0)
      / (n * (n - 1))
    : 0;

  return (
    <div
      className="grid grid-cols-3 gap-3"
      data-testid="correlation-insights"
    >
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Avg co-movement</div>
        <div className={`text-xl font-bold font-mono ${avgOff >= 0.3 ? "text-amber-400" : avgOff >= 0 ? "text-slate-300" : "text-emerald-400"}`}>
          {avgOff.toFixed(2)}
        </div>
        <div className="text-[9px] text-slate-600 mt-0.5">
          {avgOff >= 0.5 ? "High clustering — themes move together" :
           avgOff >= 0.2 ? "Moderate clustering — partial diversification" :
           "Low clustering — themes diverge"}
        </div>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Most correlated</div>
        <div className="text-[10px] font-semibold text-emerald-300 leading-tight">{maxPair.join(" · ")}</div>
        <div className="text-[9px] font-mono text-emerald-500 mt-0.5">r = {maxR.toFixed(2)}</div>
        <div className="text-[9px] text-slate-600 mt-0.5">Signals fire together — low diversification benefit</div>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Least correlated</div>
        <div className="text-[10px] font-semibold text-red-300 leading-tight">{minPair.join(" · ")}</div>
        <div className="text-[9px] font-mono text-red-500 mt-0.5">r = {minR.toFixed(2)}</div>
        <div className="text-[9px] text-slate-600 mt-0.5">Signals diverge — maximum diversification benefit</div>
      </div>
    </div>
  );
}

export default async function ThemeCorrelationPage() {
  const data = await fetchThemeCorrelation(60).catch(() => null);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1">
              <Link href="/themes" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">
                ← Themes
              </Link>
            </div>
            <h1 className="text-lg font-bold text-slate-100">Signal Co-Movement Matrix</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pearson correlation of daily score deltas (60d) · measures when theme signals fire together, not return correlation
            </p>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">themes</div>
            <div className="text-2xl font-bold font-mono text-slate-300">{data.themeIds.length}</div>
          </div>
        </div>

        <InsightSummary data={data} />

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200">Co-Movement Heatmap</h2>
            <CorrelationLegend />
          </div>
          <CorrelationHeatmap data={data} />
          <p className="text-[9px] text-slate-700 mt-4">
            Click any cell to open a side-by-side comparison of the two themes. Row/column labels link to individual theme pages.
          </p>
        </div>
      </div>
    </div>
  );
}
