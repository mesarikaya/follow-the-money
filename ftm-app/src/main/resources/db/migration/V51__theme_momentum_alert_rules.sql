-- Seed theme momentum alert rules (V51)
-- theme_momentum_surge: fires when a theme's avg 20d composite trend velocity exceeds +0.010
-- theme_momentum_collapse: fires when a theme's avg 20d composite trend velocity drops below -0.010
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
  ('theme_momentum_surge',    TRUE, NULL, NULL, NULL, 'ACTION',  NULL, NULL, NOW()),
  ('theme_momentum_collapse', TRUE, NULL, NULL, NULL, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
