-- Seed theme acceleration alert rule (V52)
-- theme_5d_acceleration: fires when a theme's 5d composite trend avg exceeds its 20d trend avg
-- by >= 0.008 (0.8pt/day), signalling a regime shift or breakout in momentum.
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('theme_5d_acceleration', TRUE, NULL, NULL, NULL, 'ACTION', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
