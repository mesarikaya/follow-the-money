-- V4: backtest_results table for historical strategy validation (EP-011)
CREATE TABLE backtest_results (
    run_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    start_date              DATE         NOT NULL,
    end_date                DATE         NOT NULL,
    rebalance_frequency     VARCHAR(10)  NOT NULL CHECK (rebalance_frequency IN ('WEEKLY','MONTHLY')),
    top_n                   INTEGER      NOT NULL DEFAULT 5,
    signal_threshold        NUMERIC(4,3),
    total_return_pct        NUMERIC(10,4),
    annualized_return_pct   NUMERIC(10,4),
    max_drawdown_pct        NUMERIC(10,4),
    sharpe_ratio            NUMERIC(10,4),
    spy_total_return_pct    NUMERIC(10,4),
    spy_sharpe_ratio        NUMERIC(10,4),
    trading_days            INTEGER,
    equity_curve            JSONB,
    metadata                JSONB
);

CREATE INDEX idx_backtest_run_at ON backtest_results (run_at DESC);
