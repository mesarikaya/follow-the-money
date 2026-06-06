-- Add theme_id to alerts for cross-sector theme-level alert deduplication
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS theme_id VARCHAR(30);

-- Rebuild unique index to include theme_id as a discriminator alongside category_id
DROP INDEX IF EXISTS uix_alerts_one_active_per_rule;
CREATE UNIQUE INDEX uix_alerts_one_active_per_rule
    ON alerts (COALESCE(category_id, theme_id, '__global__'), rule_id)
    WHERE status = 'ACTIVE';

-- Seed the theme dominant-signal transition rule
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('theme_dominant_signal_transition', TRUE, NULL, NULL, 0.65, 'ACTION', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
