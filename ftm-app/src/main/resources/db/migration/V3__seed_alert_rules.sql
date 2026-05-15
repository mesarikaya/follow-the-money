-- V3: Seed default alert rules — Balanced profile.
-- Thresholds are provisional RFC-0003 defaults; update when RFC-0003 is resolved (before M5).
-- z_threshold: positive = inflow trigger (z > threshold), negative = outflow trigger (z < threshold)
-- persistence_days: minimum consecutive qualifying days before alert fires

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated) VALUES
    ('flow_inflow_5d',      TRUE,  1.50,  3, NULL,  'WARNING', NULL, NULL, NOW()),
    ('flow_inflow_10d',     TRUE,  1.50,  6, NULL,  'WARNING', NULL, NULL, NOW()),
    ('flow_inflow_20d',     TRUE,  1.50, 12, NULL,  'ACTION',  NULL, NULL, NOW()),
    ('flow_outflow_5d',     TRUE, -1.50,  3, NULL,  'WARNING', NULL, NULL, NOW()),
    ('flow_outflow_10d',    TRUE, -1.50,  6, NULL,  'WARNING', NULL, NULL, NOW()),
    ('flow_outflow_20d',    TRUE, -1.50, 12, NULL,  'ACTION',  NULL, NULL, NOW()),
    ('rrg_transition',      TRUE,  NULL, NULL, NULL, 'INFO',    NULL, NULL, NOW()),
    ('composite_breakout',  TRUE,  NULL, NULL, 0.600, 'ACTION', NULL, NULL, NOW()),
    ('macro_regime_shift',  TRUE,  NULL, NULL, NULL, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
