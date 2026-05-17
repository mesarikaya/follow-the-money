import { fetchCategories, fetchMacro, fetchRotation } from "@/lib/api";
import CategoryTable from "@/components/CategoryTable";
import MacroPanel from "@/components/MacroPanel";
import RotationHeatmap from "@/components/RotationHeatmap";
import RotationPanel from "@/components/RotationPanel";
import StaleDataBanner from "@/components/StaleDataBanner";

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
            <h2 className="text-base font-semibold text-slate-200">Rotation Signals</h2>
            <RotationPanel rotation={rotation} />
          </section>
        )}

        {categories.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-200">Composite Score Heatmap</h2>
            <RotationHeatmap categories={categories} />
          </section>
        )}

        {asOfDate && (
          <div className="text-xs text-slate-500">Data as of {asOfDate}</div>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-200">
            Categories{" "}
            <span className="text-slate-500 font-normal text-sm">
              ({categories.length})
            </span>
          </h2>
          {categories.length > 0 ? (
            <CategoryTable categories={categories} />
          ) : (
            <div className="text-slate-500 text-sm py-8 text-center">
              No categories loaded.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
