-- V71: Ensure the most common US holdings classify to a category.
--
-- Investigation (2026-07-12) found a typical brokerage portfolio (AAPL, HD, sector SPDRs, GLD,
-- TLT, ...) mostly failed to classify — many core large-caps and ETFs had no ticker_category_map
-- row, so uploaded holdings landed as "unclassified" (HoldingUploadService collects them with a
-- null category). This is an idempotent top-up: ON CONFLICT (ticker) DO NOTHING means it only fills
-- gaps and never overwrites an existing or user-edited mapping, and it is safe to re-run.
--
-- Every category_id below is a confirmed row in `categories` (the 19 top-level sectors/fixed-income/
-- metals/cash plus the SEMI/SOFT sub-sectors already used by earlier seeds).
--
-- DELIBERATELY EXCLUDED: broad-market ETFs (SPY, VOO, IVV, VTI, VT, DIA, IWM). They represent the
-- whole market, not a single sector; mapping them to one sector would distort the portfolio's
-- signals. They are better left unclassified until a dedicated broad-market handling exists.

INSERT INTO ticker_category_map (ticker, category_id, notes) VALUES
    -- Mega-cap technology & software
    ('AAPL',  'TECH', 'Apple'),
    ('CSCO',  'TECH', 'Cisco Systems'),
    ('IBM',   'TECH', 'IBM'),
    ('ORCL',  'SOFT', 'Oracle — enterprise software'),
    ('CRM',   'SOFT', 'Salesforce'),
    ('ADBE',  'SOFT', 'Adobe'),
    ('NOW',   'SOFT', 'ServiceNow'),
    ('INTU',  'SOFT', 'Intuit'),
    -- Semiconductors
    ('AVGO',  'SEMI', 'Broadcom'),
    ('TXN',   'SEMI', 'Texas Instruments'),
    ('AMAT',  'SEMI', 'Applied Materials'),
    ('LRCX',  'SEMI', 'Lam Research'),
    ('ADI',   'SEMI', 'Analog Devices'),
    ('KLAC',  'SEMI', 'KLA Corp'),
    -- Communication services
    ('GOOGL', 'COMM', 'Alphabet Class A'),
    ('T',     'COMM', 'AT&T'),
    ('VZ',    'COMM', 'Verizon'),
    ('TMUS',  'COMM', 'T-Mobile US'),
    -- Consumer discretionary
    ('AMZN',  'DISR', 'Amazon'),
    ('TSLA',  'DISR', 'Tesla'),
    ('HD',    'DISR', 'Home Depot'),
    ('MCD',   'DISR', 'McDonald''s'),
    ('NKE',   'DISR', 'Nike'),
    ('LOW',   'DISR', 'Lowe''s'),
    ('SBUX',  'DISR', 'Starbucks'),
    ('BKNG',  'DISR', 'Booking Holdings'),
    ('TJX',   'DISR', 'TJX Companies'),
    -- Consumer staples
    ('WMT',   'STPL', 'Walmart'),
    ('COST',  'STPL', 'Costco'),
    ('MDLZ',  'STPL', 'Mondelez'),
    ('CL',    'STPL', 'Colgate-Palmolive'),
    -- Financials
    ('JPM',   'FINL', 'JPMorgan Chase'),
    ('BAC',   'FINL', 'Bank of America'),
    ('WFC',   'FINL', 'Wells Fargo'),
    ('C',     'FINL', 'Citigroup'),
    ('GS',    'FINL', 'Goldman Sachs'),
    ('MS',    'FINL', 'Morgan Stanley'),
    ('AXP',   'FINL', 'American Express'),
    ('BLK',   'FINL', 'BlackRock'),
    ('SCHW',  'FINL', 'Charles Schwab'),
    ('SPGI',  'FINL', 'S&P Global'),
    ('BRK.B', 'FINL', 'Berkshire Hathaway Class B'),
    ('BRK-B', 'FINL', 'Berkshire Hathaway Class B (dash form)'),
    -- Energy
    ('XOM',   'ENRG', 'Exxon Mobil'),
    ('CVX',   'ENRG', 'Chevron'),
    ('COP',   'ENRG', 'ConocoPhillips'),
    ('SLB',   'ENRG', 'Schlumberger'),
    ('EOG',   'ENRG', 'EOG Resources'),
    ('MPC',   'ENRG', 'Marathon Petroleum'),
    ('PSX',   'ENRG', 'Phillips 66'),
    -- Healthcare
    ('TMO',   'HLTH', 'Thermo Fisher Scientific'),
    ('ABT',   'HLTH', 'Abbott Laboratories'),
    ('DHR',   'HLTH', 'Danaher'),
    ('AMGN',  'HLTH', 'Amgen'),
    ('BMY',   'HLTH', 'Bristol-Myers Squibb'),
    ('GILD',  'HLTH', 'Gilead Sciences'),
    ('CVS',   'HLTH', 'CVS Health'),
    -- Industrials
    ('CAT',   'INDU', 'Caterpillar'),
    ('DE',    'INDU', 'Deere & Co'),
    ('GE',    'INDU', 'GE Aerospace'),
    ('HON',   'INDU', 'Honeywell'),
    ('UPS',   'INDU', 'United Parcel Service'),
    ('UNP',   'INDU', 'Union Pacific'),
    ('MMM',   'INDU', '3M'),
    -- Materials
    ('LIN',   'MATL', 'Linde'),
    ('SHW',   'MATL', 'Sherwin-Williams'),
    ('FCX',   'MATL', 'Freeport-McMoRan — copper'),
    ('APD',   'MATL', 'Air Products & Chemicals'),
    -- Utilities
    ('NEE',   'UTIL', 'NextEra Energy'),
    ('DUK',   'UTIL', 'Duke Energy'),
    ('SO',    'UTIL', 'Southern Company'),
    ('D',     'UTIL', 'Dominion Energy'),
    -- Real estate
    ('AMT',   'REIT', 'American Tower'),
    ('PLD',   'REIT', 'Prologis'),
    ('O',     'REIT', 'Realty Income'),
    ('SPG',   'REIT', 'Simon Property Group'),
    ('EQIX',  'REIT', 'Equinix'),
    -- Sector SPDR ETFs
    ('XLK',   'TECH', 'Technology Select Sector SPDR'),
    ('XLF',   'FINL', 'Financial Select Sector SPDR'),
    ('XLE',   'ENRG', 'Energy Select Sector SPDR'),
    ('XLV',   'HLTH', 'Health Care Select Sector SPDR'),
    ('XLI',   'INDU', 'Industrial Select Sector SPDR'),
    ('XLY',   'DISR', 'Consumer Discretionary Select Sector SPDR'),
    ('XLP',   'STPL', 'Consumer Staples Select Sector SPDR'),
    ('XLU',   'UTIL', 'Utilities Select Sector SPDR'),
    ('XLB',   'MATL', 'Materials Select Sector SPDR'),
    ('XLRE',  'REIT', 'Real Estate Select Sector SPDR'),
    ('XLC',   'COMM', 'Communication Services Select Sector SPDR'),
    -- Tech / thematic index ETFs
    ('QQQ',   'TECH', 'Invesco QQQ Trust — Nasdaq-100 (tech-dominated)'),
    ('VGT',   'TECH', 'Vanguard Information Technology ETF'),
    ('IYW',   'TECH', 'iShares US Technology ETF'),
    ('SOXX',  'SEMI', 'iShares Semiconductor ETF'),
    ('SMH',   'SEMI', 'VanEck Semiconductor ETF'),
    -- Precious-metals ETFs
    ('GLD',   'GOLD', 'SPDR Gold Shares'),
    ('IAU',   'GOLD', 'iShares Gold Trust'),
    ('SLV',   'SLVR', 'iShares Silver Trust'),
    ('GDX',   'GDMN', 'VanEck Gold Miners ETF'),
    ('GDXJ',  'GDMN', 'VanEck Junior Gold Miners ETF'),
    ('NEM',   'GDMN', 'Newmont — gold miner'),
    -- Fixed-income ETFs
    ('TLT',   'TLTD', 'iShares 20+ Year Treasury Bond ETF'),
    ('IEF',   'TINT', 'iShares 7-10 Year Treasury Bond ETF'),
    ('SHY',   'TINT', 'iShares 1-3 Year Treasury Bond ETF'),
    ('LQD',   'CORP', 'iShares iBoxx Investment Grade Corporate Bond ETF'),
    ('VCIT',  'CORP', 'Vanguard Intermediate-Term Corporate Bond ETF'),
    ('AGG',   'CORP', 'iShares Core US Aggregate Bond ETF'),
    ('BND',   'CORP', 'Vanguard Total Bond Market ETF'),
    ('HYG',   'HIYLD', 'iShares iBoxx High Yield Corporate Bond ETF'),
    ('JNK',   'HIYLD', 'SPDR Bloomberg High Yield Bond ETF'),
    -- Cash / ultra-short
    ('BIL',   'CASH', 'SPDR Bloomberg 1-3 Month T-Bill ETF'),
    ('SGOV',  'CASH', 'iShares 0-3 Month Treasury Bond ETF'),
    ('SHV',   'CASH', 'iShares Short Treasury Bond ETF')
ON CONFLICT (ticker) DO NOTHING;
