-- Allow QUARTERLY as a valid rebalance_frequency (was missing from the original CHECK constraint)
ALTER TABLE backtest_results DROP CONSTRAINT IF EXISTS backtest_results_rebalance_frequency_check;
ALTER TABLE backtest_results ADD CONSTRAINT backtest_results_rebalance_frequency_check
    CHECK (rebalance_frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY'));
