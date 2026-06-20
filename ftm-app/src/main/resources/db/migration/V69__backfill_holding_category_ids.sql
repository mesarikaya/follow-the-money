-- V69: Back-populate category_id on holdings where it is currently NULL but a
-- ticker→category mapping already exists in ticker_category_map.
-- This fixes "Unclassified" display for holdings that were imported before the
-- corresponding ticker mapping migration (e.g. V62 for SAP.DE / ADYEN.AS).

UPDATE holdings h
SET    category_id = (
           SELECT tcm.category_id
           FROM   ticker_category_map tcm
           WHERE  tcm.ticker = h.ticker
           LIMIT  1
       )
WHERE  h.category_id IS NULL
  AND  EXISTS (
           SELECT 1
           FROM   ticker_category_map tcm
           WHERE  tcm.ticker = h.ticker
       );
