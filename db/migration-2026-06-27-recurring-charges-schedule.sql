-- ============================================================================
-- 2026-06-27 — Recurring charges: per-charge schedule (start + frequency).
-- ============================================================================
-- Alejandro 2026-06-26: the Recargos status dot fired red on contracts/months
-- where the charge doesn't actually apply. Root cause: a recurring charge had
-- no notion of WHEN it starts or HOW OFTEN it bills, so the planilla treated
-- every charge as due every month, forever — painting red on off-cycle months
-- (bimonthly gas/ABL) and retroactively on periods before the charge existed.
--
-- These two fields let the dot — and the RECURRING_CHARGE_NOT_RECORDED
-- validation, which derives from the same summary — only evaluate a charge in
-- periods where it genuinely applies:
--
--   • start_period    — first period the charge is billed (YYYY-MM-01).
--                       NULL = legacy "always applied" (no lower bound), so
--                       existing rows keep their current behavior until edited.
--   • interval_months — billing cadence in months. 1 = monthly (default),
--                       2 = bimonthly (gas/ABL), 3 = quarterly, etc. Only takes
--                       effect once start_period is set — it's the anchor that
--                       defines which months are "on cycle".
--
-- Additive + safe. No data loss, no column drops. Idempotent.
-- ============================================================================

alter table contract_recurring_charges
  add column if not exists start_period    date,
  add column if not exists interval_months integer not null default 1
    check (interval_months between 1 and 12);

notify pgrst, 'reload schema';
