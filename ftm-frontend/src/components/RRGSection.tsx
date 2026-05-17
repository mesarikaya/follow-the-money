import { fetchRrg } from "@/lib/api";
import RRGChart from "./RRGChart";

export default async function RRGSection() {
  const data = await fetchRrg().catch(() => null);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-slate-200">Relative Rotation Graph</h2>
        {data?.date && (
          <span className="text-xs text-slate-500">as of {data.date}</span>
        )}
      </div>

      {!data || data.categories.length === 0 ? (
        <div className="text-slate-500 text-sm py-8 text-center">
          No RRG data yet — run ingestion to populate.
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
          <RRGChart categories={data.categories} />
        </div>
      )}
    </section>
  );
}
