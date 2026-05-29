-- V18: High-value sub-sector additions.
-- Fills gaps in V9: senior gold miners, silver, shipping, smart grid,
-- uranium pure-play, natural gas, and semiconductor alternative.
-- display_order continues from last used in each parent range.

-- ── MATL / Materials — Gold Miners Senior + Silver ───────────────────────────
-- RING (V9 #704) tracks small/mid-cap gold miners; GDX is large-cap, most liquid.
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('MATL_GOLD', 'Gold Miners Senior',           'EQUITY_SECTOR', 'GDX',  'XLB', 708, 'MATL'),
    ('MATL_SLVR', 'Silver Miners',                'EQUITY_SECTOR', 'SIL',  'XLB', 709, 'MATL')
ON CONFLICT (id) DO NOTHING;

-- ── INDU / Industrials — Shipping + Smart Grid ───────────────────────────────
-- BOAT = SonicShares Global Shipping ETF (cyclical demand indicator)
-- GRID = First Trust NASDAQ Clean Edge Smart Grid (power infrastructure megatrend)
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('INDU_SHPP', 'Global Shipping',              'EQUITY_SECTOR', 'BOAT', 'XLI', 506, 'INDU'),
    ('INDU_ELEC', 'Smart Grid & Electrification', 'EQUITY_SECTOR', 'GRID', 'XLI', 507, 'INDU')
ON CONFLICT (id) DO NOTHING;

-- ── ENRG / Energy — Uranium Pure-Play + Natural Gas ──────────────────────────
-- URNM (Sprott Uranium Miners) = pure miners only, more volatile than URA (V9 #608)
-- UNG = United States Natural Gas Fund — spot NG price proxy
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('ENRG_URNM', 'Uranium Miners Pure-Play',     'EQUITY_SECTOR', 'URNM', 'XLE', 609, 'ENRG'),
    ('ENRG_NGAS', 'Natural Gas',                  'EQUITY_SECTOR', 'UNG',  'XLE', 610, 'ENRG')
ON CONFLICT (id) DO NOTHING;

-- ── TECH / Technology — SMH + IoT ────────────────────────────────────────────
-- SMH (VanEck) vs SOXX/SEMI (iShares): different index → complementary signal
-- SNSR = Global X Internet of Things ETF
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('TECH_SMH',  'Semiconductors (VanEck)',       'EQUITY_SECTOR', 'SMH',  'XLK', 109, 'TECH'),
    ('TECH_IOTC', 'Internet of Things',            'EQUITY_SECTOR', 'SNSR', 'XLK', 110, 'TECH')
ON CONFLICT (id) DO NOTHING;

-- ── UTIL / Utilities — Clean Power ───────────────────────────────────────────
-- CNRG = SPDR S&P Kensho Clean Power — wind, solar, hydro utilities
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('UTIL_CLNR', 'Clean Power Utilities',         'EQUITY_SECTOR', 'CNRG', 'XLU', 804, 'UTIL')
ON CONFLICT (id) DO NOTHING;

-- ── HLTH / Health Care — Drug Manufacturers ──────────────────────────────────
-- PJP = Invesco Dynamic Pharmaceuticals ETF
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('HLTH_DRUG', 'Drug Manufacturers',            'EQUITY_SECTOR', 'PJP',  'XLV', 211, 'HLTH')
ON CONFLICT (id) DO NOTHING;

-- ── REIT / Real Estate — Healthcare REITs ────────────────────────────────────
-- KBWY = Invesco KBW Premium Yield Equity REIT ETF (high-dividend REITs)
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('REIT_HLTH', 'Healthcare & High-Yield REITs', 'EQUITY_SECTOR', 'KBWY', 'XLRE', 906, 'REIT')
ON CONFLICT (id) DO NOTHING;
