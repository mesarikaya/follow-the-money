import Link from "next/link";
import { fetchThemePortfolioCoverage, ThemePortfolioCoverage } from "@/lib/api";

export const dynamic = "force-dynamic";

const SIGNAL_COLOR: Record<string, string> = {
  BUY: "text-emerald-400",
  WATCH: "text-sky-400",
  HOLD: "text-amber-400",
  REDUCE: "text-red-400",
};

const SIGNAL_BG: Record<string, string> = {
  BUY: "bg-emerald-900/30 border-emerald-700/40",
  WATCH: "bg-sky-900/30 border-sky-700/40",
  HOLD: "bg-amber-900/30 border-amber-700/40",
  REDUCE: "bg-red-900/30 border-red-700/40",
};

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-slate-600 text-xs">—</span>;
  const color = SIGNAL_COLOR[signal] ?? "text-slate-400";
  const bg = SIGNAL_BG[signal] ?? "bg-slate-700/30 border-slate-600/40";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${bg} ${color}`}>
      {signal}
    </span>
  );
}

function ScoreDot({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.65
      ? "bg-emerald-500"
      : score >= 0.5
      ? "bg-sky-500"
      : score >= 0.35
      ? "bg-amber-500"
      : "bg-red-600";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-xs font-mono text-slate-300">{pct}</span>
    </div>
  );
}

function CoverageRow({ theme }: { theme: ThemePortfolioCoverage }) {
  return (
    <tr className="border-b border-slate-700/40 hover:bg-slate-800/30 transition-colors">
      <td className="py-2.5 pr-4">
        <Link
          href={`/themes/${theme.themeId}`}
          className="text-slate-200 text-sm font-medium hover:text-sky-400 transition-colors"
        >
          {theme.themeName}
        </Link>
        {theme.themePhase && (
          <div className="text-[10px] text-slate-500 mt-0.5">{theme.themePhase}</div>
        )}
      </td>
      <td className="py-2.5 pr-4">
        <SignalBadge signal={theme.dominantSignal} />
      </td>
      <td className="py-2.5 pr-4">
        <ScoreDot score={theme.compositeScore} />
      </td>
      <td className="py-2.5 pr-4">
        {theme.covered ? (
          <div className="flex flex-wrap gap-1">
            {theme.coveringTickers.map(ticker => (
              <span
                key={ticker}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 text-emerald-300"
              >
                {ticker}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-slate-600 italic">none</span>
        )}
      </td>
      <td className="py-2.5 text-right">
        {theme.portfolioExposurePct > 0 ? (
          <span className="text-xs text-emerald-400 font-mono">
            {theme.portfolioExposurePct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}

export default async function ThemeCoveragePage() {
  const coverage = await fetchThemePortfolioCoverage().catch(() => []);

  const gapOpportunities = coverage
    .filter(t => !t.covered && (t.dominantSignal === "BUY" || t.dominantSignal === "WATCH"))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const coveredThemes = coverage
    .filter(t => t.covered)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const neutralGaps = coverage
    .filter(t => !t.covered && t.dominantSignal !== "BUY" && t.dominantSignal !== "WATCH")
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/themes" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Themes
          </Link>
          <h1 className="text-xl font-bold text-slate-100 mt-1">Portfolio Theme Coverage</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Which investment themes are represented in your portfolio, and where are the gaps?
          </p>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-100">{coveredThemes.length}</div>
            <div className="text-[10px] text-slate-500">covered</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">{gapOpportunities.length}</div>
            <div className="text-[10px] text-slate-500">gap opportunities</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-500">{coverage.length}</div>
            <div className="text-[10px] text-slate-500">total themes</div>
          </div>
        </div>
      </div>

      {gapOpportunities.length > 0 && (
        <section data-testid="gap-opportunities-section">
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            Gap Opportunities ({gapOpportunities.length})
            <span className="text-slate-500 font-normal text-[10px]">
              BUY/WATCH themes not in portfolio
            </span>
          </h2>
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800/80">
                <tr>
                  <th className="text-[10px] text-slate-500 font-medium py-2 px-4">Theme</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4">Signal</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4">Score</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4">Coverage</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4 text-right">Exposure</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900/50 divide-y divide-slate-700/30">
                {gapOpportunities.map(t => (
                  <CoverageRow key={t.themeId} theme={t} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {coveredThemes.length > 0 && (
        <section data-testid="covered-themes-section">
          <h2 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            Covered Themes ({coveredThemes.length})
          </h2>
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800/80">
                <tr>
                  <th className="text-[10px] text-slate-500 font-medium py-2 px-4">Theme</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4">Signal</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4">Score</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4">Covering positions</th>
                  <th className="text-[10px] text-slate-500 font-medium py-2 pr-4 text-right">Exposure</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900/50 divide-y divide-slate-700/30">
                {coveredThemes.map(t => (
                  <CoverageRow key={t.themeId} theme={t} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {neutralGaps.length > 0 && (
        <section data-testid="neutral-gaps-section">
          <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-600" />
            Other themes ({neutralGaps.length})
            <span className="text-slate-600 font-normal text-[10px]">not in portfolio, HOLD/REDUCE signal</span>
          </h2>
          <div className="border border-slate-700/40 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800/60">
                <tr>
                  <th className="text-[10px] text-slate-600 font-medium py-2 px-4">Theme</th>
                  <th className="text-[10px] text-slate-600 font-medium py-2 pr-4">Signal</th>
                  <th className="text-[10px] text-slate-600 font-medium py-2 pr-4">Score</th>
                  <th className="text-[10px] text-slate-600 font-medium py-2 pr-4">Coverage</th>
                  <th className="text-[10px] text-slate-600 font-medium py-2 pr-4 text-right">Exposure</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900/30 divide-y divide-slate-700/20">
                {neutralGaps.map(t => (
                  <CoverageRow key={t.themeId} theme={t} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {coverage.length === 0 && (
        <div className="text-slate-500 text-sm text-center py-12">
          No theme data available.
        </div>
      )}
    </div>
  );
}
