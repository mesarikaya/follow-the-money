-- V12: replace the blanket unique constraint on (category_id, rule_id, status)
-- with a partial unique index that only prevents duplicate ACTIVE alerts per rule.
-- The old constraint blocked acknowledging an alert if another ACKNOWLEDGED row
-- already existed for the same (category_id, rule_id) tuple.
ALTER TABLE alerts DROP CONSTRAINT alerts_category_id_rule_id_status_key;

CREATE UNIQUE INDEX uix_alerts_one_active_per_rule
    ON alerts (COALESCE(category_id, '__global__'), rule_id)
    WHERE status = 'ACTIVE';
