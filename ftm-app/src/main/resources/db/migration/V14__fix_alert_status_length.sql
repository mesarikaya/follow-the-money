-- V14: expand alerts.status column to accommodate 'ACKNOWLEDGED' (12 chars)
-- The original varchar(10) was too short; only 'ACTIVE' and 'RESOLVED' fit.
ALTER TABLE alerts ALTER COLUMN status TYPE VARCHAR(15);
