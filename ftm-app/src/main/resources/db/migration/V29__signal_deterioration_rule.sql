-- V29: Add signal_deterioration alert rule.
-- Fires when a category is in BUY territory (composite ≥ 0.65) but shows rapid 5-day score decline
-- (trend5d < -0.05) — the "deteriorating BUY" scenario. Warns to monitor for signal exit.
-- Distinct from score_approaching_reduce (threshold proximity) and breadth_velocity_decel (breadth).

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('signal_deterioration', TRUE, NULL, NULL, NULL, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
