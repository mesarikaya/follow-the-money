-- V6: investment holdings for portfolio upload feature (EP-012)
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

CREATE INDEX idx_holdings_ticker      ON holdings (ticker);
CREATE INDEX idx_holdings_category_id ON holdings (category_id);
