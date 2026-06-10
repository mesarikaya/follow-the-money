-- V54: Three new investment themes for 2025-2026 market narratives.
-- Biotech Catalyst Cycle, Financial Services Rotation, US Manufacturing Renaissance.

INSERT INTO themes (id, name, thesis, display_order) VALUES
    ('BIOTECH_WAVE',
     'Biotech Catalyst Cycle',
     'Rate normalization unlocks biotech funding. GLP-1 drug dominance, genomic medicine, and an FDA pipeline backlog are converging on a multi-year biotech upcycle. Capital flows back into speculative biopharma as the cost-of-capital tailwind returns.',
     10),
    ('FINANCIAL_ROTATION',
     'Financial Services Rotation',
     'Rate normalization expands bank net interest margins while fintech platforms capture fee revenue. The question is who benefits as yield curves normalize — traditional banks rebuilding NIM or fintechs absorbing displaced deposits.',
     11),
    ('RESHORING_CYCLE',
     'US Manufacturing Renaissance',
     'IRA, CHIPS Act, and elevated defense budgets are funding the biggest domestic capital expenditure cycle in a generation. Industrial, infrastructure, and construction firms are the picks-and-shovels of American re-industrialization.',
     12);

-- ── Biotech Catalyst Cycle constituents ─────────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('BIOTECH_WAVE', 'HLTH_BIOT'),  -- XBI  Biotech large cap (SPDR)
    ('BIOTECH_WAVE', 'HLTH_BIOI'),  -- IBB  Biotech broad (iShares)
    ('BIOTECH_WAVE', 'HLTH_GNOM'),  -- ARKG Genomic innovation
    ('BIOTECH_WAVE', 'HLTH_MDEV'),  -- IHI  Medical devices
    ('BIOTECH_WAVE', 'HLTH');       -- XLV  Healthcare sector (anchor)

-- ── Financial Services Rotation constituents ─────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('FINANCIAL_ROTATION', 'FINL_BANK'),  -- KBE  Banks (SPDR)
    ('FINANCIAL_ROTATION', 'FINL_KBWB'),  -- KBWB Banking (Invesco KBW)
    ('FINANCIAL_ROTATION', 'FINL_FINT'),  -- FINX Fintech & payments
    ('FINANCIAL_ROTATION', 'FINL');       -- XLF  Financials sector (anchor)

-- ── US Manufacturing Renaissance constituents ─────────────────────────────────
INSERT INTO theme_constituents (theme_id, category_id) VALUES
    ('RESHORING_CYCLE', 'INDU_AIRR'),  -- AIRR American Industrial Renaissance ETF
    ('RESHORING_CYCLE', 'INDU_PAVE'),  -- PAVE US infrastructure
    ('RESHORING_CYCLE', 'INDU_ROAD'),  -- ROAD Construction & engineering
    ('RESHORING_CYCLE', 'INDU');       -- XLI  Industrials sector (anchor)
