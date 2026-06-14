-- V65: Ticker mappings for common individual stock holdings.
-- Defense & aerospace stocks (→ INDU_ADEF: ITA benchmark)
-- Healthcare stocks (→ HLTH and sub-sectors)
-- Tech/software stocks (→ SEMI, SOFT, TECH)
-- Fintech stocks (→ FINL_FINT)
-- Consumer stocks (→ STPL, COMM)
-- Cash placeholder

INSERT INTO ticker_category_map (ticker, category_id, notes) VALUES
    -- Defense & Aerospace
    ('AIR',       'INDU_ADEF', 'Airbus SE (OTC) — commercial aerospace + defense'),
    ('AIR.PA',    'INDU_ADEF', 'Airbus SE (Euronext Paris)'),
    ('BA',        'INDU_ADEF', 'Boeing — commercial + defense aerospace'),
    ('BA.L',      'INDU_ADEF', 'BAE Systems PLC (LSE, price in GBX/pence)'),
    ('GD',        'INDU_ADEF', 'General Dynamics — defense systems'),
    ('LMT',       'INDU_ADEF', 'Lockheed Martin — defense prime contractor'),
    ('RTX',       'INDU_ADEF', 'RTX Corp (formerly Raytheon Technologies)'),
    ('NOC',       'INDU_ADEF', 'Northrop Grumman — stealth + space defense'),
    ('HII',       'INDU_ADEF', 'Huntington Ingalls — naval shipbuilding'),
    ('HEI',       'INDU_ADEF', 'HEICO Corp — aerospace components'),
    ('LDOS',      'INDU_ADEF', 'Leidos Holdings — defense IT'),
    ('RHM.DE',    'INDU_ADEF', 'Rheinmetall AG (XETRA) — German defense prime'),
    ('RHM',       'INDU_ADEF', 'Rheinmetall AG (ADR / alternative ticker)'),
    ('SAAB-B.ST', 'INDU_ADEF', 'Saab AB Class B (Nasdaq Stockholm, price in SEK)'),
    ('DFEU.AS',   'INDU_ADEF', 'iShares Europe Defense ETF (Euronext Amsterdam)'),
    ('DFEU',      'INDU_ADEF', 'iShares Europe Defense ETF'),
    -- Healthcare
    ('PFE',       'HLTH_PHAR', 'Pfizer — large-cap pharma'),
    ('MRK',       'HLTH_PHAR', 'Merck & Co — pharma'),
    ('JNJ',       'HLTH',      'Johnson & Johnson — diversified healthcare'),
    ('UNH',       'HLTH_PROV', 'UnitedHealth Group — managed care'),
    ('BNTX',      'HLTH_BIOT', 'BioNTech SE ADR — mRNA biotech'),
    ('MRNA',      'HLTH_BIOT', 'Moderna — mRNA biotech'),
    ('ABBV',      'HLTH_PHAR', 'AbbVie — pharma (Humira, Skyrizi)'),
    ('LLY',       'HLTH_PHAR', 'Eli Lilly — pharma (GLP-1 / Ozempic competitor)'),
    -- Technology / Semiconductors
    ('ASML',      'SEMI',      'ASML Holding — EUV lithography monopoly'),
    ('ASML.AS',   'SEMI',      'ASML Holding (Euronext Amsterdam)'),
    ('NVDA',      'SEMI',      'NVIDIA — GPU / AI chips'),
    ('AMD',       'SEMI',      'AMD — CPU/GPU'),
    ('INTC',      'SEMI',      'Intel — CPU / foundry'),
    ('QCOM',      'SEMI',      'Qualcomm — mobile chips'),
    ('TSM',       'SEMI',      'TSMC — semiconductor foundry'),
    ('MU',        'SEMI',      'Micron — memory chips'),
    ('SPCE',      'TECH',      'Virgin Galactic Holdings — commercial spaceflight'),
    ('QS',        'ENRG_DRIV', 'QuantumScape — solid-state EV batteries'),
    ('WKL.AS',    'SOFT',      'Wolters Kluwer NV (Euronext Amsterdam) — professional software'),
    ('WKL',       'SOFT',      'Wolters Kluwer NV (US OTC)'),
    -- Fintech & Payments
    ('PYPL',      'FINL_FINT', 'PayPal Holdings — digital payments'),
    ('FISV',      'FINL_FINT', 'Fiserv — payments + financial technology'),
    ('V',         'FINL_FINT', 'Visa — global payments network'),
    ('MA',        'FINL_FINT', 'Mastercard — global payments network'),
    ('SQ',        'FINL_FINT', 'Block (formerly Square) — SMB payments'),
    -- Consumer Staples
    ('MO',        'STPL',      'Altria Group — tobacco / consumer staples'),
    ('PM',        'STPL',      'Philip Morris International — tobacco'),
    ('KO',        'STPL',      'Coca-Cola — beverages'),
    ('PEP',       'STPL',      'PepsiCo — beverages + snacks'),
    ('PG',        'STPL',      'Procter & Gamble — consumer staples'),
    -- Communication / Media / Entertainment
    ('DIS',       'COMM',      'Walt Disney — media + theme parks + streaming'),
    ('NFLX',      'COMM_SOCL', 'Netflix — streaming'),
    ('GOOG',      'COMM',      'Alphabet/Google — search + advertising'),
    ('GOOGL',     'COMM',      'Alphabet/Google (voting shares)'),
    ('META',      'COMM_SOCL', 'Meta Platforms — social media'),
    -- Cash placeholder (ticker matches categoryId → price skip logic)
    ('CASH',      'CASH',      'Cash holding placeholder — no price lookup'),
    ('EUR',       'CASH',      'EUR cash placeholder'),
    ('USD',       'CASH',      'USD cash placeholder')
ON CONFLICT (ticker) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    notes       = EXCLUDED.notes,
    updated_at  = NOW();
