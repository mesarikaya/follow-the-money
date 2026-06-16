import type { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

type ForecastEntry = {
  theme: ThemeSummary;
  current: number;
  projected5d: number;
  label: "APPROACHING_BUY" | "BUILDING" | "SLOW_CLIMB";
};

const BUY_THRESHOLD = 0.65;

function forecastLabel(current: number, p5: number, p10: number): ForecastEntry["label"] {
  if (p5 >= BUY_THRESHOLD) return "APPROACHING_BUY";
  if (p10 >= BUY_THRESHOLD) return "BUILDING";
  return "SLOW_CLIMB";
}

const LABEL_STYLES: Record<ForecastEntry["label"], { text: string; badge: string; bar: string }> = {
  APPROACHING_BUY: {
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bar: "bg-emerald-500",
  },
  BUILDING: {
    text: "text-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    bar: "bg-cyan-500",
  },
  SLOW_CLIMB: {
    text: "text-slate-400",
    badge: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    bar: "bg-slate-500",
  },
};

const LABEL_TEXT: Record<ForecastEntry["label"], string> = {
  APPROACHING_BUY: "Approaching BUY",
  BUILDING: "Building",
  SLOW_CLIMB: "Slow Climb",
};

export default function ThemeMomentumForecast({ themes }: Props) {
  const entries: ForecastEntry[] = themes
    .filter(t => {
      const score = t.compositeScore ?? 0;
      const trend5d = t.compositeTrend5d ?? 0;
      return score >= 0.40 && score < BUY_THRESHOLD && trend5d > 0;
    })
    .map(t => {
      const current = t.compositeScore!;
      const trend5d = t.compositeTrend5d!;
      const projected5d = Math.min(0.99, current + trend5d * 5);
      const projected10d = Math.min(0.99, current + trend5d * 10);
      return {
        theme: t,
        current,
        projected5d,
        label: forecastLabel(current, projected5d, projected10d),
      };
    })
    .sort((a, b) => b.projected5d - a.projected5d)
    .slice(0, 4);

  if (entries.length === 0) return null;

  return (
    <section
      className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-4"
      data-testid="theme-momentum-forecast"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Momentum Forecast</h2>
        <span className="text-xs text-slate-500">5–10d score projection via 5d trend</span>
      </div>

      <div className="space-y-3">
        {entries.map(({ theme, current, projected5d, label }) => {
          const styles = LABEL_STYLES[label];
          const currentPct = (current / BUY_THRESHOLD) * 100;
          const projPct = Math.min((projected5d / BUY_THRESHOLD) * 100, 100);
          return (
            <div key={theme.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs text-slate-300 truncate min-w-0"
                  title={theme.name}
                >
                  {theme.name}
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${styles.badge}`}
                >
                  {LABEL_TEXT[label]}
                </span>
              </div>
              <div className="relative h-4 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-4 rounded-full opacity-30 ${styles.bar}`}
                  style={{ width: `${projPct}%` }}
                />
                <div
                  className={`absolute top-0 left-0 h-4 rounded-full ${styles.bar}`}
                  style={{ width: `${currentPct}%` }}
                />
                <div
                  className="absolute top-0 h-4 w-0.5 bg-emerald-400/70"
                  style={{ left: "100%" }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-slate-500">
                  now {(current * 100).toFixed(0)}
                </span>
                <span className={styles.text}>
                  →5d {(projected5d * 100).toFixed(0)}
                </span>
                <span className="text-emerald-600 text-[9px]">BUY@65</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
