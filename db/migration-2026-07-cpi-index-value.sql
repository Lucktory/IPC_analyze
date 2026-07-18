-- ============================================================================
-- Add the INDEC index LEVEL to cpi_values.
--
-- The aumento is computed as index[M-2] / index[M-2-N] using the full-precision
-- index level (matches ARquiler to the peso). The original cpi_values table only
-- had variation_pct (rounded), which drifts ~$50-130. This adds the level.
--
-- After running, populate it with the "Actualizar IPC" button (refreshIpc), or
-- run db/seed-cpi-values.sql.
-- ============================================================================

ALTER TABLE cpi_values ADD COLUMN IF NOT EXISTS index_value numeric(18,6);

COMMENT ON COLUMN cpi_values.index_value IS
  'INDEC IPC Nacional Nivel General index level (base dic-2016), full precision. Source series 148.3_INIVELNAL_DICI_M_26 via datos.gob.ar.';
