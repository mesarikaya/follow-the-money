-- SPY benchmark prices were seeded with placeholder adj_close = 200.0 covering
-- 2024-02-20 through 2024-06-30 (130 rows).  The real SPY price in Feb 2024 was ~$495,
-- so the backtest computed a ~270% SPY return instead of the actual ~50%, inflating the
-- "Excess Return" metric by ~220 percentage points.
--
-- Deleting ALL SPY rows forces the next ingestion run to backfill 7 years of correct
-- historical data (see PricesIngestionHandler.BACKFILL_YEARS = 7).
DELETE FROM benchmark_prices WHERE ticker = 'SPY';
