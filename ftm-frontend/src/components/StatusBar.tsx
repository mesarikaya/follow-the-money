import { fetchLatestIngestStatus } from "@/lib/api";

function formatTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }) + " ET";
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function StatusBar() {
  const statuses = await fetchLatestIngestStatus().catch(() => []);

  const pricesEntry = statuses.find((s) => s.source === "PRICES");
  const macroEntry  = statuses.find((s) => s.source === "MACRO");

  const lastIngestionAt = pricesEntry?.finishedAt ?? macroEntry?.finishedAt ?? null;
  const pricesOk  = pricesEntry?.status === "SUCCESS";
  const macroOk   = macroEntry?.status === "SUCCESS";

  return (
    <footer className="bg-slate-800 border-t border-slate-700 px-6 py-2 flex items-center gap-6 text-xs text-slate-500 shrink-0 flex-wrap">
      {lastIngestionAt ? (
        <span>
          Last ingestion:{" "}
          <span className="text-slate-300">
            {formatDate(lastIngestionAt)} {formatTime(lastIngestionAt)}
          </span>
        </span>
      ) : (
        <span>Last ingestion: <span className="text-slate-500">never</span></span>
      )}

      {pricesEntry && (
        <span>
          PRICES:{" "}
          <span className={pricesOk ? "text-green-400" : "text-red-400"}>
            {pricesOk ? "✓ success" : "✗ failed"}
          </span>
          {pricesEntry.rowsInserted != null && (
            <span className="text-slate-500"> · {pricesEntry.rowsInserted.toLocaleString()} rows</span>
          )}
        </span>
      )}

      {macroEntry && (
        <span>
          MACRO:{" "}
          <span className={macroOk ? "text-green-400" : "text-red-400"}>
            {macroOk ? "✓ success" : "✗ failed"}
          </span>
          {macroEntry.rowsInserted != null && (
            <span className="text-slate-500"> · {macroEntry.rowsInserted.toLocaleString()} rows</span>
          )}
        </span>
      )}

      <span className="ml-auto flex items-center gap-4">
        <span>ftm-app :8080</span>
        <span>·</span>
        <span>PostgreSQL :5432</span>
        <span>·</span>
        <a
          href="http://localhost:8080/swagger-ui.html"
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline"
        >
          OpenAPI ↗
        </a>
      </span>
    </footer>
  );
}
