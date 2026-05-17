import { Suspense } from "react";
import { fetchCategories, fetchMacro, fetchRotation } from "@/lib/api";
import CategoryTable from "@/components/CategoryTable";
import MacroPanel from "@/components/MacroPanel";
import RotationHeatmap from "@/components/RotationHeatmap";
import RotationPanel from "@/components/RotationPanel";
import StaleDataBanner from "@/components/StaleDataBanner";
import RefreshButton from "@/components/RefreshButton";
import TimeframeSelector from "@/components/TimeframeSelector";

type Props = {
  searchParams: Promise<{ timeframe?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { timeframe = "MONTH" } = await searchParams;

  const [categoriesResult, macroResult, rotationResult] = await Promise.allSettled([
    fetchCategories(timeframe),
    fetchMacro(),
    fetchRotation(),
  ]);

  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.categories : [];
  const asOfDate =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.asOfDate : null;
  const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
  const rotation = rotationResult.status === "fulfilled" ? rotationResult.value : null;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-700 bg-slate-800 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-slate-200">Sector Rotation</h1>
          <Suspense fallback={null}>
            <TimeframeSelector current={timeframe} />
          </Suspense>
        </div>
        <div className="flex items-center gap-4">
          {asOfDate && (
            <span className="text-xs text-slate-500">Data as of {asOfDate}</span>
          )}
          <RefreshButton />
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {categoriesResult.status === "rejected" && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load categories:{" "}
            {String((categoriesResult as PromiseRejectedResult).reason)}
          </div>
        )}

        {categories.length > 0 && <StaleDataBanner categories={categories} />}

        {macro && <MacroPanel macro={macro} />}

        {macroResult.status === "rejected" && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load macro data:{" "}
            {String((macroResult as PromiseRejectedResult).reason)}
          </div>
        )}

        {rotation && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-200">Rotation Signals</h2>
            <RotationPanel rotation={rotation} />
          </section>
        )}

        {categories.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-200">Composite Score Heatmap</h2>
            <RotationHeatmap categories={categories} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">
            Categories{" "}
            <span className="text-zinc-500 font-normal text-sm">
              ({categories.length})
            </span>
          </h2>
          {categories.length > 0 ? (
            <CategoryTable categories={categories} />
          ) : (
            <div className="text-zinc-500 text-sm py-8 text-center">
              No categories loaded.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
