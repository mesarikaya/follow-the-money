-- Add Sortino ratio (return / downside deviation) and Calmar ratio (CAGR / max drawdown)
ALTER TABLE backtest_results
    ADD COLUMN IF NOT EXISTS sortino_ratio NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS calmar_ratio  NUMERIC(10, 4);
