-- ============================================================================
-- Backfill contract_number = 'C-YYYY-NNNN'
--   YYYY = year of start_date
--   NNNN = sequence within that year, ordered by start_date then id (stable)
--
-- One-time enrichment: today all 104 contracts have contract_number = NULL.
-- The `IS NULL` guard makes it safe to re-run (already-numbered rows are kept).
-- Preview verified 2026-07-06: 2022:1, 2023:4, 2024:37, 2025:46, 2026:16.
-- ============================================================================

-- 1) Preview (does NOT change anything):
WITH numbered AS (
  SELECT id, start_date,
    'C-' || to_char(start_date, 'YYYY') || '-' ||
    LPAD(ROW_NUMBER() OVER (PARTITION BY to_char(start_date, 'YYYY') ORDER BY start_date, id)::text, 4, '0') AS num
  FROM contracts
)
SELECT num, start_date FROM numbered ORDER BY num LIMIT 20;

-- 2) Apply:
WITH numbered AS (
  SELECT id,
    'C-' || to_char(start_date, 'YYYY') || '-' ||
    LPAD(ROW_NUMBER() OVER (PARTITION BY to_char(start_date, 'YYYY') ORDER BY start_date, id)::text, 4, '0') AS num
  FROM contracts
)
UPDATE contracts c
SET contract_number = n.num
FROM numbered n
WHERE c.id = n.id
  AND c.contract_number IS NULL;
-- Expect: 104 rows updated.

-- 3) Verify:
SELECT to_char(start_date, 'YYYY') AS anio, count(*), min(contract_number), max(contract_number)
FROM contracts GROUP BY 1 ORDER BY 1;
