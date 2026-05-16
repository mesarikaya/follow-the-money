import { Suspense } from "react";
import RRGSection from "@/components/RRGSection";

export default function RelativeRotationGraphPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center px-6 py-4 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
        <h1 className="text-sm font-semibold text-zinc-300">Relative Rotation Graph</h1>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        <Suspense fallback={null}>
          <RRGSection />
        </Suspense>
      </main>
    </div>
  );
}
