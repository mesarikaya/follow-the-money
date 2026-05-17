import { Suspense } from "react";
import RRGSection from "@/components/RRGSection";

export default function RelativeRotationGraphPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-slate-700 shrink-0">
        <h1
          className="text-slate-100 font-bold"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
        >
          Relative Rotation Graph
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          RS ratio vs RS momentum — Leading (↗) means high RS with rising momentum. Plotted relative to SPY.
        </p>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        <Suspense fallback={null}>
          <RRGSection />
        </Suspense>
      </main>
    </div>
  );
}
