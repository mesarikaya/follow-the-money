import Link from "next/link";
import { ThemeDetail } from "@/lib/api";
import { SIGNAL_CONFIG, scoreColor } from "@/components/themes/compare/cells";

/** Shown until two themes are chosen: pick the first, then the second. */

export function ThemePickerPage({
  themes,
  firstTheme,
}: {
  themes: { id: string; name: string; dominantSignal: string; compositeScore: number | null }[];
  firstTheme?: ThemeDetail;
}) {
  const sortedThemes = [...themes].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/themes" className="text-[11px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
            ← themes
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-[11px] font-mono text-slate-600">compare</span>
        </div>

        <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
          Compare Themes
        </h1>
        <p className="text-slate-400 text-sm mb-5">
          {firstTheme
            ? `Compare ${firstTheme.name} with another theme — pick one below.`
            : "Select two themes for a side-by-side metric comparison."}
        </p>

        {firstTheme && (
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Comparing</div>
              <span className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-rajdhani)" }}>
                {firstTheme.name}
              </span>
            </div>
            <Link href="/themes/compare" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
              clear ✕
            </Link>
          </div>
        )}

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700/40 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {firstTheme ? "Pick second theme" : "Pick first theme"}
          </div>
          <div className="divide-y divide-slate-700/20">
            {sortedThemes
              .filter(t => !firstTheme || t.id !== firstTheme.id)
              .map(t => {
                const sigCfg = SIGNAL_CONFIG[t.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
                const href = firstTheme
                  ? `/themes/compare?a=${firstTheme.id}&b=${t.id}`
                  : `/themes/compare?a=${t.id}`;
                return (
                  <Link
                    key={t.id}
                    href={href}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors"
                    data-testid={`picker-theme-${t.id}`}
                  >
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${sigCfg.bg} ${sigCfg.color} shrink-0`}>
                      {t.dominantSignal}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-200 flex-1">{t.name}</span>
                    <span className={`text-[10px] font-mono tabular-nums shrink-0 ${scoreColor(t.compositeScore)}`}>
                      {t.compositeScore != null ? Math.round(t.compositeScore * 100) : "—"}
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </main>
  );
}
