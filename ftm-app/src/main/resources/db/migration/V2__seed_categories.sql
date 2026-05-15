-- V2: Seed all 19 investable categories per spec.md investable universe table.

INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order) VALUES
    ('TECH',  'Information Technology',         'EQUITY_SECTOR',  'XLK',  'SPY',  1),
    ('HLTH',  'Health Care',                    'EQUITY_SECTOR',  'XLV',  'SPY',  2),
    ('FINL',  'Financials',                     'EQUITY_SECTOR',  'XLF',  'SPY',  3),
    ('DISR',  'Consumer Discretionary',         'EQUITY_SECTOR',  'XLY',  'SPY',  4),
    ('INDU',  'Industrials',                    'EQUITY_SECTOR',  'XLI',  'SPY',  5),
    ('ENRG',  'Energy',                         'EQUITY_SECTOR',  'XLE',  'SPY',  6),
    ('MATL',  'Materials',                      'EQUITY_SECTOR',  'XLB',  'SPY',  7),
    ('UTIL',  'Utilities',                      'EQUITY_SECTOR',  'XLU',  'SPY',  8),
    ('REIT',  'Real Estate',                    'EQUITY_SECTOR',  'XLRE', 'SPY',  9),
    ('STPL',  'Consumer Staples',               'EQUITY_SECTOR',  'XLP',  'SPY', 10),
    ('COMM',  'Communication Services',         'EQUITY_SECTOR',  'XLC',  'SPY', 11),
    ('GOLD',  'Gold',                           'PRECIOUS_METAL', 'GLD',  'SPY', 12),
    ('SLVR',  'Silver',                         'PRECIOUS_METAL', 'SLV',  'SPY', 13),
    ('GDMN',  'Gold Miners',                    'PRECIOUS_METAL', 'GDX',  'SPY', 14),
    ('TLTD',  'Long-Duration Treasuries',       'FIXED_INCOME',   'TLT',  'AGG', 15),
    ('TINT',  'Intermediate Treasuries',        'FIXED_INCOME',   'IEF',  'AGG', 16),
    ('CORP',  'Investment Grade Corporate',     'FIXED_INCOME',   'LQD',  'AGG', 17),
    ('HIYLD', 'High Yield',                     'FIXED_INCOME',   'HYG',  'AGG', 18),
    ('CASH',  'Cash & Short-Term',              'CASH',           'BIL',  'SPY', 19)
ON CONFLICT (id) DO NOTHING;
