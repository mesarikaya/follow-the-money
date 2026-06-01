import { Suspense } from "react";
import RRGSection from "@/components/RRGSection";
import RRGPositionTable from "@/components/RRGPositionTable";

export default function RelativeRotationGraphPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-slate-100 font-bold"
              style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
            >
              Relative Rotation Graph
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              RS ratio vs RS momentum — Leading (↗) means high RS with rising momentum. Plotted relative to SPY.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Leading
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Improving
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Weakening
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Lagging
            </span>
            <span className="ml-1 text-[10px] bg-slate-700/80 border border-slate-600 px-2 py-0.5 rounded text-slate-400">
              trail length: adjustable in chart
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 p-6 overflow-auto space-y-6">
        <Suspense fallback={null}>
          <RRGSection fullPage />
        </Suspense>
        <Suspense fallback={null}>
          <RRGPositionTable />
        </Suspense>
      </main>
    </div>
  );
}
