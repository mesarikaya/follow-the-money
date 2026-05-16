"use client";

import { useState } from "react";

export default function RefreshButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleRefresh() {
    setState("loading");
    try {
      const res = await fetch("/api/ingest/trigger", { method: "POST" });
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
        className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white rounded-md transition-colors"
      >
        {state === "loading" ? "Triggering…" : "Refresh Data"}
      </button>
      {state === "done" && (
        <span className="text-sm text-green-400">
          Ingestion started — check back in ~1 min
        </span>
      )}
      {state === "error" && (
        <span className="text-sm text-red-400">Failed to trigger ingestion</span>
      )}
    </div>
  );
}
