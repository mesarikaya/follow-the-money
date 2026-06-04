INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('high_conviction_reduce_cluster', TRUE, NULL, NULL, NULL, 'ACTION', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
