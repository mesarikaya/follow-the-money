-- V10: Deactivate sub-sector entries whose ETF tickers no longer trade on Yahoo Finance.
--
-- EATZ (Amplify Restaurant ETF) delisted August 2022.
-- RTL (Necessity Retail REIT) delisted/restructured 2023.
-- FIVG (Defiance 5G ETF) merged into NXTG (First Trust Indxx NextG ETF) 2022.

UPDATE categories SET active = false WHERE id = 'DISR_REST';  -- EATZ delisted
UPDATE categories SET active = false WHERE id = 'REIT_RETL';  -- RTL delisted
UPDATE categories SET etf_ticker = 'NXTG' WHERE id = 'COMM_FIVG';  -- FIVG → NXTG (successor ETF)
UPDATE categories SET etf_ticker = 'NXTG' WHERE id = 'TECH_FIVG';  -- same ticker used in TECH branch
