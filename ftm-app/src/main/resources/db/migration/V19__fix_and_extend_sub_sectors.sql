-- V19: Fix dangerous leveraged ETF; add missing high-value sub-sectors.
-- Addresses user-identified gaps: granular semiconductors, clean energy alternatives,
-- gaming/media sub-themes, and removes NRGU which is a 3× leveraged product
-- inappropriate for rotation signal quality.

-- ── SAFETY FIX: Deactivate NRGU (3× leveraged oil ETF, not a utilities ETF) ──
-- NRGU was seeded as "Natural Gas Utilities" but is MicroSectors 3× Leveraged Big Oil.
-- Leveraged products introduce distorted RS/momentum signals; do not use in rotation.
UPDATE categories SET active = false WHERE id = 'UTIL_NRGU';

-- ── TECH / Technology — iShares Semiconductor (different index from SMH/SEMI) ─
-- SOXX tracks ICE Semiconductor Index; SMH tracks MVIS US Listed Semiconductor 25.
-- Both signal semiconductors but diverge 5–15% in periods of index rebalancing.
-- Together they provide a more complete picture of within-sector semiconductor leadership.
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('TECH_SOXX', 'Semiconductors (iShares)', 'EQUITY_SECTOR', 'SOXX', 'XLK', 111, 'TECH')
ON CONFLICT (id) DO NOTHING;

-- ── ENRG / Energy — Nasdaq Clean Edge Green Energy ───────────────────────────
-- QCLN tracks First Trust NASDAQ Clean Edge Green Energy Index.
-- Different from ICLN (S&P Global Clean Energy) and CNRG (S&P Kensho Clean Power):
-- QCLN is US-listed-only, smaller cap tilt, Nasdaq-tracked → captures early-cycle EV/solar.
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('ENRG_QCLN', 'Clean Energy (Nasdaq)', 'EQUITY_SECTOR', 'QCLN', 'XLE', 611, 'ENRG')
ON CONFLICT (id) DO NOTHING;

-- ── COMM / Communication Services — Video Gaming ─────────────────────────────
-- HERO = VanEck Video Gaming and eSports ETF — different constituents from ESPO/NERD.
-- ESPO (Vaneck) focuses on large-cap publishers; HERO tilts toward hardware + smaller devs.
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('COMM_HERO', 'Video Gaming (VanEck)', 'EQUITY_SECTOR', 'HERO', 'XLC', 2007, 'COMM')
ON CONFLICT (id) DO NOTHING;

-- ── FINL / Financials — Blockchain & Digital Finance ─────────────────────────
-- BLOK = Amplify Transformational Data Sharing ETF (blockchain/crypto-adjacent companies).
-- Captures institutional blockchain adoption signal — distinct from FINX (payments/lending).
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('FINL_BLOK', 'Blockchain & Digital Finance', 'EQUITY_SECTOR', 'BLOK', 'XLF', 307, 'FINL')
ON CONFLICT (id) DO NOTHING;

-- ── MATL / Materials — Copper Miners granular split ──────────────────────────
-- COPX (Global X Copper Miners) was in V9. Adding CPER as a copper futures-based signal —
-- CPER tracks the SummerHaven Copper Index; differs from COPX (equity miners) in
-- beta and sensitivity to spot price vs. mining company profitability.
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('MATL_CPER', 'Copper Futures', 'EQUITY_SECTOR', 'CPER', 'XLB', 809, 'MATL')
ON CONFLICT (id) DO NOTHING;

-- ── INDU / Industrials — Defense Technology ──────────────────────────────────
-- SHLD = Global X Defense Tech ETF (launched 2022); captures advanced defense electronics,
-- drones, autonomous systems — different from ITA (broad aerospace/defense).
INSERT INTO categories (id, name, type, etf_ticker, benchmark_ticker, display_order, parent_id) VALUES
    ('INDU_SHLD', 'Defense Technology', 'EQUITY_SECTOR', 'SHLD', 'XLI', 508, 'INDU')
ON CONFLICT (id) DO NOTHING;
