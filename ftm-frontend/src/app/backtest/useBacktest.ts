import { useEffect, useState } from "react";
import {
  runBacktest,
  runBacktestSweep,
  runBacktestFrequencySweep,
  fetchRecentBacktests,
  fetchCategories,
  fetchMacro,
  BacktestResult,
  CategorySummary,
  MacroResponse,
} from "@/lib/api";

/** Earliest date with ingested price/signal data — the sensible default backtest start. */
export const DATA_START = "2019-05-16";
const DEFAULT_START_DATE = DATA_START;
const DEFAULT_END_DATE = new Date().toISOString().split("T")[0];

export type RebalanceFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY";
export type CategoryScope = "ALL" | "EQUITY_SECTORS_ONLY" | "TOP_LEVEL_ONLY";
export type SignalSource = "COMPOSITE" | "MOMENTUM_12_1";

/**
 * All backtest form state, run/sweep actions, and the on-mount live-context load, extracted from the
 * page so `page.tsx` is a thin composition of this hook + presentational components. The three
 * run/sweep handlers each read the current form state and populate their result slice.
 */
export function useBacktest() {
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<RebalanceFrequency>("MONTHLY");
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("TOP_LEVEL_ONLY");
  const [topN, setTopN] = useState(5);
  const [signalSource, setSignalSource] = useState<SignalSource>("COMPOSITE");
  const [signalThreshold, setSignalThreshold] = useState("");
  // Realistic default trading cost (10 bps ≈ round-trip commission + spread for liquid ETFs).
  const [transactionCostBps, setTransactionCostBps] = useState(10);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<BacktestResult[]>([]);
  const [sweepResults, setSweepResults] = useState<BacktestResult[] | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [freqSweepResults, setFreqSweepResults] = useState<BacktestResult[] | null>(null);
  const [isFreqSweeping, setIsFreqSweeping] = useState(false);
  const [liveCategories, setLiveCategories] = useState<CategorySummary[]>([]);
  const [liveRegime, setLiveRegime] = useState<string | null>(null);
  const [regimeHistory, setRegimeHistory] = useState<MacroResponse["regimeHistory"]>([]);

  useEffect(() => {
    fetchRecentBacktests().then(setRecentRuns).catch(() => {});
    fetchCategories("MONTH").then(r => setLiveCategories(r.categories)).catch(() => {});
    fetchMacro().then(r => { setLiveRegime(r.regime); setRegimeHistory(r.regimeHistory ?? []); }).catch(() => {});
  }, []);

  const threshold = () => (signalThreshold ? parseFloat(signalThreshold) : undefined);

  const handleRun = async () => {
    setIsRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const data = await runBacktest({
        startDate,
        endDate,
        rebalanceFrequency,
        topN,
        signalThreshold: threshold(),
        categoryScope,
        transactionCostBps,
        signalSource,
      });
      setResult(data);
      setRecentRuns(prev => [data, ...prev.filter(r => r.runId !== data.runId).slice(0, 9)]);
    } catch (error) {
      setRunError(String(error));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSweep = async () => {
    setIsSweeping(true);
    setSweepResults(null);
    try {
      const data = await runBacktestSweep({
        startDate,
        endDate,
        rebalanceFrequency,
        signalThreshold: threshold(),
        categoryScope,
        transactionCostBps,
        signalSource,
      });
      setSweepResults(data);
    } catch {
      // sweep failures are non-fatal; the primary run still works
    } finally {
      setIsSweeping(false);
    }
  };

  const handleFrequencySweep = async () => {
    setIsFreqSweeping(true);
    setFreqSweepResults(null);
    try {
      const data = await runBacktestFrequencySweep({
        startDate,
        endDate,
        topN,
        signalThreshold: threshold(),
        categoryScope,
        transactionCostBps,
        signalSource,
      });
      setFreqSweepResults(data);
    } catch {
      // sweep failures are non-fatal
    } finally {
      setIsFreqSweeping(false);
    }
  };

  return {
    startDate, setStartDate,
    endDate, setEndDate,
    rebalanceFrequency, setRebalanceFrequency,
    categoryScope, setCategoryScope,
    topN, setTopN,
    signalSource, setSignalSource,
    signalThreshold, setSignalThreshold,
    transactionCostBps, setTransactionCostBps,
    result, setResult,
    isRunning,
    runError,
    recentRuns,
    sweepResults,
    isSweeping,
    freqSweepResults,
    isFreqSweeping,
    liveCategories,
    liveRegime,
    regimeHistory,
    handleRun,
    handleSweep,
    handleFrequencySweep,
  };
}
