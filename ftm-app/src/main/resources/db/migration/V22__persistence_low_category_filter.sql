-- Scope persistence_low to EQUITY_SECTOR categories only.
-- Non-equity assets (BIL, TLT, GLD) consistently lag SPY as a benchmark
-- in risk-on regimes and would generate spurious alerts.
UPDATE alert_rules
SET category_filter = '"EQUITY_SECTOR"',
    last_updated    = NOW()
WHERE rule_id = 'persistence_low';
