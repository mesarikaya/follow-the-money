-- V30: Add flow_surge alert rule.
-- Fires when FLOW_20D z-score crosses above 2.0 (detected via FLOW_SURGE rotation event).
-- z > 2.0 means dollar volume is 2+ standard deviations above the 20-day rolling average —
-- an institutional inflow spike that often precedes composite score improvement by 1-3 days.
-- Resolves when flow z-score drops back below 1.0 (surge has dissipated).

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('flow_surge', TRUE, 2.0, NULL, NULL, 'INFO', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
