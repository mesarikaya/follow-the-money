"use client";

import { useState } from "react";

export default function RefreshButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleRefresh() {
    setState("loading");
    try {
      const res = await fetch("/api/v1/ingest/trigger", { method: "POST" });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 5000);
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
          Started — check back in ~1 min
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
