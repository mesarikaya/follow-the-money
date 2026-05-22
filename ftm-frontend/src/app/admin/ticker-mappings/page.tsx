"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchTickerMappings,
  upsertTickerMapping,
  deleteTickerMapping,
  TickerMappingDto,
} from "@/lib/api";

const KNOWN_CATEGORIES = [
  "TECH","FINL","HLTH","DISR","INDU","ENRG","MATL","UTIL","REIT","STPL","COMM",
  "GOLD","SLVR","GDMN","TLTD","TINT","CORP","HIYLD","CASH",
];

export default function TickerMappingsPage() {
  const [mappings, setMappings] = useState<TickerMappingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [formTicker, setFormTicker] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchTickerMappings();
      setMappings(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (mapping: TickerMappingDto) => {
    setFormTicker(mapping.ticker);
    setFormCategory(mapping.categoryId);
    setFormNotes(mapping.notes ?? "");
    setFormError(null);
  };

  const handleClear = () => {
    setFormTicker("");
    setFormCategory("");
    setFormNotes("");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!formTicker.trim()) { setFormError("Ticker is required"); return; }
    if (!formCategory.trim()) { setFormError("Category ID is required"); return; }
    setFormSaving(true);
    setFormError(null);
    try {
      await upsertTickerMapping({ ticker: formTicker.trim().toUpperCase(), categoryId: formCategory.trim().toUpperCase(), notes: formNotes.trim() || undefined });
      handleClear();
      await load();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (ticker: string) => {
    setDeletingTicker(ticker);
    try {
      await deleteTickerMapping(ticker);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setDeletingTicker(null);
    }
  };

  const filtered = filter
    ? mappings.filter(
        (m) =>
          m.ticker.toLowerCase().includes(filter.toLowerCase()) ||
          m.categoryId.toLowerCase().includes(filter.toLowerCase()) ||
          (m.notes?.toLowerCase().includes(filter.toLowerCase()) ?? false)
      )
    : mappings;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <h1
          className="text-slate-100 font-bold"
          style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
        >
          Ticker Mappings
        </h1>
        <span className="text-xs text-slate-500">{mappings.length} entries</span>
      </header>

      <main className="flex-1 p-6 space-y-5 overflow-auto">
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Add / Edit form */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Add / Edit Mapping</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Ticker</label>
              <input
                type="text"
                value={formTicker}
                onChange={(e) => setFormTicker(e.target.value.toUpperCase())}
                placeholder="e.g. NVDA"
                className="w-28 text-sm font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Category ID</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-32 text-sm font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="">— select —</option>
                {KNOWN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Notes</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional description"
                className="w-full text-sm bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {formSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleClear}
                className="text-sm px-3 py-1.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          {formError && (
            <p className="mt-2 text-xs text-red-400">{formError}</p>
          )}
        </div>

        {/* Table */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by ticker, category, or notes…"
              className="w-72 text-sm bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
            />
            {filter && (
              <span className="text-xs text-slate-500">{filtered.length} of {mappings.length}</span>
            )}
          </div>

          {loading ? (
            <div className="text-slate-500 text-sm text-center py-12">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2">Ticker</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Notes</th>
                    <th className="px-4 py-2">Updated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map((m) => (
                    <tr key={m.ticker} className="hover:bg-slate-800/50 transition-colors text-slate-200">
                      <td className="px-4 py-2 font-mono text-blue-300 font-medium">{m.ticker}</td>
                      <td className="px-4 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-900/50 text-blue-300 border border-blue-800/40">
                          {m.categoryId}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{m.notes ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">
                        {new Date(m.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(m)}
                            className="text-xs px-2 py-0.5 border border-slate-600 text-slate-400 rounded hover:text-white hover:border-slate-400 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(m.ticker)}
                            disabled={deletingTicker === m.ticker}
                            className="text-xs px-2 py-0.5 border border-red-800 text-red-400 rounded hover:bg-red-900/30 hover:text-red-300 disabled:opacity-50 transition-colors"
                          >
                            {deletingTicker === m.ticker ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-sm">
                        {filter ? "No mappings match the filter." : "No mappings found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
