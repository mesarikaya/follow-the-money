import { CategorySummary, HoldingDto } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import { currencySymbol, isStale, unrealizedPnl } from "@/lib/portfolio/portfolioMetrics";
import { SIGNAL_CONFIG } from "@/components/portfolio/signalStyles";
import { UseHoldingsResult, SortField, SortDir } from "@/app/portfolio/useHoldings";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="text-slate-600">↕</span>;
  return <span className="text-blue-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

/**
 * The Holdings section: the add/upload/refresh toolbar, the add-holding form, and the sortable,
 * inline-editable holdings table with its summary footer. Purely presentational — all state and
 * behaviour come from the {@link useHoldings} hook via {@code holdingsState}; the page-level totals
 * come in as props.
 */
export default function HoldingsSection({
  holdingsState,
  categoryById,
  totalEur,
  staleCount,
  holdingsSummary,
}: {
  holdingsState: UseHoldingsResult;
  categoryById: Record<string, CategorySummary>;
  totalEur: number | null;
  staleCount: number;
  holdingsSummary: { totalPnlEur: number; totalPnlPct: number | null } | null;
}) {
  const {
    holdings, sortedHoldings, sortField, sortDir, handleSort,
    uploadResult, isUploading, uploadError, handleUpload, handleTemplateDownload,
    isRefreshingPrices, handleRefreshPrices,
    editingTicker, editQty, setEditQty, editPrice, setEditPrice, editManualPrice, setEditManualPrice,
    isSavingHolding, editError, setEditError, startEdit, saveEdit, cancelEdit,
    deletingTicker, confirmDeleteTicker, setConfirmDeleteTicker, handleDelete,
    showAddForm, setShowAddForm, addTicker, setAddTicker, addCurrency, setAddCurrency,
    addQty, setAddQty, addAvgCost, setAddAvgCost, isAdding, addError, setAddError, handleAddHolding,
  } = holdingsState;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-200">
            Holdings
            {holdings && holdings.length > 0 && (
              <span className="text-slate-500 font-normal ml-2">({holdings.length})</span>
            )}
          </h2>
          {totalEur != null && totalEur > 0 && (
            <span className="text-sm font-mono text-emerald-400">
              €{totalEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
          {staleCount > 0 && (
            <span className="text-xs text-amber-400" title={`${staleCount} holding(s) have no live price — click refresh or edit manually`}>
              ⚠ {staleCount} stale
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {holdings && holdings.length > 0 && (
            <button
              onClick={handleRefreshPrices}
              disabled={isRefreshingPrices}
              className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
              title="Fetch latest prices from Yahoo Finance for all holdings"
            >
              {isRefreshingPrices ? "Refreshing…" : "↻ Refresh Prices"}
            </button>
          )}
          <button
            onClick={handleTemplateDownload}
            className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors"
            title="Download CSV template to fill in your holdings"
          >
            ↓ Template
          </button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
            />
            <span className={`text-xs px-3 py-1 rounded border transition-colors ${
              isUploading
                ? "bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            }`}>
              {isUploading ? "Uploading…" : "↑ Upload CSV"}
            </span>
          </label>
          <button
            onClick={() => { setShowAddForm((v) => !v); setAddError(null); }}
            className="text-xs px-3 py-1 border border-emerald-700 text-emerald-400 rounded hover:bg-emerald-900/30 hover:text-emerald-300 transition-colors"
          >
            + Add Holding
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
          {uploadError}
        </div>
      )}

      {editError && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2 flex items-center justify-between">
          <span>Failed to save: {editError}</span>
          <button onClick={() => setEditError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      {showAddForm && (
        <div className="bg-slate-800/60 border border-emerald-800/50 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-200 mb-3">Add New Holding</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Ticker *</label>
              <input
                type="text"
                placeholder="e.g. AAPL"
                value={addTicker}
                onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Currency *</label>
              <select
                value={addCurrency}
                onChange={(e) => setAddCurrency(e.target.value)}
                className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="GBX">GBX — Pence Sterling (LSE, e.g. BA.L)</option>
                <option value="SEK">SEK — Swedish Krona (e.g. SAAB-B.ST)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Quantity *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="10.00"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Avg Cost (optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 195.00"
                value={addAvgCost}
                onChange={(e) => setAddAvgCost(e.target.value)}
                className="w-full text-xs font-mono bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          {addError && (
            <p className="text-xs text-red-400 mt-2">{addError}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAddHolding}
              disabled={isAdding || !addTicker.trim() || !addQty}
              className="text-xs px-4 py-1.5 bg-emerald-700 text-white rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? "Adding…" : "Add"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddError(null); }}
              className="text-xs px-3 py-1.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <span className="text-[10px] text-slate-600 ml-1">
              Name and category are auto-detected from Yahoo Finance and ticker mappings.
            </span>
          </div>
        </div>
      )}

      {uploadResult && (
        <div className="text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800 rounded px-3 py-2 flex items-center justify-between">
          <span>
            Uploaded {uploadResult.totalAccepted} holdings
            {uploadResult.totalMarketValueEur != null && ` · Total: €${Number(uploadResult.totalMarketValueEur).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            {uploadResult.usdPerEurRateUsed != null && ` (rate: ${Number(uploadResult.usdPerEurRateUsed).toFixed(4)})`}
          </span>
          {uploadResult.unclassifiedTickers.length > 0 && (
            <span className="text-amber-400 ml-2" title="These tickers were not mapped to a category">
              ⚠ Unclassified: {uploadResult.unclassifiedTickers.join(", ")}
            </span>
          )}
        </div>
      )}

      {sortedHoldings && sortedHoldings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("ticker")}>
                  Ticker <SortIcon field="ticker" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("categoryId")}>
                  Segment <SortIcon field="categoryId" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2 text-center" title="Sector rotation signal for this holding's category">Signal</th>
                <th className="px-4 py-2 text-right" title="This holding as % of total portfolio value (EUR)">Wt%</th>
                <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("quantity")}>
                  Qty <SortIcon field="quantity" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("avgCostLocal")}>
                  Avg Cost <SortIcon field="avgCostLocal" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("currentPriceLocal")}>
                  Price <SortIcon field="currentPriceLocal" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("unrealizedPnlPct")} title="Unrealized P&L: (current price − avg cost) / avg cost">
                  P&amp;L <SortIcon field="unrealizedPnlPct" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors" onClick={() => handleSort("marketValueEur")}>
                  Value (€) <SortIcon field="marketValueEur" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedHoldings.map((h) => {
                const stale = isStale(h);
                const isEditing = editingTicker === h.ticker;
                return (
                  <tr
                    key={h.ticker}
                    className={`hover:bg-slate-800/50 transition-colors ${stale ? "bg-amber-950/10" : ""}`}
                  >
                    <td className="px-4 py-2 font-mono text-blue-300 font-medium">
                      {h.ticker}
                      {stale && (
                        <span className="ml-1 text-[10px] text-amber-500" title="Price not available or older than 3 days">●</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{h.name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">
                      {h.categoryId ? (() => {
                        const cat = categoryById[h.categoryId];
                        const parentId = cat?.parentId ?? null;
                        const parentCat = parentId ? categoryById[parentId] : null;
                        return (
                          <div className="flex items-center gap-1 flex-wrap">
                            {parentCat && (
                              <>
                                <span className="text-[9px] text-slate-500" title={parentCat.name}>{parentCat.name}</span>
                                <span className="text-[9px] text-slate-700">›</span>
                              </>
                            )}
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-900/50 text-blue-300 border border-blue-800/40"
                              title={`${h.categoryId}${cat ? ` — ${cat.name}` : ""}`}
                            >
                              {cat?.name ?? h.categoryId}
                            </span>
                          </div>
                        );
                      })() : (
                        <span className="text-amber-400 text-[10px]" title="No sector mapping for this ticker — assign one under Ticker Mappings, or re-upload">⚠ Unclassified</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {(() => {
                        const cat = h.categoryId ? categoryById[h.categoryId] : null;
                        if (!cat) return <span className="text-slate-700 text-[10px]">—</span>;
                        const sig = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal({ compositeScore: cat.compositeScore, rrgQuadrant: null, compositeTrend20d: null });
                        const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
                        if (!sig) return <span className="text-slate-700 text-[10px]">—</span>;
                        const cfg = SIGNAL_CONFIG[sig];
                        const trend5d = cat.compositeTrend5d ?? null;
                        const trendArrow = trend5d == null ? null : trend5d > 0 ? "↑" : trend5d < 0 ? "↓" : "→";
                        const trendColor = trend5d == null ? "" : trend5d > 0 ? "text-emerald-400" : trend5d < 0 ? "text-red-400" : "text-slate-500";
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.className}`}>{sig}</span>
                            <div className="flex items-center gap-1">
                              {score != null && (
                                <span className={`text-[9px] font-mono ${score >= 65 ? "text-green-400" : score >= 45 ? "text-yellow-400" : "text-red-400"}`}>{score}</span>
                              )}
                              {trendArrow && (
                                <span className={`text-[9px] font-bold ${trendColor}`}>{trendArrow}</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500 text-xs">
                      {totalEur != null && totalEur > 0 && h.marketValueEur != null
                        ? `${((h.marketValueEur / totalEur) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-200">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="w-20 text-xs font-mono text-right bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none"
                        />
                      ) : (
                        Number(h.quantity).toFixed(2)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-400">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          placeholder="avg cost"
                          className="w-24 text-xs font-mono text-right bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none"
                        />
                      ) : (
                        h.avgCostLocal != null
                          ? `${currencySymbol(h.currency)}${Number(h.avgCostLocal).toFixed(2)}`
                          : "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editManualPrice}
                          onChange={(e) => setEditManualPrice(e.target.value)}
                          placeholder="price override"
                          className="w-28 text-xs font-mono text-right bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-slate-200 focus:outline-none"
                        />
                      ) : h.currentPriceLocal != null ? (
                        <span className="text-slate-200">
                          {currencySymbol(h.currency)}{Number(h.currentPriceLocal).toFixed(2)}
                          {h.priceDate && (
                            <span className="text-slate-600 text-[10px] ml-1">{h.priceDate}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-500 text-xs" title="No live price — click Edit to enter manually">n/a</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {(() => {
                        const pnl = unrealizedPnl(h);
                        if (!pnl) return <span className="text-slate-600 text-xs">—</span>;
                        const pctStr = `${pnl.pct >= 0 ? "+" : ""}${(pnl.pct * 100).toFixed(1)}%`;
                        const absStr = `${pnl.absLocal >= 0 ? "+" : ""}${Math.abs(pnl.absLocal) < 1000
                          ? (currencySymbol(h.currency)) + Math.abs(pnl.absLocal).toFixed(0)
                          : (currencySymbol(h.currency)) + (Math.abs(pnl.absLocal) / 1000).toFixed(1) + "k"}`;
                        const color = pnl.pct >= 0 ? "text-emerald-400" : "text-red-400";
                        return (
                          <div className={`flex flex-col items-end ${color}`} title={`Unrealized: ${pnl.pct >= 0 ? "+" : ""}${(pnl.pct * 100).toFixed(2)}% · ${absStr} in local currency`}>
                            <span className="text-xs font-semibold">{pctStr}</span>
                            <span className="text-[10px] opacity-70">{pnl.absLocal >= 0 ? "+" : ""}{currencySymbol(h.currency)}{Math.abs(pnl.absLocal).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {h.marketValueEur != null ? (
                        <span className="text-emerald-400">
                          €{Number(h.marketValueEur).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(h.ticker)}
                            disabled={isSavingHolding}
                            className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isSavingHolding ? "…" : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-[10px] px-2 py-0.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : confirmDeleteTicker === h.ticker ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-red-400">Delete?</span>
                          <button
                            onClick={() => handleDelete(h.ticker)}
                            disabled={deletingTicker === h.ticker}
                            className="text-[10px] px-2 py-0.5 bg-red-700 text-white rounded hover:bg-red-600 disabled:opacity-50"
                          >
                            {deletingTicker === h.ticker ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTicker(null)}
                            className="text-[10px] px-2 py-0.5 border border-slate-600 text-slate-400 rounded hover:text-slate-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(h)}
                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTicker(h.ticker)}
                            className="text-[10px] text-red-700 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {holdingsSummary && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/40 text-xs">
              <span className="text-slate-400 font-medium">Portfolio Summary</span>
              <div className="flex items-center gap-6">
                {totalEur != null && totalEur > 0 && (
                  <span className="text-slate-300 font-mono">
                    <span className="text-slate-500 mr-1">Total value</span>
                    <span className="font-semibold text-emerald-400">
                      €{totalEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </span>
                )}
                {holdingsSummary.totalPnlPct != null && (
                  <span className="font-mono flex items-center gap-1">
                    <span className="text-slate-500">Unrealized P&L</span>
                    <span className={`font-semibold ${holdingsSummary.totalPnlEur >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {holdingsSummary.totalPnlEur >= 0 ? "+" : ""}€{Math.abs(holdingsSummary.totalPnlEur).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className={`text-[10px] ${holdingsSummary.totalPnlEur >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      ({holdingsSummary.totalPnlPct >= 0 ? "+" : ""}{(holdingsSummary.totalPnlPct * 100).toFixed(1)}%)
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : holdings !== null && holdings.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-8">
          No holdings uploaded yet. Download the template, fill it in, and upload your CSV.
        </div>
      ) : null}
    </section>
  );
}
