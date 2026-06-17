-- ============================================================================
-- Migration: contract_tenants.share_pct (2026-06-17 — Phase 11)
-- ============================================================================
-- Adds a per-tenant share percentage to the contract_tenants junction so
-- co-tenancy can carry real distribution data (50/50, 60/40, etc.) instead
-- of just an "is_primary" boolean.
--
-- WHY:
--   The current NewContractModal only allows ONE tenant. The rebuild
--   supports multiple tenants with percentages summing to 100. Each row
--   in contract_tenants now stores its tenant's share of the rent.
--
-- BACKWARDS COMPATIBILITY:
--   • Defaults to 100 so every existing single-tenant row remains valid.
--   • CHECK constraint accepts values > 0 and ≤ 100 (sum across rows is
--     enforced in application code, not in SQL, because Postgres can't
--     express a "sum of group rows = 100" constraint cleanly).
--
-- ADDITIVE. Idempotent.
-- ============================================================================

alter table contract_tenants
  add column if not exists share_pct numeric(5,2) not null default 100;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contract_tenants_share_pct_chk') then
    alter table contract_tenants
      add constraint contract_tenants_share_pct_chk
      check (share_pct > 0 and share_pct <= 100);
  end if;
end$$;

notify pgrst, 'reload schema';

-- Sanity check
select
  (select count(*) from contract_tenants) as total_rows,
  (select count(*) from contract_tenants where share_pct is null) as null_share_rows;
