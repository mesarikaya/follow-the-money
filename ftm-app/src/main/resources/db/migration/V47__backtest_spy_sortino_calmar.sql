-- Add SPY Sortino and Calmar ratios to match strategy-side metrics
ALTER TABLE backtest_results
    ADD COLUMN IF NOT EXISTS spy_sortino_ratio NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS spy_calmar_ratio   NUMERIC(10, 4);
