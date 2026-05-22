import { fetchRrg, fetchCategories } from "@/lib/api";
import RRGChart from "./RRGChart";

const EXCLUDED_IDS = new Set([
  "FTRS", "MTUM", "QUAL", "USMV", "VLUE",
  "SEMI", "AIRO", "CLOD", "SOFT",
]);

export default async function RRGSection({ fullPage = false }: { fullPage?: boolean }) {
  const [data, categoriesData] = await Promise.all([
    fetchRrg().catch(() => null),
    fetchCategories("MONTH").catch(() => null),
  ]);

  const etfTickers: Record<string, string> = {};
  if (categoriesData) {
    for (const cat of categoriesData.categories) {
      etfTickers[cat.id] = cat.etfTicker;
    }
  }

  const filtered = (data?.categories ?? []).filter(
    (c) => !c.id.includes("_") && !EXCLUDED_IDS.has(c.id)
  );

  const quadrantCounts = filtered.reduce<Record<string, number>>(
    (acc, c) => {
      const q = String(c.quadrant ?? "");
      if (q) acc[q] = (acc[q] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const leading   = quadrantCounts["1"] ?? 0;
  const improving = quadrantCounts["2"] ?? 0;
  const weakening = quadrantCounts["3"] ?? 0;
  const lagging   = quadrantCounts["4"] ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-200">Relative Rotation Graph</h2>
          {data?.date && (
            <span className="text-xs text-slate-500">as of {data.date}</span>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5" title="↗ Leading: high RS with rising momentum">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-green-400 font-semibold">{leading}</span>
              <span className="text-slate-500">Leading</span>
            </span>
            <span className="flex items-center gap-1.5" title="↖ Improving: low RS but rising momentum">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span className="text-blue-400 font-semibold">{improving}</span>
              <span className="text-slate-500">Improving</span>
            </span>
            <span className="flex items-center gap-1.5" title="↘ Weakening: high RS but falling momentum">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              <span className="text-orange-400 font-semibold">{weakening}</span>
              <span className="text-slate-500">Weakening</span>
            </span>
            <span className="flex items-center gap-1.5" title="↙ Lagging: low RS with falling momentum">
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
              <span className="text-slate-400 font-semibold">{lagging}</span>
              <span className="text-slate-500">Lagging</span>
            </span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-slate-500 text-sm py-8 text-center">
          No RRG data yet — run ingestion to populate.
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
          <RRGChart
            categories={filtered}
            etfTickers={etfTickers}
            maxHeight={fullPage ? "min(88vh, 900px)" : "min(72vh, 660px)"}
          />
        </div>
      )}
    </section>
  );
}
