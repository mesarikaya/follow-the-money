-- Equal-weight benchmark metrics for backtests: holding all in-scope categories equal-weighted on
-- the same rebalance schedule. Lets the UI show whether the composite signal beats naive
-- diversification (currently it does not). Nullable so existing rows remain valid.
ALTER TABLE backtest_results
    ADD COLUMN equal_weight_total_return_pct      NUMERIC,
    ADD COLUMN equal_weight_annualized_return_pct NUMERIC,
    ADD COLUMN equal_weight_max_drawdown_pct      NUMERIC,
    ADD COLUMN equal_weight_sharpe_ratio          NUMERIC;
