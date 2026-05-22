ALTER TABLE backtest_results
    ADD COLUMN IF NOT EXISTS spy_annualized_return_pct NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS spy_max_drawdown_pct      NUMERIC(12, 4);
