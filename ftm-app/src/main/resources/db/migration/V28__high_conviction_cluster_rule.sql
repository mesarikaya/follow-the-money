-- Alert rule: fires when ≥3 equity sectors simultaneously reach HIGH conviction (≥75).
-- A cluster of high-conviction BUYs indicates a broad RISK-ON regime shift, not just
-- individual sector momentum. Resolves when the cluster drops below 2.
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
    ('high_conviction_cluster', TRUE, NULL, NULL, NULL, 'ACTION', NULL, '{"minClusterSize": 3, "convictionThreshold": 75}', NOW());
