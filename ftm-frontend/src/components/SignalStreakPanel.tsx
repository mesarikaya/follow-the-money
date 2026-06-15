import { CategorySummary } from "@/lib/api";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type StreakEntry = {
  id: string;
  name: string;
  etfTicker: string;
  signal: string;
  streakDays: number;
  convictionScore: number | null;
  compositeScore: number | null;
};

const SIGNAL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  BUY:    { text: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-700/40" },
  WATCH:  { text: "text-cyan-400",    bg: "bg-cyan-900/30",    border: "border-cyan-700/40" },
  HOLD:   { text: "text-slate-400",   bg: "bg-slate-800/30",   border: "border-slate-700/40" },
  REDUCE: { text: "text-red-400",     bg: "bg-red-900/30",     border: "border-red-700/40" },
};

function StreakBar({ days, maxDays }: { days: number; maxDays: number }) {
  const pct = Math.min(100, Math.round((days / maxDays) * 100));
  const color = days >= 20 ? "bg-emerald-500" : days >= 10 ? "bg-lime-500" : "bg-amber-500";
  return (
    <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SignalStreakPanel({ categories }: { categories: CategorySummary[] }) {
  const withStreak = categories
    .filter(c => c.scoreStreakDays != null && Math.abs(c.scoreStreakDays) >= 3 && c.tradeSignal != null)
    .map(c => ({
      id: c.id,
      name: c.name,
      etfTicker: c.etfTicker,
      signal: c.tradeSignal!,
      streakDays: c.scoreStreakDays!,
      convictionScore: c.convictionScore,
      compositeScore: c.compositeScore,
    }));

  const bullStreaks: StreakEntry[] = withStreak
    .filter(e => e.streakDays > 0 && (e.signal === "BUY" || e.signal === "WATCH"))
    .sort((a, b) => b.streakDays - a.streakDays)
    .slice(0, 5);

  const bearStreaks: StreakEntry[] = withStreak
    .filter(e => e.streakDays < 0 && (e.signal === "REDUCE" || e.signal === "HOLD"))
    .sort((a, b) => a.streakDays - b.streakDays)
    .slice(0, 3);

  if (bullStreaks.length === 0 && bearStreaks.length === 0) return null;

  const maxBull = Math.max(...bullStreaks.map(e => e.streakDays), 1);
  const maxBear = Math.max(...bearStreaks.map(e => Math.abs(e.streakDays)), 1);

  return (
    <section className="space-y-2" data-testid="signal-streak-panel">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Signal Streaks
        </h2>
        <span className="text-[10px] text-slate-600">consecutive days above/below signal threshold</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {bullStreaks.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-emerald-600 font-semibold uppercase tracking-widest mb-2">
              Bullish Streaks
            </div>
            <div className="space-y-2">
              {bullStreaks.map((entry, rank) => {
                const colors = SIGNAL_COLORS[entry.signal] ?? SIGNAL_COLORS.HOLD;
                const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(entry.id);
                return (
                  <div key={entry.id} className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-600 tabular-nums w-3 shrink-0">{rank + 1}</span>
                    <span className={`text-[9px] font-mono shrink-0 w-7 ${colors.text}`}>
                      {hasDrilldown ? (
                        <Link href={`/sectors/${entry.id}`} className="hover:text-white transition-colors">
                          {entry.etfTicker.slice(0, 4)}
                        </Link>
                      ) : entry.etfTicker.slice(0, 4)}
                    </span>
                    <StreakBar days={entry.streakDays} maxDays={maxBull} />
                    <span className="text-[9px] font-mono text-slate-300 tabular-nums w-8 shrink-0 text-right">
                      {entry.streakDays}d
                    </span>
                    {entry.convictionScore != null && (
                      <span className={`text-[8px] font-mono shrink-0 ${entry.convictionScore >= 70 ? "text-emerald-400" : entry.convictionScore >= 50 ? "text-amber-400" : "text-slate-600"}`}>
                        C{entry.convictionScore}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {bearStreaks.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5">
            <div className="text-[9px] text-red-700 font-semibold uppercase tracking-widest mb-2">
              Bearish Streaks
            </div>
            <div className="space-y-2">
              {bearStreaks.map((entry, rank) => {
                const colors = SIGNAL_COLORS[entry.signal] ?? SIGNAL_COLORS.HOLD;
                return (
                  <div key={entry.id} className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-600 tabular-nums w-3 shrink-0">{rank + 1}</span>
                    <span className={`text-[9px] font-mono shrink-0 w-7 ${colors.text}`}>
                      {entry.etfTicker.slice(0, 4)}
                    </span>
                    <StreakBar days={Math.abs(entry.streakDays)} maxDays={maxBear} />
                    <span className="text-[9px] font-mono text-slate-300 tabular-nums w-8 shrink-0 text-right">
                      {entry.streakDays}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
