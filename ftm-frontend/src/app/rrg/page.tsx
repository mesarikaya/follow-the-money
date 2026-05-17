import { Suspense } from "react";
import RRGSection from "@/components/RRGSection";

export default function RelativeRotationGraphPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center px-6 py-3 border-b border-slate-700 bg-slate-800 sticky top-0 z-10 shrink-0">
        <h1 className="text-sm font-semibold text-slate-200">Relative Rotation Graph</h1>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        <Suspense fallback={null}>
          <RRGSection />
        </Suspense>
      </main>
    </div>
  );
}
