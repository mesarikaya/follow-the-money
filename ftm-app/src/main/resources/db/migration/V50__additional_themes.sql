-- V50: Four additional investment themes covering 2025–2026 macro narratives.
-- Rate pivot, commodity electrification, physical AI, and hard assets.

INSERT INTO themes (id, name, thesis, display_order) VALUES
    ('RATE_DURATION',
     'Rate Pivot & Duration Trade',
     'When the Fed signals easing, duration-sensitive assets front-run the rally. REITs, utilities, and investment-grade credit re-rate as real yields compress — this theme catches the rotation into rate proxies before it becomes crowded.',
     6),
    ('COMMODITY_ELECTRIFICATION',
     'Commodity Supercycle & Electrification',
     'AI data center buildout, EV adoption, and de-globalization are creating structural demand for copper, rare earths, and energy that supply cannot match. This theme tracks the raw materials backbone of the next industrial cycle.',
     7),
    ('PHYSICAL_AI_ROBOTICS',
     'Physical AI & Robotics',
     'AI is leaving the server room. The next capital wave flows into industrial automation, smart grids, robotics, and IoT — the hardware and infrastructure layer that turns AI software gains into real-world productivity.',
     8),
    ('HARD_ASSETS_GOLD',
     'Hard Assets & Precious Metals',
     'Central bank gold buying, de-dollarization pressure, and fiscal deficit concerns have structurally re-priced gold. This theme tracks precious metals and miners as a macro hedge during geopolitical regime shifts.',
     9);

-- ── Rate Pivot & Duration Trade constituents ─────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('RATE_DURATION', 'REIT'),   -- XLRE Real estate sector
    ('RATE_DURATION', 'UTIL'),   -- XLU  Utilities sector
    ('RATE_DURATION', 'TLTD'),   -- TLTD 20+ year treasuries
    ('RATE_DURATION', 'CORP'),   -- CORP Investment grade corporates
    ('RATE_DURATION', 'HIYLD');  -- HYG  High yield corporates

-- ── Commodity Supercycle & Electrification constituents ──────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('COMMODITY_ELECTRIFICATION', 'MATL'),       -- XLB  Materials sector
    ('COMMODITY_ELECTRIFICATION', 'ENRG'),       -- XLE  Energy sector
    ('COMMODITY_ELECTRIFICATION', 'MATL_COPP'),  -- COPX Copper miners
    ('COMMODITY_ELECTRIFICATION', 'MATL_RARE'),  -- REMX Rare earth & critical minerals
    ('COMMODITY_ELECTRIFICATION', 'INDU_ELEC'),  -- GRID Smart grid & electrification
    ('COMMODITY_ELECTRIFICATION', 'ENRG_NGAS');  -- UNG  Natural gas

-- ── Physical AI & Robotics constituents ─────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('PHYSICAL_AI_ROBOTICS', 'AIRO'),       -- BOTZ AI & robotics
    ('PHYSICAL_AI_ROBOTICS', 'INDU'),       -- XLI  Industrials sector
    ('PHYSICAL_AI_ROBOTICS', 'INDU_ELEC'),  -- GRID Smart grid & electrification
    ('PHYSICAL_AI_ROBOTICS', 'TECH_IOTC'),  -- SNSR Internet of Things
    ('PHYSICAL_AI_ROBOTICS', 'TECH_SMH');   -- SMH  Semiconductors (VanEck)

-- ── Hard Assets & Precious Metals constituents ───────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('HARD_ASSETS_GOLD', 'GOLD'),       -- GLD  Gold spot ETF
    ('HARD_ASSETS_GOLD', 'SLVR'),       -- SLV  Silver spot ETF
    ('HARD_ASSETS_GOLD', 'GDMN'),       -- GDX  Gold miners (all-cap)
    ('HARD_ASSETS_GOLD', 'MATL_GOLD'),  -- GDX  Gold miners senior (V18)
    ('HARD_ASSETS_GOLD', 'MATL_SLVR');  -- SIL  Silver miners
