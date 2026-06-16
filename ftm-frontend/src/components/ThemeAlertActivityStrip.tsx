import Link from "next/link";
import { ThemeSummary } from "@/lib/api";

function heatColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return "bg-slate-800/60 border-slate-700/40";
  const intensity = count / maxCount;
  if (intensity >= 0.75) return "bg-red-900/40 border-red-700/50";
  if (intensity >= 0.50) return "bg-amber-900/30 border-amber-700/40";
  if (intensity >= 0.25) return "bg-yellow-900/20 border-yellow-800/30";
  return "bg-slate-800/50 border-slate-700/30";
}

function heatDotColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return "bg-slate-600";
  const intensity = count / maxCount;
  if (intensity >= 0.75) return "bg-red-500 animate-pulse";
  if (intensity >= 0.50) return "bg-amber-500";
  if (intensity >= 0.25) return "bg-yellow-500";
  return "bg-slate-500";
}

function heatLabel(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return "quiet";
  const intensity = count / maxCount;
  if (intensity >= 0.75) return "hot";
  if (intensity >= 0.50) return "active";
  if (intensity >= 0.25) return "warm";
  return "low";
}

export default function ThemeAlertActivityStrip({ themes }: { themes: ThemeSummary[] }) {
  const withAlerts = themes.filter(t => t.alertCount30d > 0);
  if (withAlerts.length === 0) return null;

  const sorted = [...withAlerts].sort((a, b) => b.alertCount30d - a.alertCount30d).slice(0, 8);
  const maxCount = sorted[0].alertCount30d;
  const totalFires = themes.reduce((sum, t) => sum + t.alertCount30d, 0);

  return (
    <div
      data-testid="theme-alert-activity-strip"
      className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Alert Activity — 30 Days
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-600">
          {totalFires} signals · {withAlerts.length} themes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {sorted.map(t => {
          const signal = { BUY: "text-emerald-400", WATCH: "text-cyan-400", HOLD: "text-slate-400", REDUCE: "text-red-400" }[t.dominantSignal] ?? "text-slate-400";
          const barPct = Math.round((t.alertCount30d / maxCount) * 100);
          return (
            <Link
              key={t.id}
              href={`/themes/${t.id}`}
              className={`rounded border px-2 py-2 block hover:opacity-90 transition-opacity ${heatColor(t.alertCount30d, maxCount)}`}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-semibold text-slate-200 leading-tight line-clamp-2 flex-1 min-w-0">
                  {t.name}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${heatDotColor(t.alertCount30d, maxCount)}`} />
              </div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="flex-1 h-1 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500/70"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono tabular-nums text-amber-400 shrink-0">
                  {t.alertCount30d}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-mono ${signal}`}>{t.dominantSignal}</span>
                <span className="text-[9px] font-mono text-slate-600">·</span>
                <span className="text-[9px] font-mono text-slate-600">
                  {heatLabel(t.alertCount30d, maxCount)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
