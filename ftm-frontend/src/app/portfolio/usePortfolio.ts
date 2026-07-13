"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CategorySummary,
  HoldingActionDto,
  PortfolioResponse,
  PortfolioSelectionUniverse,
  PortfolioSnapshot,
  PriceLevelDto,
  SignalWinRateDto,
  fetchCategories,
  fetchPortfolio,
  fetchPortfolioActions,
  fetchPortfolioSnapshots,
  fetchPriceLevels,
  fetchWinRates,
  savePortfolio,
} from "@/lib/api";

const SNAPSHOT_DAYS = 90;
const WIN_RATE_LOOKBACK_DAYS = 365;

/** The target weights must add up to 100%, give or take a rounding hair. */
const TOTAL_TOLERANCE = 0.5;

const byId = <T,>(items: T[], idOf: (item: T) => string): Record<string, T> => {
  const map: Record<string, T> = {};
  items.forEach(item => {
    map[idOf(item)] = item;
  });
  return map;
};

const allocationsAsText = (portfolio: PortfolioResponse): Record<string, string> =>
  Object.fromEntries(
    portfolio.allocations.map(entry => [entry.categoryId, entry.allocationPct.toFixed(2)]),
  );

/**
 * Owns the portfolio side of the page: the target allocations the user is editing, the reference
 * data the recommendations lean on (price levels, win rates, categories), the value history, and
 * the per-holding actions.
 *
 * Holdings themselves belong to `useHoldings`. The two are joined by `reloadPortfolioAndActions`,
 * which the page hands to that hook so a holdings change refreshes what depends on it — the
 * dependency runs one way only, which is what keeps the two hooks from calling each other.
 */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [selectionUniverse, setSelectionUniverse] =
    useState<PortfolioSelectionUniverse>("EQUITY_SECTORS");
  const [priceLevelByCategory, setPriceLevelByCategory] = useState<Record<string, PriceLevelDto>>({});
  const [winRateByCategory, setWinRateByCategory] = useState<Record<string, SignalWinRateDto>>({});
  const [categoryById, setCategoryById] = useState<Record<string, CategorySummary>>({});
  const [editedAllocations, setEditedAllocations] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[] | null>(null);
  const [portfolioActions, setPortfolioActions] = useState<HoldingActionDto[] | null>(null);

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await fetchPortfolio(selectionUniverse);
      setPortfolio(data);
      setEditedAllocations(allocationsAsText(data));
      setIsDirty(false);
      setLoadError(null);
    } catch (error) {
      setLoadError(String(error));
    }
  }, [selectionUniverse]);

  /**
   * After any holdings change, refresh the portfolio-level data that depends on them — the
   * allocations and the recommended actions. The holdings list itself is reloaded by `useHoldings`.
   */
  const reloadPortfolioAndActions = useCallback(async () => {
    await Promise.all([
      loadPortfolio(),
      fetchPortfolioActions().then(setPortfolioActions).catch(() => {}),
    ]);
  }, [loadPortfolio]);

  useEffect(() => {
    loadPortfolio();
    fetchPriceLevels()
      .then(levels => setPriceLevelByCategory(byId(levels, level => level.categoryId)))
      .catch(() => {});
    fetchWinRates(WIN_RATE_LOOKBACK_DAYS)
      .then(rates => setWinRateByCategory(byId(rates, rate => rate.categoryId)))
      .catch(() => {});
    fetchCategories("MONTH")
      .then(response => setCategoryById(byId(response.categories, category => category.id)))
      .catch(() => {});
    fetchPortfolioSnapshots(SNAPSHOT_DAYS).then(setPortfolioSnapshots).catch(() => {});
    fetchPortfolioActions().then(setPortfolioActions).catch(() => {});
  }, [loadPortfolio]);

  const changeAllocation = (categoryId: string, value: string) => {
    setEditedAllocations(previous => ({ ...previous, [categoryId]: value }));
    setIsDirty(true);
    setSaveError(null);
  };

  const totalAllocation = Object.values(editedAllocations).reduce(
    (sum, value) => sum + (parseFloat(value) || 0),
    0,
  );

  const save = async () => {
    const entries = Object.entries(editedAllocations).map(([categoryId, value]) => ({
      categoryId,
      allocationPct: parseFloat(value) || 0,
    }));

    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await savePortfolio(entries, selectionUniverse);
      setPortfolio(updated);
      setIsDirty(false);
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    if (!portfolio) return;
    setEditedAllocations(allocationsAsText(portfolio));
    setIsDirty(false);
    setSaveError(null);
  };

  return {
    portfolio,
    selectionUniverse,
    setSelectionUniverse,
    priceLevelByCategory,
    winRateByCategory,
    categoryById,
    editedAllocations,
    totalAllocation,
    isValidTotal: Math.abs(totalAllocation - 100) <= TOTAL_TOLERANCE,
    isSaving,
    isDirty,
    saveError,
    loadError,
    portfolioSnapshots,
    portfolioActions,
    changeAllocation,
    save,
    reset,
    reloadPortfolioAndActions,
  };
}

export type UsePortfolioResult = ReturnType<typeof usePortfolio>;
