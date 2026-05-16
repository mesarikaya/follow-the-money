import { CategorySummary } from "@/lib/api";

function tradingDaysAgo(n: number): Date {
  const d = new Date();
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

export default function StaleDataBanner({ categories }: { categories: CategorySummary[] }) {
  const priceDates = categories
    .map((c) => c.priceDate)
    .filter((d): d is string => d !== null)
    .map((d) => new Date(d));

  if (priceDates.length === 0) {
    return (
      <div className="bg-amber-900/40 border border-amber-600 text-amber-300 px-4 py-2.5 rounded-md text-sm">
        No price data yet. Click <strong>Refresh Data</strong> to start ingestion.
      </div>
    );
  }

  const latest = new Date(Math.max(...priceDates.map((d) => d.getTime())));
  const threshold = tradingDaysAgo(2);

  if (latest < threshold) {
    return (
      <div className="bg-amber-900/40 border border-amber-600 text-amber-300 px-4 py-2.5 rounded-md text-sm">
        Price data is stale — last updated{" "}
        <strong>{latest.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>.
        Click <strong>Refresh Data</strong> to re-ingest.
      </div>
    );
  }

  return null;
}
