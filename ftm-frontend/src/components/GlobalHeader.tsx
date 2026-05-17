"use client";

import { Suspense } from "react";
import TimeframeSelector from "@/components/TimeframeSelector";
import RefreshButton from "@/components/RefreshButton";

export default function GlobalHeader() {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-2.5">
        <span className="text-lg">📈</span>
        <span
          className="font-bold text-white"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "17px", letterSpacing: "0.03em" }}
        >
          Follow the Money
        </span>
        <span className="text-slate-500 text-xs hidden md:block">local · single-user</span>
      </div>
      <Suspense fallback={<div className="h-7 w-48 bg-slate-700 rounded-lg animate-pulse" />}>
        <TimeframeSelector />
      </Suspense>
      <div className="flex items-center gap-3">
        <RefreshButton />
      </div>
    </header>
  );
}
