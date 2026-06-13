-- ============================================================================
-- 2026-06-13 — Liquidación grid fields
--
-- Adds the two columns Alejandro asked for when rebuilding /liquidacion as a
-- wide spreadsheet-style grid that mirrors the encargada's current Excel:
--
--   contracts.lfa_code                identifies which Pampa administrator
--                                     handles the contract (L=Lisa, F=Flavio,
--                                     A=Alejandro). Visible in the grid as
--                                     column LFA — same header her Excel uses.
--
--   liquidaciones.adjustment_amount   signed manual adjustment to the
--                                     transferencia al propietario. Positive
--                                     = extra paid out, negative = extra
--                                     deducted. Shown alongside free-text
--                                     notes in the OBSERVACIONES column.
--
-- Both fields are nullable / default 0 so existing rows survive the migration
-- untouched. Read-after-write is safe to deploy before the UI ships.
-- ============================================================================

alter table contracts
  add column if not exists lfa_code text;

alter table liquidaciones
  add column if not exists adjustment_amount numeric(12,2) default 0;
