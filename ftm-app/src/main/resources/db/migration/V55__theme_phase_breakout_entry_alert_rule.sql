-- V55: theme_phase_breakout_entry alert rule.
-- Fires when a theme transitions INTO the BREAKOUT phase (was not BREAKOUT 5 trading days ago).
-- This is the highest-conviction entry signal in the theme lifecycle — BREAKOUT means score >= 0.65
-- with 5d trend accelerating above the 20d trend, indicating a regime change is in progress.

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('theme_phase_breakout_entry', TRUE, NULL, NULL, 0.65, 'ACTION', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
