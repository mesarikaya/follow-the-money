INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('theme_phase_fading', TRUE, NULL, NULL, NULL, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
