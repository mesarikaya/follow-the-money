-- V20: Add composite_breakdown alert rule
-- Fires when a category composite score falls below 0.35 (REDUCE threshold).

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('composite_breakdown', TRUE, NULL, NULL, 0.350, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
