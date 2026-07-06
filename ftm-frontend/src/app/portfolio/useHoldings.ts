import { useCallback, useEffect, useState } from "react";
import {
  fetchHoldings, uploadHoldings, downloadHoldingsTemplate, refreshHoldingPrices,
  updateHolding, deleteHolding, createHolding, HoldingDto, HoldingsUploadResponse,
} from "@/lib/api";
import { unrealizedPnl } from "@/lib/portfolio/portfolioMetrics";

export type SortField = "ticker" | "categoryId" | "quantity" | "avgCostLocal" | "currentPriceLocal" | "marketValueEur" | "unrealizedPnlPct";
export type SortDir = "asc" | "desc";

/**
 * Owns everything about the user's holdings: the list, the add/edit/delete/upload/refresh state,
 * and the handlers that mutate them. The page just renders what this returns.
 *
 * <p>Reload wiring (deliberate, to avoid a circular dependency): this hook loads and reloads its own
 * holdings, and after any change it calls {@code onHoldingsChanged} so the page can refresh the
 * portfolio-level data (allocations, actions) that depends on holdings. `onHoldingsChanged` never
 * needs to touch holdings itself.
 */
export function useHoldings(onHoldingsChanged: () => void | Promise<void>) {
  const [holdings, setHoldings] = useState<HoldingDto[] | null>(null);
  const [sortField, setSortField] = useState<SortField>("marketValueEur");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [uploadResult, setUploadResult] = useState<HoldingsUploadResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editManualPrice, setEditManualPrice] = useState("");
  const [isSavingHolding, setIsSavingHolding] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);
  const [confirmDeleteTicker, setConfirmDeleteTicker] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addTicker, setAddTicker] = useState("");
  const [addCurrency, setAddCurrency] = useState("USD");
  const [addQty, setAddQty] = useState("");
  const [addAvgCost, setAddAvgCost] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const reloadHoldings = useCallback(async () => {
    const data = await fetchHoldings().catch(() => null);
    if (data) setHoldings(data);
  }, []);

  // Load holdings once on mount; mutations below refresh both holdings and the page's portfolio data.
  useEffect(() => {
    fetchHoldings().then(setHoldings).catch(() => setHoldings([]));
  }, []);

  const afterMutation = useCallback(async () => {
    await Promise.all([reloadHoldings(), onHoldingsChanged()]);
  }, [reloadHoldings, onHoldingsChanged]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const result = await uploadHoldings(file);
      setUploadResult(result);
      setHoldings(result.holdings);
      await afterMutation();
    } catch (error) {
      setUploadError(String(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefreshPrices = async () => {
    setIsRefreshingPrices(true);
    try {
      const updated = await refreshHoldingPrices();
      setHoldings(updated);
      await afterMutation();
    } catch (error) {
      setUploadError(String(error));
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  const handleAddHolding = async () => {
    if (!addTicker.trim() || !addQty) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const created = await createHolding({
        ticker: addTicker.trim().toUpperCase(),
        currency: addCurrency,
        quantity: parseFloat(addQty),
        avgCostLocal: addAvgCost ? parseFloat(addAvgCost) : undefined,
      });
      setHoldings((prev) => (prev ? [...prev, created] : [created]));
      setShowAddForm(false);
      setAddTicker(""); setAddCurrency("USD"); setAddQty(""); setAddAvgCost("");
      await afterMutation();
    } catch (error) {
      setAddError(String(error));
    } finally {
      setIsAdding(false);
    }
  };

  const handleTemplateDownload = async () => {
    const res = await downloadHoldingsTemplate();
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "holdings-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedHoldings = holdings ? [...holdings].sort((a, b) => {
    if (sortField === "unrealizedPnlPct") {
      const aP = unrealizedPnl(a)?.pct ?? (sortDir === "asc" ? Infinity : -Infinity);
      const bP = unrealizedPnl(b)?.pct ?? (sortDir === "asc" ? Infinity : -Infinity);
      return sortDir === "asc" ? aP - bP : bP - aP;
    }
    const aVal = a[sortField] ?? (sortDir === "asc" ? Infinity : -Infinity);
    const bVal = b[sortField] ?? (sortDir === "asc" ? Infinity : -Infinity);
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  }) : null;

  const startEdit = (h: HoldingDto) => {
    setEditingTicker(h.ticker);
    setEditQty(String(h.quantity));
    setEditPrice(h.avgCostLocal != null ? String(h.avgCostLocal) : "");
    setEditManualPrice(h.currentPriceLocal != null ? String(h.currentPriceLocal) : "");
  };

  const cancelEdit = () => {
    setEditingTicker(null);
    setEditQty(""); setEditPrice(""); setEditManualPrice("");
  };

  const saveEdit = async (ticker: string) => {
    setIsSavingHolding(true);
    setEditError(null);
    try {
      const updated = await updateHolding(ticker, {
        quantity: parseFloat(editQty),
        avgCostLocal: editPrice ? parseFloat(editPrice) : undefined,
        currentPriceLocal: editManualPrice ? parseFloat(editManualPrice) : undefined,
      });
      setEditingTicker(null);
      setHoldings((prev) => (prev ? prev.map((h) => (h.ticker === ticker ? updated : h)) : prev));
      await afterMutation();
    } catch (error) {
      setEditError(String(error));
    } finally {
      setIsSavingHolding(false);
    }
  };

  const handleDelete = async (ticker: string) => {
    setDeletingTicker(ticker);
    setEditError(null);
    try {
      await deleteHolding(ticker);
      setHoldings((prev) => (prev ? prev.filter((h) => h.ticker !== ticker) : prev));
      setConfirmDeleteTicker(null);
      await afterMutation();
    } catch (error) {
      setEditError(String(error));
    } finally {
      setDeletingTicker(null);
    }
  };

  return {
    holdings, sortedHoldings, sortField, sortDir, handleSort, reloadHoldings,
    uploadResult, isUploading, uploadError, handleUpload, handleTemplateDownload,
    isRefreshingPrices, handleRefreshPrices,
    editingTicker, editQty, setEditQty, editPrice, setEditPrice, editManualPrice, setEditManualPrice,
    isSavingHolding, editError, setEditError, startEdit, saveEdit, cancelEdit,
    deletingTicker, confirmDeleteTicker, setConfirmDeleteTicker, handleDelete,
    showAddForm, setShowAddForm, addTicker, setAddTicker, addCurrency, setAddCurrency,
    addQty, setAddQty, addAvgCost, setAddAvgCost, isAdding, addError, setAddError, handleAddHolding,
  };
}
