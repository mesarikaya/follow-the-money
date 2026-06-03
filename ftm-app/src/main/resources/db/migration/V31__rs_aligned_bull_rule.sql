-- V31: Add rs_aligned_bull alert rule.
-- Fires when RS-20 > RS-60 > RS-120 — all three relative-strength timeframes align bullishly.
-- This multi-horizon alignment means short-term momentum is outpacing both medium and long-term,
-- indicating momentum is building across all windows — a strong confirmation for BUY/WATCH sectors.
-- Resolves when RS-20 drops back to or below RS-60 (alignment breaks).

INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES ('rs_aligned_bull', TRUE, NULL, NULL, NULL, 'INFO', NULL, NULL, NOW())
ON CONFLICT (rule_id) DO NOTHING;
