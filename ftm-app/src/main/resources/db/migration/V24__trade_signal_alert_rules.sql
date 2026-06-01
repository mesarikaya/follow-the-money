-- Alert rules for full trade signal transitions.
-- trade_signal_buy: fires when all three BUY conditions align simultaneously
--   (COMPOSITE >= 0.65 AND RRG quadrant 3 or 4 AND COMPOSITE_TREND_20D > 0)
--   for the first time (transition from non-BUY to BUY state).
-- trade_signal_reduce: fires when REDUCE conditions align
--   (COMPOSITE < 0.35 AND RRG quadrant 1 or 2).
INSERT INTO alert_rules (rule_id, enabled, z_threshold, persistence_days, composite_threshold, severity, category_filter, config, last_updated)
VALUES
    ('trade_signal_buy',    TRUE, NULL, NULL, 0.65, 'ACTION',  NULL, NULL, NOW()),
    ('trade_signal_reduce', TRUE, NULL, NULL, 0.35, 'WARNING', NULL, NULL, NOW());
