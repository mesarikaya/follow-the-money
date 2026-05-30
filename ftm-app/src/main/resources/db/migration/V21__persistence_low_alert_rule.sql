-- V21: Add persistence_low alert rule
-- Fires when a sector beats its benchmark on fewer than 7 of the last 20 trading days.
-- Persistence < 7/20 (35%) signals broad deterioration in day-by-day outperformance,
-- a leading indicator of trend reversal before RS_60 rolls over.

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('persistence_low', TRUE, NULL, 7, NULL, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
