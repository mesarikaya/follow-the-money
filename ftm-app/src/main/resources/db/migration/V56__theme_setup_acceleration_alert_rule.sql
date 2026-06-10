-- V56: theme_setup_acceleration alert rule.
-- Fires when a theme is in SETUP phase (avg score 0.52-0.64) with strong 5d upward momentum
-- (avg 5d trend >= 0.008 pt/day). This is the pre-breakout early-entry signal — fires BEFORE
-- theme_phase_breakout_entry, giving the user advance warning to watch/accumulate.
-- Resolves when score reaches BUY territory (>=0.65) or setup fails (score <0.48 or trend stalls).
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('theme_setup_acceleration', TRUE, NULL, NULL, NULL, 'ACTION', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
