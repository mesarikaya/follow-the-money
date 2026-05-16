-- V5: rename aum_usd to assets_under_management_usd for naming consistency
ALTER TABLE raw_prices RENAME COLUMN aum_usd TO assets_under_management_usd;
