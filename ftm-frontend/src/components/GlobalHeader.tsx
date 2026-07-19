"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import TimeframeSelector from "@/components/TimeframeSelector";
import RefreshButton from "@/components/RefreshButton";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { fetchActiveAlertCount, CategorySummary } from "@/lib/api";

type SignalChip = {
  id: string;
  etfTicker: string;
  score: number;
  quadrant: string | null;
  tradeSignal: string | null;
  convictionScore: number | null;
  signalDaysActive: number | null;
};

const SIGNAL_STRIP_CONFIG: Record<string, { badge: string; border: string }> = {
  BUY:    { badge: "text-green-300 bg-green-900/50",  border: "border-green-700/50"  },
  WATCH:  { badge: "text-cyan-300 bg-cyan-900/40",    border: "border-cyan-700/40"   },
  REDUCE: { badge: "text-red-300 bg-red-900/40",      border: "border-red-700/40"    },
  HOLD:   { badge: "text-slate-400 bg-slate-800",     border: "border-slate-600/30"  },
};

function deriveSignal(c: { compositeScore: number | null; rrgQuadrant: string | null; compositeTrend20d?: number | null; tradeSignal?: string | null }): string {
  if (c.tradeSignal) return c.tradeSignal;
  const score = c.compositeScore ?? 0;
  const rrg = c.rrgQuadrant ? Number(c.rrgQuadrant) : 0;
  const trend20d = (c as {compositeTrend20d?: number | null}).compositeTrend20d ?? 0;
  if (score >= 0.65 && (rrg === 3 || rrg === 4) && trend20d > 0) return "BUY";
  if (score < 0.35 && (rrg === 1 || rrg === 2)) return "REDUCE";
  if (score >= 0.50 && (rrg === 3 || rrg === 4)) return "WATCH";
  return "HOLD";
}

function MarketSignalStrip() {
  const [chips, setChips] = useState<SignalChip[]>([]);
  useEffect(() => {
    fetch("/api/v1/categories?timeframe=MONTH")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.categories) return;
        const sectors = (data.categories as CategorySummary[])
          .filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null && SECTOR_DRILLDOWN_IDS.has(c.id))
          .map(c => ({
            id: c.id,
            etfTicker: c.etfTicker,
            score: Math.round((c.compositeScore ?? 0) * 100),
            quadrant: c.rrgQuadrant,
            tradeSignal: c.tradeSignal,
            convictionScore: c.convictionScore,
            signalDaysActive: c.signalDaysActive,
            _signal: deriveSignal(c),
            _sortKey: c.convictionScore ?? Math.round((c.compositeScore ?? 0) * 100),
          }))
          .sort((a, b) => {
            const sigOrder: Record<string, number> = { BUY: 0, WATCH: 1, HOLD: 2, REDUCE: 3 };
            const sDiff = (sigOrder[a._signal] ?? 2) - (sigOrder[b._signal] ?? 2);
            if (sDiff !== 0) return sDiff;
            return b._sortKey - a._sortKey;
          })
          .slice(0, 5)
          .map(c => ({
            id: c.id,
            etfTicker: c.etfTicker,
            score: c.score,
            quadrant: c.quadrant,
            tradeSignal: c._signal,
            convictionScore: c.convictionScore,
            signalDaysActive: c.signalDaysActive,
          }));
        setChips(sectors);
      })
      .catch(() => {});
  }, []);

  if (chips.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-1.5">
      {chips.map(chip => {
        const sig = chip.tradeSignal ?? "HOLD";
        const cfg = SIGNAL_STRIP_CONFIG[sig] ?? SIGNAL_STRIP_CONFIG.HOLD;
        const scoreColor = chip.score >= 70 ? "text-emerald-400" : chip.score >= 40 ? "text-yellow-400" : "text-red-400";
        const conviction = chip.convictionScore;
        const days = chip.signalDaysActive;
        const ageColor = days == null ? "" : days >= 10 ? "text-emerald-600" : days >= 4 ? "text-amber-600" : "text-slate-600";
        const ageTitle = days != null ? ` · Signal active ${days}d${days < 4 ? " (fresh — confirm before acting)" : days >= 10 ? " (established)" : ""}` : "";
        return (
          <Link
            key={chip.id}
            href={`/sectors/${chip.id}`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border hover:opacity-90 transition-opacity ${cfg.border} ${sig === "BUY" ? "bg-green-900/20" : sig === "REDUCE" ? "bg-red-900/10" : "bg-slate-700/40"}`}
            title={`${chip.etfTicker} — ${sig} · Score: ${chip.score}/100${conviction != null ? ` · Conviction: ${conviction}/100` : ""}${ageTitle}`}
          >
            <span className={`text-[9px] font-bold px-0.5 rounded ${cfg.badge}`}>{sig}</span>
            <span className="text-[10px] font-mono text-slate-200">{chip.etfTicker}</span>
            <span className={`text-[9px] tabular-nums ${scoreColor}`}>{chip.score}</span>
            {conviction != null && conviction >= 55 && (
              <span className={`text-[8px] font-mono ${conviction >= 75 ? "text-emerald-400" : "text-amber-400"}`}>C{conviction}</span>
            )}
            {days != null && (sig === "BUY" || sig === "REDUCE") && (
              <span className={`text-[8px] font-mono tabular-nums ${ageColor}`}>{days}d</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function AlertCountBadge() {
  const [count, setCount] = useState<number | null>(null);

  // Counts what needs action, like the nav badge and the alerts page. Showing every active alert
  // here puts the wall back on every screen, which is what the alerts redesign set out to remove.
  useEffect(() => {
    fetchActiveAlertCount()
      .then(data => setCount(data.needsAction ?? data.active))
      .catch(() => {});
  }, []);

  if (!count) return null;

  return (
    <Link
      href="/alerts"
      className="relative flex items-center gap-1 px-2 py-0.5 rounded border border-red-700/50 bg-red-900/30 hover:bg-red-900/50 transition-colors"
      title={`${count} alert${count > 1 ? "s" : ""} needing action`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      <span className="text-[10px] font-semibold text-red-300">{count}</span>
    </Link>
  );
}

export default function GlobalHeader() {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between gap-4 shrink-0 z-10">
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-lg">📈</span>
        <span
          className="font-bold text-white"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "17px", letterSpacing: "0.03em" }}
        >
          Follow the Money
        </span>
        <span className="text-slate-500 text-xs hidden md:block">local · single-user</span>
      </div>
      <MarketSignalStrip />
      <Suspense fallback={<div className="h-7 w-48 bg-slate-700 rounded-lg animate-pulse" />}>
        <TimeframeSelector />
      </Suspense>
      <div className="flex items-center gap-3 shrink-0">
        <AlertCountBadge />
        <RefreshButton />
      </div>
    </header>
  );
}
