-- ============================================================================
-- Fix the Bustos contract's cadence.
--
-- C-2026-0008 (Propiedad de BUSTOS, inquilinos Centeno/Grillo) was imported with
-- cadence='trimestral' but Alejandro says it's BIMESTRAL. The aumento window
-- depends on the cadence, so this must be corrected before the IPC automation
-- computes its increase.
--
-- (You can also change it in the app: contract page → "Cadencia" selector.)
-- ============================================================================

-- Preview:
-- SELECT contract_number, cadence FROM contracts WHERE contract_number = 'C-2026-0008';

UPDATE contracts
SET cadence = 'bimestral', updated_at = now()
WHERE contract_number = 'C-2026-0008'
  AND cadence = 'trimestral';
