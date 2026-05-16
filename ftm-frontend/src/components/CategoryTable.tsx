import { CategorySummary } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  EQUITY_SECTOR: "Sector",
  FIXED_INCOME: "Fixed Inc.",
  COMMODITY: "Commodity",
  CURRENCY: "Currency",
  ALTERNATIVE: "Alt",
};

const TYPE_COLORS: Record<string, string> = {
  EQUITY_SECTOR: "bg-blue-900/60 text-blue-300",
  FIXED_INCOME: "bg-green-900/60 text-green-300",
  COMMODITY: "bg-orange-900/60 text-orange-300",
  CURRENCY: "bg-purple-900/60 text-purple-300",
  ALTERNATIVE: "bg-zinc-700 text-zinc-300",
};

function fmt(v: number | null, decimals = 2): string {
  return v == null ? "—" : v.toFixed(decimals);
}

function scoreColor(score: number | null): string {
  if (score == null) return "";
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-red-400";
}

export default function CategoryTable({ categories }: { categories: CategorySummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-zinc-700 bg-zinc-800/60 text-zinc-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">ETF</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Latest Close</th>
            <th className="px-4 py-3 text-right">Price Date</th>
            <th className="px-4 py-3 text-right">Score</th>
            <th className="px-4 py-3 text-right">RS60</th>
            <th className="px-4 py-3 text-right">Flow 20d</th>
            <th className="px-4 py-3 text-center">RRG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {categories.map((cat) => (
            <tr
              key={cat.id}
              className="hover:bg-zinc-800/40 transition-colors text-zinc-200"
            >
              <td className="px-4 py-3 text-zinc-500 tabular-nums">{cat.rank}</td>
              <td className="px-4 py-3 font-medium">{cat.name}</td>
              <td className="px-4 py-3 font-mono text-zinc-300">{cat.etfTicker}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    TYPE_COLORS[cat.type] ?? "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {TYPE_LABELS[cat.type] ?? cat.type}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {cat.latestClose != null ? `$${Number(cat.latestClose).toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right text-zinc-400 text-xs">
                {cat.priceDate ?? "—"}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums font-medium ${scoreColor(cat.compositeScore)}`}>
                {fmt(cat.compositeScore)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                {fmt(cat.rs60)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                {fmt(cat.flow20d)}
              </td>
              <td className="px-4 py-3 text-center text-zinc-500 text-xs">
                {cat.rrgQuadrant ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
