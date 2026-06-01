-- Early-warning alert: fires when composite score enters (0.35, 0.45] from above.
-- Gives the user 1-5 days advance notice before a full REDUCE signal
-- (which requires score < 0.35 AND RRG quadrant 1/2).
-- Resolves when score recovers above 0.50 or drops to full REDUCE zone (< 0.35).
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
    ('score_approaching_reduce', TRUE, NULL, NULL, 0.45, 'WARNING', NULL, NULL, NOW());
