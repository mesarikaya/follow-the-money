-- V11: Ticker-to-category classification table.
-- Replaces the hardcoded map in HoldingClassificationService with a DB-managed lookup.
-- Supports CRUD via /api/v1/admin/ticker-mappings endpoint.

CREATE TABLE ticker_category_map (
    ticker      VARCHAR(20)  PRIMARY KEY,
    category_id VARCHAR(10)  NOT NULL REFERENCES categories(id),
    notes       VARCHAR(200),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticker_category_map_category ON ticker_category_map (category_id);

-- Seed from HoldingClassificationService hardcoded map

INSERT INTO ticker_category_map (ticker, category_id, notes) VALUES

-- Equity sector ETFs (US)
('XLK',   'TECH',  'Technology Select Sector SPDR'),
('QQQ',   'TECH',  'Invesco QQQ Trust'),
('VGT',   'TECH',  'Vanguard Information Technology ETF'),
('SOXX',  'TECH',  'iShares Semiconductor ETF'),
('SMH',   'TECH',  'VanEck Semiconductor ETF'),
('XLF',   'FINL',  'Financial Select Sector SPDR'),
('VFH',   'FINL',  'Vanguard Financials ETF'),
('KRE',   'FINL',  'SPDR S&P Regional Banking ETF'),
('XLE',   'ENRG',  'Energy Select Sector SPDR'),
('VDE',   'ENRG',  'Vanguard Energy ETF'),
('OIH',   'ENRG',  'VanEck Oil Services ETF'),
('XLV',   'HLTH',  'Health Care Select Sector SPDR'),
('IBB',   'HLTH',  'iShares Biotechnology ETF'),
('VHT',   'HLTH',  'Vanguard Health Care ETF'),
('XLY',   'DISR',  'Consumer Discretionary Select Sector SPDR'),
('VCR',   'DISR',  'Vanguard Consumer Discretionary ETF'),
('XLP',   'STPL',  'Consumer Staples Select Sector SPDR'),
('VDC',   'STPL',  'Vanguard Consumer Staples ETF'),
('XLI',   'INDU',  'Industrial Select Sector SPDR'),
('VIS',   'INDU',  'Vanguard Industrials ETF'),
('XLU',   'UTIL',  'Utilities Select Sector SPDR'),
('VPU',   'UTIL',  'Vanguard Utilities ETF'),
('XLRE',  'REIT',  'Real Estate Select Sector SPDR'),
('VNQ',   'REIT',  'Vanguard Real Estate ETF'),
('XLB',   'MATL',  'Materials Select Sector SPDR'),
('VAW',   'MATL',  'Vanguard Materials ETF'),
('XLC',   'COMM',  'Communication Services Select Sector SPDR'),
('VOX',   'COMM',  'Vanguard Communication Services ETF'),

-- Fixed income ETFs
('TLT',   'TLTD',  'iShares 20+ Year Treasury Bond ETF'),
('EDV',   'TLTD',  'Vanguard Extended Duration Treasury ETF'),
('ZROZ',  'TLTD',  'PIMCO 25+ Year Zero Coupon U.S. Treasury ETF'),
('IEF',   'TINT',  'iShares 7-10 Year Treasury Bond ETF'),
('VGIT',  'TINT',  'Vanguard Intermediate-Term Treasury ETF'),
('SHY',   'CASH',  'iShares 1-3 Year Treasury Bond ETF'),
('BIL',   'CASH',  'SPDR Bloomberg 1-3 Month T-Bill ETF'),
('AGG',   'TINT',  'iShares Core U.S. Aggregate Bond ETF'),
('BND',   'TINT',  'Vanguard Total Bond Market ETF'),
('LQD',   'CORP',  'iShares iBoxx $ Investment Grade Corporate Bond ETF'),
('HYG',   'HIYLD', 'iShares iBoxx $ High Yield Corporate Bond ETF'),
('JNK',   'HIYLD', 'SPDR Bloomberg High Yield Bond ETF'),

-- Precious metals
('GLD',   'GOLD',  'SPDR Gold Shares'),
('IAU',   'GOLD',  'iShares Gold Trust'),
('SLV',   'SLVR',  'iShares Silver Trust'),
('SIVR',  'SLVR',  'abrdn Physical Silver Shares ETF'),
('GDX',   'GDMN',  'VanEck Gold Miners ETF'),
('GDXJ',  'GDMN',  'VanEck Junior Gold Miners ETF'),
('PALL',  'GOLD',  'abrdn Physical Palladium Shares ETF'),

-- US large-cap technology
('AAPL',  'TECH',  'Apple Inc'),
('MSFT',  'TECH',  'Microsoft Corporation'),
('NVDA',  'TECH',  'NVIDIA Corporation'),
('AVGO',  'TECH',  'Broadcom Inc'),
('META',  'TECH',  'Meta Platforms Inc'),
('GOOGL', 'TECH',  'Alphabet Inc Class A'),
('GOOG',  'TECH',  'Alphabet Inc Class C'),
('AMD',   'TECH',  'Advanced Micro Devices Inc'),
('INTC',  'TECH',  'Intel Corporation'),
('QCOM',  'TECH',  'QUALCOMM Inc'),
('CRM',   'TECH',  'Salesforce Inc'),
('ORCL',  'TECH',  'Oracle Corporation'),
('SAP',   'TECH',  'SAP SE'),
('ASML',  'TECH',  'ASML Holding NV'),
('WKL',   'TECH',  'Wolters Kluwer NV'),

-- Consumer discretionary (reclassified from TECH)
('AMZN',  'DISR',  'Amazon.com Inc'),
('TSLA',  'DISR',  'Tesla Inc'),

-- US large-cap financials
('JPM',   'FINL',  'JPMorgan Chase & Co'),
('BAC',   'FINL',  'Bank of America Corporation'),
('WFC',   'FINL',  'Wells Fargo & Company'),
('GS',    'FINL',  'The Goldman Sachs Group Inc'),
('MS',    'FINL',  'Morgan Stanley'),
('BLK',   'FINL',  'BlackRock Inc'),
('V',     'FINL',  'Visa Inc'),
('MA',    'FINL',  'Mastercard Incorporated'),
('PYPL',  'FINL',  'PayPal Holdings Inc'),
('FISV',  'FINL',  'Fiserv Inc'),

-- US large-cap healthcare
('LLY',   'HLTH',  'Eli Lilly and Company'),
('UNH',   'HLTH',  'UnitedHealth Group Incorporated'),
('JNJ',   'HLTH',  'Johnson & Johnson'),
('ABT',   'HLTH',  'Abbott Laboratories'),
('MRK',   'HLTH',  'Merck & Co Inc'),
('PFE',   'HLTH',  'Pfizer Inc'),
('BMY',   'HLTH',  'Bristol-Myers Squibb Company'),
('BNTX',  'HLTH',  'BioNTech SE'),

-- US large-cap energy
('XOM',   'ENRG',  'Exxon Mobil Corporation'),
('CVX',   'ENRG',  'Chevron Corporation'),
('COP',   'ENRG',  'ConocoPhillips'),
('SLB',   'ENRG',  'Schlumberger NV'),

-- US large-cap industrials / defense / space
('CAT',   'INDU',  'Caterpillar Inc'),
('DE',    'INDU',  'Deere & Company'),
('HON',   'INDU',  'Honeywell International Inc'),
('GE',    'INDU',  'GE Aerospace'),
('RTX',   'INDU',  'RTX Corporation'),
('LMT',   'INDU',  'Lockheed Martin Corporation'),
('NOC',   'INDU',  'Northrop Grumman Corporation'),
('GD',    'INDU',  'General Dynamics Corporation'),
('BA',    'INDU',  'The Boeing Company'),
('LHX',   'INDU',  'L3Harris Technologies Inc'),
('SPCE',  'INDU',  'Virgin Galactic Holdings Inc'),

-- European defense / industrials
('RHM',   'INDU',  'Rheinmetall AG (Xetra)'),
('BAESY', 'INDU',  'BAE Systems PLC ADR'),
('BAES',  'INDU',  'BAE Systems PLC (London)'),
('BA.',   'INDU',  'BAE Systems PLC (London Stock Exchange)'),
('SAF',   'INDU',  'Safran SA (Paris)'),
('AIR',   'INDU',  'Airbus SE (Paris/Frankfurt)'),
('EADSY', 'INDU',  'Airbus SE ADR'),
('LDOS',  'INDU',  'Leidos Holdings Inc'),
('AVAV',  'INDU',  'AeroVironment Inc'),
('HEI',   'INDU',  'HEICO Corporation'),
('TDG',   'INDU',  'TransDigm Group Incorporated'),
('DASSF', 'INDU',  'Dassault Aviation SA'),
('LEO',   'INDU',  'Leonardo SpA (Milan)'),
('BAVA',  'INDU',  'Bavarian Nordic A/S'),
('SAAB',  'INDU',  'Saab AB'),
('SAAB B','INDU',  'Saab AB Class B (Nasdaq Stockholm)'),

-- European defense ETFs
('DFEU',  'INDU',  'iShares Europe Defence UCITS ETF'),

-- European financials
('ING',   'FINL',  'ING Groep NV'),
('BNP',   'FINL',  'BNP Paribas SA'),
('BNPQY', 'FINL',  'BNP Paribas SA ADR'),
('SAN',   'FINL',  'Banco Santander SA'),
('AXA',   'FINL',  'AXA SA'),
('AXAHY', 'FINL',  'AXA SA ADR'),
('DB',    'FINL',  'Deutsche Bank AG'),
('UBS',   'FINL',  'UBS Group AG'),
('CS',    'FINL',  'Credit Suisse Group AG'),

-- Consumer discretionary
('LVMH',  'DISR',  'LVMH Moet Hennessy Louis Vuitton SE'),
('MC',    'DISR',  'LVMH Moet Hennessy Louis Vuitton SE (Paris)'),

-- Consumer staples
('PG',    'STPL',  'Procter & Gamble Company'),
('KO',    'STPL',  'The Coca-Cola Company'),
('PEP',   'STPL',  'PepsiCo Inc'),
('COST',  'STPL',  'Costco Wholesale Corporation'),
('WMT',   'STPL',  'Walmart Inc'),
('NESN',  'STPL',  'Nestle SA'),
('UL',    'STPL',  'Unilever PLC'),

-- Communication services
('DIS',   'COMM',  'The Walt Disney Company'),
('NFLX',  'COMM',  'Netflix Inc'),
('SPOT',  'COMM',  'Spotify Technology SA'),

-- Real estate
('AMT',   'REIT',  'American Tower Corporation'),
('PLD',   'REIT',  'Prologis Inc'),
('CCI',   'REIT',  'Crown Castle Inc'),
('SPG',   'REIT',  'Simon Property Group Inc'),

-- Materials / emerging tech
('QS',    'MATL',  'QuantumScape Corporation (solid-state battery)');
