-- V16: Add RS acceleration crossover alert rule.
-- Fires when the 60-day RS crosses above or below the 120-day RS baseline,
-- indicating a short-term momentum shift relative to the long-term trend.

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated) VALUES
    ('rs_accel_crossover', TRUE, NULL, NULL, NULL, 'INFO', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
