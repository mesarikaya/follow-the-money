-- V13: add live-price columns to holdings so Yahoo Finance prices can be stored
-- alongside the user-supplied avg_cost_local values.
ALTER TABLE holdings
    ADD COLUMN current_price_local NUMERIC(18,4),
    ADD COLUMN price_date          DATE,
    ADD COLUMN price_source        VARCHAR(20);
