"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import TimeframeSelector from "@/components/TimeframeSelector";
import RefreshButton from "@/components/RefreshButton";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type SignalChip = { id: string; etfTicker: string; score: number; quadrant: string | null };

const QUADRANT_SHORT: Record<string, { label: string; color: string }> = {
  "4": { label: "↗",  color: "text-emerald-400" },
  "3": { label: "↖",  color: "text-cyan-400"    },
  "2": { label: "↘",  color: "text-orange-400"  },
  "1": { label: "↙",  color: "text-slate-400"   },
};

function MarketSignalStrip() {
  const [chips, setChips] = useState<SignalChip[]>([]);
  useEffect(() => {
    fetch("/api/v1/categories?timeframe=MONTH")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.categories) return;
        const sectors = (data.categories as Array<{id: string; etfTicker: string; compositeScore: number | null; rrgQuadrant: string | null; type: string}>)
          .filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null && SECTOR_DRILLDOWN_IDS.has(c.id))
          .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
          .slice(0, 4)
          .map(c => ({ id: c.id, etfTicker: c.etfTicker, score: Math.round((c.compositeScore ?? 0) * 100), quadrant: c.rrgQuadrant }));
        setChips(sectors);
      })
      .catch(() => {});
  }, []);

  if (chips.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-1.5">
      {chips.map(chip => {
        const q = chip.quadrant ? QUADRANT_SHORT[chip.quadrant] : null;
        const scoreColor = chip.score >= 70 ? "text-emerald-400" : chip.score >= 40 ? "text-yellow-400" : "text-red-400";
        return (
          <Link
            key={chip.id}
            href={`/sectors/${chip.id}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/50 border border-slate-600/40 hover:border-slate-500/70 hover:bg-slate-700 transition-all"
            title={`${chip.etfTicker} — Score: ${chip.score}/100`}
          >
            <span className="text-[10px] font-mono text-cyan-400">{chip.etfTicker}</span>
            <span className={`text-[10px] tabular-nums font-semibold ${scoreColor}`}>{chip.score}</span>
            {q && <span className={`text-[9px] ${q.color}`}>{q.label}</span>}
          </Link>
        );
      })}
    </div>
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
        <RefreshButton />
      </div>
    </header>
  );
}
