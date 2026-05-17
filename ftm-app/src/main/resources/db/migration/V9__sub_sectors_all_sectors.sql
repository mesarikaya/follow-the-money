-- V9: Universal sub-sector hierarchy — ~70 ETFs across all 11 GICS sectors.
-- display_order = parent_display_order × 100 + N
-- benchmark_ticker = parent sector ETF (not SPY) — signals measure within-sector rotation.
-- TECH already has 101-104 from V7; V9 adds 105-108.
-- HLTH starts at 205 to avoid collision with FTRS children at 201-204 (V8).
-- All rows use type EQUITY_SECTOR per CHECK constraint.

-- ── TECH (XLK, display_order=1) additional sub-sectors ──────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('TECH_CYBR', 'Cybersecurity',              'EQUITY_SECTOR', 'CIBR', 'XLK', 105, 'TECH'),
    ('TECH_HACK', 'Cybersecurity (Amplify)',    'EQUITY_SECTOR', 'HACK', 'XLK', 106, 'TECH'),
    ('TECH_ROBO', 'Robotics & Automation',      'EQUITY_SECTOR', 'ROBO', 'XLK', 107, 'TECH'),
    ('TECH_AIQQ', 'Artificial Intelligence',    'EQUITY_SECTOR', 'AIQ',  'XLK', 108, 'TECH')
ON CONFLICT (id) DO NOTHING;

-- ── HLTH (XLV, display_order=2) — starts at 205, skipping 201-204 (FTRS) ───
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('HLTH_BIOT', 'Biotech Large Cap (SPDR)',   'EQUITY_SECTOR', 'XBI',  'XLV', 205, 'HLTH'),
    ('HLTH_BIOI', 'Biotech (iShares)',           'EQUITY_SECTOR', 'IBB',  'XLV', 206, 'HLTH'),
    ('HLTH_MDEV', 'Medical Devices',             'EQUITY_SECTOR', 'IHI',  'XLV', 207, 'HLTH'),
    ('HLTH_PROV', 'Healthcare Providers',        'EQUITY_SECTOR', 'IHF',  'XLV', 208, 'HLTH'),
    ('HLTH_PHAR', 'Pharmaceuticals',             'EQUITY_SECTOR', 'XPH',  'XLV', 209, 'HLTH'),
    ('HLTH_GNOM', 'Genomic Innovation',          'EQUITY_SECTOR', 'ARKG', 'XLV', 210, 'HLTH')
ON CONFLICT (id) DO NOTHING;

-- ── FINL (XLF, display_order=3) ─────────────────────────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('FINL_BANK', 'Banks (SPDR)',                'EQUITY_SECTOR', 'KBE',  'XLF', 301, 'FINL'),
    ('FINL_REGI', 'Regional Banks',              'EQUITY_SECTOR', 'KRE',  'XLF', 302, 'FINL'),
    ('FINL_INSR', 'Insurance',                   'EQUITY_SECTOR', 'KIE',  'XLF', 303, 'FINL'),
    ('FINL_BROK', 'Broker-Dealers & Exchanges',  'EQUITY_SECTOR', 'IAI',  'XLF', 304, 'FINL'),
    ('FINL_FINT', 'Fintech & Payments',          'EQUITY_SECTOR', 'FINX', 'XLF', 305, 'FINL'),
    ('FINL_KBWB', 'Banking (Invesco KBW)',       'EQUITY_SECTOR', 'KBWB', 'XLF', 306, 'FINL')
ON CONFLICT (id) DO NOTHING;

-- ── DISR / Consumer Discretionary (XLY, display_order=4) ────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('DISR_RETL', 'Retail',                      'EQUITY_SECTOR', 'XRT',  'XLY', 401, 'DISR'),
    ('DISR_HOME', 'Home Construction',            'EQUITY_SECTOR', 'ITB',  'XLY', 402, 'DISR'),
    ('DISR_AIRL', 'Airlines',                     'EQUITY_SECTOR', 'JETS', 'XLY', 403, 'DISR'),
    ('DISR_HOTL', 'Travel & Hotels',              'EQUITY_SECTOR', 'AWAY', 'XLY', 404, 'DISR'),
    ('DISR_REST', 'Restaurants & Food Service',   'EQUITY_SECTOR', 'EATZ', 'XLY', 405, 'DISR'),
    ('DISR_AUTO', 'Automobiles & Electric Vehicles', 'EQUITY_SECTOR', 'CARZ', 'XLY', 406, 'DISR')
ON CONFLICT (id) DO NOTHING;

-- ── INDU / Industrials (XLI, display_order=5) ───────────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('INDU_ADEF', 'Aerospace & Defense',          'EQUITY_SECTOR', 'ITA',  'XLI', 501, 'INDU'),
    ('INDU_TRAN', 'Transportation',               'EQUITY_SECTOR', 'XTN',  'XLI', 502, 'INDU'),
    ('INDU_PAVE', 'US Infrastructure',            'EQUITY_SECTOR', 'PAVE', 'XLI', 503, 'INDU'),
    ('INDU_AIRR', 'American Industrial Renaissance', 'EQUITY_SECTOR', 'AIRR', 'XLI', 504, 'INDU'),
    ('INDU_ROAD', 'Construction & Engineering',   'EQUITY_SECTOR', 'ROAD', 'XLI', 505, 'INDU')
ON CONFLICT (id) DO NOTHING;

-- ── ENRG / Energy (XLE, display_order=6) ────────────────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('ENRG_OILS', 'Oil Field Services',           'EQUITY_SECTOR', 'OIH',  'XLE', 601, 'ENRG'),
    ('ENRG_EXPL', 'Oil & Gas Exploration',        'EQUITY_SECTOR', 'XOP',  'XLE', 602, 'ENRG'),
    ('ENRG_SOLR', 'Solar Energy',                 'EQUITY_SECTOR', 'TAN',  'XLE', 603, 'ENRG'),
    ('ENRG_CLEN', 'Clean Energy',                 'EQUITY_SECTOR', 'ICLN', 'XLE', 604, 'ENRG'),
    ('ENRG_WIND', 'Wind Energy',                  'EQUITY_SECTOR', 'FAN',  'XLE', 605, 'ENRG'),
    ('ENRG_DRIV', 'Electric Vehicles & Charging', 'EQUITY_SECTOR', 'DRIV', 'XLE', 606, 'ENRG'),
    ('ENRG_NUCL', 'Nuclear Energy',               'EQUITY_SECTOR', 'NLR',  'XLE', 607, 'ENRG'),
    ('ENRG_URAN', 'Uranium Miners',               'EQUITY_SECTOR', 'URA',  'XLE', 608, 'ENRG')
ON CONFLICT (id) DO NOTHING;

-- ── MATL / Materials (XLB, display_order=7) ─────────────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('MATL_STEE', 'Steel',                        'EQUITY_SECTOR', 'SLX',  'XLB', 701, 'MATL'),
    ('MATL_LITH', 'Lithium & Battery Technology', 'EQUITY_SECTOR', 'LIT',  'XLB', 702, 'MATL'),
    ('MATL_COPP', 'Copper Miners',                'EQUITY_SECTOR', 'COPX', 'XLB', 703, 'MATL'),
    ('MATL_RING', 'Gold Miners Small Cap',         'EQUITY_SECTOR', 'RING', 'XLB', 704, 'MATL'),
    ('MATL_WOOD', 'Timber & Forestry',            'EQUITY_SECTOR', 'WOOD', 'XLB', 705, 'MATL'),
    ('MATL_AGRI', 'Agribusiness',                 'EQUITY_SECTOR', 'MOO',  'XLB', 706, 'MATL'),
    ('MATL_RARE', 'Rare Earth & Critical Minerals','EQUITY_SECTOR', 'REMX', 'XLB', 707, 'MATL')
ON CONFLICT (id) DO NOTHING;

-- ── UTIL / Utilities (XLU, display_order=8) ─────────────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('UTIL_WATR', 'Water Resources',              'EQUITY_SECTOR', 'PHO',  'XLU', 801, 'UTIL'),
    ('UTIL_FIWA', 'Water Infrastructure',         'EQUITY_SECTOR', 'FIW',  'XLU', 802, 'UTIL'),
    ('UTIL_UTES', 'Utilities (Reaves)',            'EQUITY_SECTOR', 'UTES', 'XLU', 803, 'UTIL')
ON CONFLICT (id) DO NOTHING;

-- ── REIT / Real Estate (XLRE, display_order=9) ──────────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('REIT_RESI', 'Residential REITs',            'EQUITY_SECTOR', 'REZ',  'XLRE', 901, 'REIT'),
    ('REIT_MORT', 'Mortgage REITs',               'EQUITY_SECTOR', 'REM',  'XLRE', 902, 'REIT'),
    ('REIT_DATA', 'Data Center REITs',            'EQUITY_SECTOR', 'SRVR', 'XLRE', 903, 'REIT'),
    ('REIT_INDS', 'Industrial REITs',             'EQUITY_SECTOR', 'INDS', 'XLRE', 904, 'REIT'),
    ('REIT_RETL', 'Retail REITs',                 'EQUITY_SECTOR', 'RTL',  'XLRE', 905, 'REIT')
ON CONFLICT (id) DO NOTHING;

-- ── STPL / Consumer Staples (XLP, display_order=10) ─────────────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('STPL_FOOD', 'Food & Beverage',              'EQUITY_SECTOR', 'PBJ',  'XLP', 1001, 'STPL'),
    ('STPL_GROC', 'Grocery & Household Products', 'EQUITY_SECTOR', 'FXG',  'XLP', 1002, 'STPL'),
    ('STPL_PRDT', 'Personal & Consumer Products', 'EQUITY_SECTOR', 'IYK',  'XLP', 1003, 'STPL')
ON CONFLICT (id) DO NOTHING;

-- ── COMM / Communication Services (XLC, display_order=11) ───────────────────
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('COMM_SOCL', 'Social Media',                 'EQUITY_SECTOR', 'SOCL', 'XLC', 1101, 'COMM'),
    ('COMM_ESPO', 'Video Gaming & eSports',       'EQUITY_SECTOR', 'ESPO', 'XLC', 1102, 'COMM'),
    ('COMM_NERD', 'eSports & Gaming (Roundhill)', 'EQUITY_SECTOR', 'NERD', 'XLC', 1103, 'COMM'),
    ('COMM_BETZ', 'Sports Betting & iGaming',     'EQUITY_SECTOR', 'BETZ', 'XLC', 1104, 'COMM'),
    ('COMM_FIVG', '5G Connectivity',              'EQUITY_SECTOR', 'FIVG', 'XLC', 1105, 'COMM')
ON CONFLICT (id) DO NOTHING;
