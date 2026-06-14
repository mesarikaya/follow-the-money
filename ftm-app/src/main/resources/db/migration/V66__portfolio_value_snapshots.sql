-- V66: daily portfolio value snapshots and FX rate history for progress tracking
CREATE TABLE portfolio_value_snapshots (
    id             BIGSERIAL    PRIMARY KEY,
    snapshot_date  DATE         NOT NULL,
    total_value_eur NUMERIC(18,2) NOT NULL,
    total_cost_eur  NUMERIC(18,2),
    holding_count  INTEGER      NOT NULL DEFAULT 0,
    captured_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_date)
);

CREATE TABLE fx_rates_history (
    id            BIGSERIAL    PRIMARY KEY,
    snapshot_date DATE         NOT NULL,
    currency_pair VARCHAR(20)  NOT NULL,
    rate          NUMERIC(18,8) NOT NULL,
    source        VARCHAR(50)  NOT NULL DEFAULT 'YAHOO',
    captured_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_date, currency_pair)
);

CREATE INDEX idx_portfolio_snapshots_date ON portfolio_value_snapshots (snapshot_date DESC);
CREATE INDEX idx_fx_rates_history_date    ON fx_rates_history (snapshot_date DESC, currency_pair);
