-- Record the full run configuration on each saved backtest so /recent runs are self-describing and
-- reproducible. Previously only start/end/frequency/topN/threshold were persisted, leaving the
-- signal source (COMPOSITE vs 12-1 momentum), category scope, invert flag, trend filter, and
-- transaction cost invisible — two runs with very different results looked identical. All nullable
-- so existing rows remain valid.
ALTER TABLE backtest_results
    ADD COLUMN signal_source        VARCHAR(32),
    ADD COLUMN category_scope       VARCHAR(32),
    ADD COLUMN invert_signal        BOOLEAN,
    ADD COLUMN trend_filter         BOOLEAN,
    ADD COLUMN transaction_cost_bps INTEGER;
