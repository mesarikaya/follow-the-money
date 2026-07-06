"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type IngestStatus = {
  source: string;
  status: string;
  finishedAt: string | null;
  rowsInserted: number | null;
};

async function fetchLatest(): Promise<IngestStatus[]> {
  const res = await fetch("/api/v1/ingest/status/latest", { cache: "no-store" });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export default function RefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefresh() {
    setState("loading");
    setMessage(null);
    try {
      const triggeredAt = Date.now();
      const res = await fetch("/api/v1/ingest/trigger", { method: "POST" });
      if (!res.ok) throw new Error(`trigger ${res.status}`);

      // Poll until both sources report a run that finished after we triggered (max ~90s).
      let latest: IngestStatus[] = [];
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        latest = await fetchLatest().catch(() => []);
        const allFresh =
          latest.length > 0 &&
          latest.every(
            (s) => s.finishedAt != null && new Date(s.finishedAt).getTime() >= triggeredAt,
          );
        if (allFresh) break;
      }

      const totalRows = latest.reduce((sum, s) => sum + (s.rowsInserted ?? 0), 0);
      setMessage(
        totalRows > 0
          ? `Added ${totalRows.toLocaleString()} new row${totalRows === 1 ? "" : "s"}`
          : "Already up to date — no new market data",
      );
      setState("done");
      router.refresh(); // re-render server components (StatusBar) with the new run
    } catch {
      setState("error");
    }
    setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 8000);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={state === "loading"}
        className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-900 border border-slate-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Trigger a full data refresh from Yahoo Finance and FRED"
      >
        <span className={state === "loading" ? "animate-spin inline-block" : ""}>⟳</span>
        {state === "loading" ? "Refreshing…" : "Refresh"}
      </button>
      {state === "done" && (
        <span className="text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block mr-1" />
          {message ?? "Done"}
        </span>
      )}
      {state === "error" && (
        <span className="text-xs text-red-400">Failed to trigger ingestion</span>
      )}
      {state === "idle" && (
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Up to date
        </span>
      )}
    </div>
  );
}
