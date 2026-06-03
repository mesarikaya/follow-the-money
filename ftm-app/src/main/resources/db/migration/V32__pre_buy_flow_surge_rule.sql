-- V32: Add pre_buy_flow_surge alert rule.
-- Fires when a sector is in the pre-BUY approach zone (composite score 0.55–0.65)
-- AND institutional flow is surging (FLOW_20D z-score ≥ 1.5).
-- Institutions rotate into sectors before the full composite BUY signal fires —
-- this combination catches that leading-edge positioning early.
-- Resolves when the score exits the approach zone (drops below 0.55 or crosses 0.65 BUY),
-- or when the flow surge dissipates (z drops below 0.8).

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('pre_buy_flow_surge', TRUE, 1.5, NULL, 0.55, 'WARNING', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
