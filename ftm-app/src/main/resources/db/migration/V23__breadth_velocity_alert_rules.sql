-- V23: Add breadth velocity alert rules.
-- breadth_velocity_accel: fires when recent-5d breadth hit-rate exceeds prior-15d baseline by ≥+10pp
--   — early rotation signal: breadth is accelerating before RS-60 catches up.
-- breadth_velocity_decel: fires when recent-5d breadth hit-rate falls below prior-15d baseline by ≥-10pp
--   — deterioration warning: breadth fading before RS-60 rolls over.

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
    ('breadth_velocity_accel', TRUE, NULL, NULL, NULL, 'INFO',    NULL, NULL, NOW()),
    ('breadth_velocity_decel', TRUE, NULL, NULL, NULL, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
