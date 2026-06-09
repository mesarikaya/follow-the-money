-- theme_distribute_warning: fires when a theme's avg composite score is in BUY territory (>=0.65)
-- but the average 20d flow signal is significantly negative (<=-0.5σ), indicating
-- that institutional money is quietly exiting a still-elevated theme — classic distribution top.
-- Severity: WARNING (early warning, not a crash signal)

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('theme_distribute_warning', TRUE, NULL, NULL, 0.65, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
