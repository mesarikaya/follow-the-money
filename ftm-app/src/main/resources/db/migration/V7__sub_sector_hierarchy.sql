-- V7: Sub-sector hierarchy for Technology category.
-- Adds parent_id column and seeds 4 Technology sub-sectors.

ALTER TABLE categories
    ADD COLUMN parent_id VARCHAR(10) REFERENCES categories(id);

INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('SEMI', 'Semiconductors',   'EQUITY_SECTOR', 'SMH',  'XLK', 101, 'TECH'),
    ('AIRO', 'AI & Robotics',    'EQUITY_SECTOR', 'BOTZ', 'XLK', 102, 'TECH'),
    ('CLOD', 'Cloud Computing',  'EQUITY_SECTOR', 'WCLD', 'XLK', 103, 'TECH'),
    ('SOFT', 'Software',         'EQUITY_SECTOR', 'IGV',  'XLK', 104, 'TECH')
ON CONFLICT (id) DO NOTHING;
