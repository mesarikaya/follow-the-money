-- V8: Factor ETF categories (MTUM, QUAL, USMV, VLUE).
-- Virtual parent FTRS groups factor ETFs; active=false so it is never ingested.
-- Factor ETFs have parent_id=FTRS, so existing parent_id IS NULL filters
-- automatically exclude them from the main heatmap, portfolio, and backtester.

INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, active) VALUES
    ('FTRS', 'Factor ETFs', 'EQUITY_SECTOR', 'SPY', 'SPY', 200, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('MTUM', 'Momentum Factor',        'EQUITY_SECTOR', 'MTUM', 'SPY', 201, 'FTRS'),
    ('QUAL', 'Quality Factor',         'EQUITY_SECTOR', 'QUAL', 'SPY', 202, 'FTRS'),
    ('USMV', 'Low Volatility Factor',  'EQUITY_SECTOR', 'USMV', 'SPY', 203, 'FTRS'),
    ('VLUE', 'Value Factor',           'EQUITY_SECTOR', 'VLUE', 'SPY', 204, 'FTRS')
ON CONFLICT (id) DO NOTHING;
