import { fetchCategories, fetchMacro, fetchMacroHistory } from "@/lib/api";
import { MacroHistory, computeMacroStress } from "@/lib/macro/macroMetrics";
import { INDICATOR_LABELS, REGIME_DESCRIPTIONS, REGIME_STYLES } from "@/components/macro/regimeConfig";
import {
  IndicatorCard,
  MacroStressMeter,
  RealYieldCard,
  YieldCurveChart,
} from "@/components/macro/indicators";
import {
  RegimeAlignmentTable,
  RegimePlaybook,
  RegimeTimeline,
} from "@/components/macro/panels";
import type { MacroIndicators } from "@/lib/api";

const HISTORY_DAYS = 365;

const UNSTYLED_REGIME = {
  label: "UNKNOWN",
  color: "text-slate-400",
  ring: "border-slate-600",
  bg: "bg-slate-800/50",
};

export default async function MacroRegimePage() {
  const [macroResult, categoriesResult, historyResult] = await Promise.allSettled([
    fetchMacro(),
    fetchCategories("MONTH"),
    fetchMacroHistory(HISTORY_DAYS),
  ]);

  const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.categories : [];
  const indicatorHistory: MacroHistory =
    historyResult.status === "fulfilled" ? historyResult.value : {};
  const error =
    macroResult.status === "rejected"
      ? String((macroResult as PromiseRejectedResult).reason)
      : null;

  const regime = macro?.regime ?? "UNKNOWN";
  const style = REGIME_STYLES[regime] ?? { ...UNSTYLED_REGIME, label: regime };
  const hasHistory = Object.keys(indicatorHistory).length > 0;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Macro Regime
          </h1>
          {macro && (
            <span className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-semibold ${style.ring} ${style.color} ${style.bg}`}>
              {style.label}
            </span>
          )}
        </div>
        {macro?.asOfDate && <span className="text-xs text-slate-500">Data as of {macro.asOfDate}</span>}
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load macro data: {error}
          </div>
        )}

        {macro && (
          <>
            <section className="space-y-3">
              <div className={`flex items-start gap-4 px-4 py-4 rounded-xl border ${style.ring} ${style.bg}`}>
                <div className="flex-1">
                  <div className={`text-lg font-semibold ${style.color}`}>{style.label}</div>
                  <p className="text-sm text-slate-400 mt-1">
                    {REGIME_DESCRIPTIONS[regime] ?? "No description available for this regime."}
                  </p>
                </div>
              </div>
            </section>

            {hasHistory && <MacroStressMeter {...computeMacroStress(indicatorHistory, macro.indicators)} />}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-300">Indicators</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(Object.keys(INDICATOR_LABELS) as (keyof MacroIndicators)[]).map(key => (
                  <IndicatorCard
                    key={key}
                    indicatorKey={key}
                    value={macro.indicators[key] ?? null}
                    previousValue={macro.previousIndicators?.[key] ?? null}
                    history={indicatorHistory[INDICATOR_LABELS[key].series] ?? []}
                  />
                ))}
                <YieldCurveChart indicators={macro.indicators} />
                <RealYieldCard indicators={macro.indicators} history={indicatorHistory} />
              </div>
            </section>

            <RegimeTimeline history={macro.regimeHistory} />
            <RegimePlaybook regime={regime} />
            {categories.length > 0 && <RegimeAlignmentTable categories={categories} regime={regime} />}
          </>
        )}
      </main>
    </div>
  );
}
