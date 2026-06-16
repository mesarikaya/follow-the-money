"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SIGNALS = [
  { key: "BUY",    activeClass: "bg-emerald-500/25 border-emerald-500/50 text-emerald-400", hoverClass: "hover:border-emerald-500/30 hover:text-emerald-500" },
  { key: "WATCH",  activeClass: "bg-cyan-500/25 border-cyan-500/50 text-cyan-400",          hoverClass: "hover:border-cyan-500/30 hover:text-cyan-500" },
  { key: "HOLD",   activeClass: "bg-slate-600/50 border-slate-500 text-slate-300",          hoverClass: "hover:border-slate-500 hover:text-slate-400" },
  { key: "REDUCE", activeClass: "bg-red-500/25 border-red-500/50 text-red-400",             hoverClass: "hover:border-red-500/30 hover:text-red-500" },
] as const;

const PHASES = [
  { key: "BREAKOUT", label: "Breakout" },
  { key: "MOMENTUM", label: "Momentum" },
  { key: "SETUP",    label: "Setup" },
  { key: "FADING",   label: "Fading" },
  { key: "WEAK",     label: "Weak" },
] as const;

const STREAK_THRESHOLDS = [5, 10, 15] as const;

export default function ScreenerFilterBar({
  activeSignals,
  activePhase,
  minStreak,
}: {
  activeSignals: string[];
  activePhase: string | null;
  minStreak: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`/themes?${params.toString()}`);
  }

  function toggleSignal(signal: string) {
    const next = activeSignals.includes(signal)
      ? activeSignals.filter(s => s !== signal)
      : [...activeSignals, signal];
    navigate({ signal: next.length > 0 ? next.join(",") : null });
  }

  function togglePhase(phase: string) {
    navigate({ phase: activePhase === phase ? null : phase });
  }

  function toggleStreak(days: number) {
    navigate({ minStreak: minStreak === days ? null : String(days) });
  }

  const hasFilters = activeSignals.length > 0 || activePhase != null || minStreak != null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2 px-3 bg-slate-800/20 border-b border-slate-700/40" data-testid="screener-filter-bar">
      <span className="text-[9px] uppercase tracking-wider text-slate-600 font-mono mr-1">Filter:</span>

      {SIGNALS.map(({ key, activeClass, hoverClass }) => {
        const isActive = activeSignals.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggleSignal(key)}
            data-testid={`filter-signal-${key.toLowerCase()}`}
            className={`text-[9px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              isActive
                ? activeClass
                : `bg-slate-800 border-slate-700 text-slate-500 ${hoverClass}`
            }`}
          >
            {key}
          </button>
        );
      })}

      <div className="w-px h-3 bg-slate-700/60 mx-0.5" aria-hidden />

      {PHASES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => togglePhase(key)}
          data-testid={`filter-phase-${key.toLowerCase()}`}
          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            activePhase === key
              ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
              : "bg-slate-800 border-slate-700 text-slate-500 hover:border-sky-500/30 hover:text-sky-400"
          }`}
        >
          {label}
        </button>
      ))}

      <div className="w-px h-3 bg-slate-700/60 mx-0.5" aria-hidden />

      {STREAK_THRESHOLDS.map(days => (
        <button
          key={days}
          onClick={() => toggleStreak(days)}
          data-testid={`filter-streak-${days}`}
          title={`Show only themes with ≥${days} consecutive signal days`}
          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            minStreak === days
              ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
              : "bg-slate-800 border-slate-700 text-slate-500 hover:border-violet-500/30 hover:text-violet-400"
          }`}
        >
          ≥{days}d
        </button>
      ))}

      {hasFilters && (
        <button
          onClick={() => navigate({ signal: null, phase: null, minStreak: null })}
          data-testid="filter-clear"
          className="text-[9px] font-mono text-slate-500 hover:text-slate-300 transition-colors ml-1 underline underline-offset-2 cursor-pointer"
        >
          clear
        </button>
      )}
    </div>
  );
}
