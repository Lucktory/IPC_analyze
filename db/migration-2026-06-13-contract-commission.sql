-- ============================================================================
-- 2026-06-13 — contracts.commission_pct
--
-- Per-contract commission percentage that Pampa charges the landlord, applied
-- to TOTAL COBRADO (alquiler + recuperos), per Alejandro's spec #2.
--
-- Default 8.0% — adjust per contract from the detail page later.
-- ============================================================================

alter table contracts
  add column if not exists commission_pct numeric(5,2) default 8.0;
