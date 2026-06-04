INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('rs_breadth_bull', TRUE, NULL, NULL, NULL, 'INFO', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
