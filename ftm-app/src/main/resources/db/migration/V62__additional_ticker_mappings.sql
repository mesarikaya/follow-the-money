-- V62: Additional ticker mappings for European equities commonly held in portfolios.
-- SAP SE is enterprise software (ERP/cloud) → SOFT sub-sector (IGV benchmark).
-- Adyen N.V. is a global payments platform → FINL_FINT sub-sector (FINX benchmark).

INSERT INTO ticker_category_map (ticker, category_id, notes) VALUES
    ('SAP.DE',   'SOFT',      'SAP SE (Deutsche Börse Xetra) — enterprise software / ERP'),
    ('ADYEN',    'FINL_FINT', 'Adyen N.V. — global payments platform'),
    ('ADYEN.AS', 'FINL_FINT', 'Adyen N.V. (Euronext Amsterdam)'),
    ('ADYYF',    'FINL_FINT', 'Adyen N.V. ADR / OTC'),
    ('SAP.F',    'SOFT',      'SAP SE (Frankfurt Stock Exchange, alternative ticker format')
ON CONFLICT (ticker) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    notes       = EXCLUDED.notes,
    updated_at  = NOW();
