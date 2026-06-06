-- V48: Investment theme engine — cross-sector narrative baskets.
-- themes: named investment thesis + display metadata.
-- theme_constituents: which CategoryId ETFs belong to each theme.
-- No new signal computation — ThemeService aggregates existing signals.

CREATE TABLE themes (
    id            VARCHAR(30)  PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    thesis        TEXT         NOT NULL,
    display_order INTEGER      NOT NULL
);

CREATE TABLE theme_constituents (
    theme_id    VARCHAR(30) NOT NULL REFERENCES themes(id),
    category_id VARCHAR(10) NOT NULL REFERENCES categories(id),
    PRIMARY KEY (theme_id, category_id)
);

-- ── Themes ──────────────────────────────────────────────────────────────────
INSERT INTO themes (id, name, thesis, display_order) VALUES
    ('AI_INFRA',       'AI Infrastructure',        'Capital flooding into AI compute: chips, data centers, and the power grid to run them. The buildout phase, not the application phase.',                                                  1),
    ('CHIP_COMPUTE',   'Semiconductor Supercycle',  'Secular demand for advanced chips across AI training/inference, EVs, and defense driving a multi-year capex supercycle in semis and critical materials.',                           2),
    ('SAAS_AT_RISK',   'SaaS at Risk',              'Traditional SaaS and ad-based software models under pressure from AI-native disruptors. Watch for outflow rotation away from legacy software subscriptions.',                         3),
    ('DEFENSE_REARM',  'Defense Rearmament',        'European rearmament plus elevated US defense budgets driving a multi-year supercycle in aerospace, defense contractors, and industrial supply chains.',                               4),
    ('CLEAN_POWER',    'Clean Power Renaissance',   'AI data center power demand plus decarbonization mandates channeling capital into nuclear, solar, and grid infrastructure as electricity becomes the new oil.',                       5);

-- ── AI Infrastructure constituents ──────────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('AI_INFRA', 'SEMI'),       -- SMH  Semiconductors
    ('AI_INFRA', 'AIRO'),       -- BOTZ AI & Robotics
    ('AI_INFRA', 'TECH_AIQQ'),  -- AIQ  Artificial Intelligence ETF
    ('AI_INFRA', 'CLOD'),       -- WCLD Cloud Computing
    ('AI_INFRA', 'REIT_DATA'),  -- SRVR Data Center REITs
    ('AI_INFRA', 'UTIL'),       -- XLU  Utilities (data center power)
    ('AI_INFRA', 'ENRG_NUCL');  -- NLR  Nuclear (baseload power)

-- ── Semiconductor Supercycle constituents ────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('CHIP_COMPUTE', 'SEMI'),       -- SMH  Core semis
    ('CHIP_COMPUTE', 'AIRO'),       -- BOTZ AI automation
    ('CHIP_COMPUTE', 'TECH_AIQQ'),  -- AIQ  AI broadly
    ('CHIP_COMPUTE', 'MATL_RARE'),  -- REMX Rare earth & critical minerals
    ('CHIP_COMPUTE', 'MATL_LITH'); -- LIT  Lithium & battery tech

-- ── SaaS at Risk constituents ────────────────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('SAAS_AT_RISK', 'SOFT'),       -- IGV  Enterprise software / SaaS
    ('SAAS_AT_RISK', 'CLOD'),       -- WCLD Pure-play cloud platforms
    ('SAAS_AT_RISK', 'COMM_SOCL');  -- SOCL Social media (ad-model disruption)

-- ── Defense Rearmament constituents ─────────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('DEFENSE_REARM', 'INDU_ADEF'),  -- ITA  Aerospace & Defense
    ('DEFENSE_REARM', 'INDU_PAVE'),  -- PAVE US Infrastructure
    ('DEFENSE_REARM', 'MATL_STEE'),  -- SLX  Steel (defense manufacturing)
    ('DEFENSE_REARM', 'MATL_COPP');  -- COPX Copper (military equipment)

-- ── Clean Power Renaissance constituents ─────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('CLEAN_POWER', 'ENRG_NUCL'),  -- NLR  Nuclear
    ('CLEAN_POWER', 'ENRG_SOLR'),  -- TAN  Solar
    ('CLEAN_POWER', 'ENRG_CLEN'),  -- ICLN Clean Energy
    ('CLEAN_POWER', 'UTIL'),       -- XLU  Utilities
    ('CLEAN_POWER', 'ENRG_WIND');  -- FAN  Wind Energy
