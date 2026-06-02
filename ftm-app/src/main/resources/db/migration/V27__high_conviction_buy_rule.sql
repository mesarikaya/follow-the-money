-- Alert rule for high-conviction BUY signals.
-- high_conviction_buy: fires when a category's multi-factor conviction score reaches >= 75
-- (signal quality + score level + macro fit + 252d percentile standing + momentum acceleration).
-- Resolves when conviction drops below 65 (grace band prevents thrashing).
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
    ('high_conviction_buy', TRUE, NULL, NULL, 0.65, 'ACTION', NULL, NULL, NOW());
