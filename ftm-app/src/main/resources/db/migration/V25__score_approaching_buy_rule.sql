-- Early-warning alert: fires when composite score enters [0.55, 0.65) from below.
-- This gives the user 1-5 days advance notice before a full BUY signal
-- (which requires score >= 0.65 AND RRG quadrant 3/4 AND positive 20d trend).
-- Resolves when score drops back below 0.50 or rises to full BUY threshold.
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
    ('score_approaching_buy', TRUE, NULL, NULL, 0.55, 'INFO', NULL, NULL, NOW());
