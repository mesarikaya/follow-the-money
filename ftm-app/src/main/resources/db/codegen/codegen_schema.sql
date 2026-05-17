-- V1: Initial schema for Follow the Money
-- All DDL per spec.md Data Model section.
-- Flyway owns all DDL; Hibernate validates only.

CREATE TABLE categories (
    id               VARCHAR(10)  PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    type             VARCHAR(20)  NOT NULL CHECK (type IN ('EQUITY_SECTOR','PRECIOUS_METAL','FIXED_INCOME','CASH')),
    etf_ticker       VARCHAR(10)  NOT NULL,
    benchmark_ticker VARCHAR(10)  NOT NULL,
    display_order    INTEGER      NOT NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    parent_id        VARCHAR(10)  REFERENCES categories(id)
);

CREATE TABLE raw_prices (
    trade_date       DATE          NOT NULL,
    category_id      VARCHAR(10)   NOT NULL REFERENCES categories(id),
    open             NUMERIC(12,4) NOT NULL,
    high             NUMERIC(12,4) NOT NULL,
    low              NUMERIC(12,4) NOT NULL,
    close            NUMERIC(12,4) NOT NULL,
    adj_close        NUMERIC(12,4) NOT NULL,
    volume           BIGINT        NOT NULL,
    aum_usd          NUMERIC(18,2),
    estimated_flow   NUMERIC(18,2),
    PRIMARY KEY (trade_date, category_id)
);

CREATE INDEX idx_raw_prices_category_date ON raw_prices (category_id, trade_date DESC);

CREATE TABLE benchmark_prices (
    trade_date  DATE          NOT NULL,
    ticker      VARCHAR(10)   NOT NULL,
    adj_close   NUMERIC(12,4) NOT NULL,
    PRIMARY KEY (trade_date, ticker)
);

CREATE TABLE macro_indicators (
    observation_date DATE        NOT NULL,
    series_id        VARCHAR(20) NOT NULL,
    value            NUMERIC(10,4),
    source           VARCHAR(10) NOT NULL DEFAULT 'FRED',
    PRIMARY KEY (observation_date, series_id)
);

CREATE TABLE signals (
    signal_date  DATE          NOT NULL,
    category_id  VARCHAR(10)   NOT NULL REFERENCES categories(id),
    signal_type  VARCHAR(30)   NOT NULL,
    value        NUMERIC(10,6),
    metadata     JSONB,
    computed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (signal_date, category_id, signal_type)
);

CREATE INDEX idx_signals_category_date ON signals (category_id, signal_date DESC);
CREATE INDEX idx_signals_type_date     ON signals (signal_type, signal_date DESC);

CREATE TABLE rotation_events (
    id               BIGSERIAL    PRIMARY KEY,
    detected_date    DATE         NOT NULL,
    category_id      VARCHAR(10)  NOT NULL REFERENCES categories(id),
    event_type       VARCHAR(30)  NOT NULL CHECK (event_type IN ('ENTERING_IMPROVING','ENTERING_LEADING','FLOW_SURGE','COMPOSITE_BREAKOUT')),
    confidence       NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    signal_snapshot  JSONB        NOT NULL,
    notes            TEXT
);

CREATE INDEX idx_rotation_events_date ON rotation_events (detected_date DESC);

CREATE TABLE portfolio (
    category_id    VARCHAR(10)   PRIMARY KEY REFERENCES categories(id),
    allocation_pct NUMERIC(5,2)  NOT NULL CHECK (allocation_pct >= 0),
    last_updated   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    notes          TEXT
);

CREATE TABLE alert_rules (
    rule_id             VARCHAR(40) PRIMARY KEY,
    enabled             BOOLEAN     NOT NULL DEFAULT TRUE,
    z_threshold         NUMERIC(4,2),
    persistence_days    INTEGER,
    composite_threshold NUMERIC(4,3),
    severity            VARCHAR(10) NOT NULL CHECK (severity IN ('INFO','WARNING','ACTION')),
    category_filter     JSONB,
    config              JSONB,
    last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alerts (
    id               BIGSERIAL    PRIMARY KEY,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    category_id      VARCHAR(10)  REFERENCES categories(id),
    rule_id          VARCHAR(40)  NOT NULL REFERENCES alert_rules(rule_id),
    severity         VARCHAR(10)  NOT NULL CHECK (severity IN ('INFO','WARNING','ACTION')),
    message          TEXT         NOT NULL,
    trigger_snapshot JSONB        NOT NULL,
    status           VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE'
                                  CHECK (status IN ('ACTIVE','RESOLVED','ACKNOWLEDGED')),
    resolved_at      TIMESTAMPTZ,
    acknowledged_at  TIMESTAMPTZ,
    UNIQUE (category_id, rule_id, status)
);

CREATE INDEX idx_alerts_active   ON alerts (created_at DESC) WHERE status = 'ACTIVE';
CREATE INDEX idx_alerts_severity ON alerts (severity, created_at DESC) WHERE status = 'ACTIVE';

CREATE TABLE ingest_log (
    run_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at    TIMESTAMPTZ  NOT NULL,
    finished_at   TIMESTAMPTZ,
    status        VARCHAR(10)  NOT NULL CHECK (status IN ('RUNNING','SUCCESS','PARTIAL','FAILED')),
    rows_inserted INTEGER      NOT NULL DEFAULT 0,
    errors        JSONB,
    source        VARCHAR(10)  NOT NULL CHECK (source IN ('PRICES','MACRO','FLOWS'))
);

-- V5 rename:
ALTER TABLE raw_prices RENAME COLUMN aum_usd TO assets_under_management_usd;

-- V4: backtest_results
CREATE TABLE backtest_results (
    run_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    start_date              DATE         NOT NULL,
    end_date                DATE         NOT NULL,
    rebalance_frequency     VARCHAR(10)  NOT NULL,
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

-- V6: investment holdings
CREATE TABLE holdings (
    id                  BIGSERIAL       PRIMARY KEY,
    ticker              VARCHAR(20)     NOT NULL,
    name                VARCHAR(200),
    category_id         VARCHAR(10)     REFERENCES categories(id),
    currency            VARCHAR(3)      NOT NULL DEFAULT 'USD',
    quantity            NUMERIC(18,6)   NOT NULL,
    avg_cost_local      NUMERIC(18,4),
    usd_fx_rate         NUMERIC(18,6),
    uploaded_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
