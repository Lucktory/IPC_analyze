-- ============================================================================
-- 2026-06-20 — Recurring charges per contract (replaces single-ABL feature).
-- ============================================================================
-- Alejandro's voice 2026-06-20: the Alquiler column must stay pure (only rent),
-- and recargos (ABL, THU, Camuzzi, Tasa de Limpieza, Edesur, AySA, etc.) go in
-- a separate new column. Each contract can have MANY recurring charges, not
-- just one.
--
-- This migration:
--   1. Creates `contract_recurring_charges` — N rows per contract, each with
--      label + amount + optional recupero_type_code for the cobro completeness
--      check.
--   2. Moves existing rows from contracts.includes_abl/abl_amount into the new
--      table as label='ABL' with recupero_type_code='RECUPERO_ABL_IN'.
--   3. Drops the two now-obsolete contracts columns.
--
-- Safe to re-run? Partially. Step 1 uses `if not exists`. Steps 2-3 do NOT
-- guard — they assume a single first-time run. If you need to re-run on a
-- DB where contracts.* columns are already gone, comment out steps 2-3.
-- ============================================================================

-- 1. New table -----------------------------------------------------------------
create table if not exists contract_recurring_charges (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid not null references contracts(id) on delete cascade,
  label               text not null,
  amount              numeric(12,2) not null check (amount > 0),
  -- Optional FK to transaction_types.code. When set, drives the "this charge
  -- was paid this period" check used by the planilla's Recargos cell status
  -- dot and the RECURRING_CHARGE_NOT_RECORDED validation rule.
  recupero_type_code  text references transaction_types(code) on delete set null,
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_contract_recurring_charges_contract
  on contract_recurring_charges(contract_id);
create index if not exists idx_contract_recurring_charges_active
  on contract_recurring_charges(contract_id, active)
  where active = true;

-- Reuse the generic touch trigger from schema.sql (touch_updated_at).
drop trigger if exists trg_contract_recurring_charges_touch_updated_at
  on contract_recurring_charges;
create trigger trg_contract_recurring_charges_touch_updated_at
  before update on contract_recurring_charges
  for each row execute function touch_updated_at();

-- 2. Migrate existing ABL data ------------------------------------------------
-- Only when both columns still exist on contracts (this guards against re-runs).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name='contracts' and column_name='includes_abl'
  ) and exists (
    select 1 from information_schema.columns
     where table_name='contracts' and column_name='abl_amount'
  ) then
    insert into contract_recurring_charges (contract_id, label, amount, recupero_type_code, active)
    select id, 'ABL', abl_amount, 'RECUPERO_ABL_IN', true
      from contracts
     where includes_abl = true
       and abl_amount is not null
       and abl_amount > 0
       and not exists (
         select 1 from contract_recurring_charges crc
          where crc.contract_id = contracts.id
            and crc.label = 'ABL'
       );
  end if;
end $$;

-- 3. Drop the old columns -----------------------------------------------------
alter table contracts drop column if exists includes_abl;
alter table contracts drop column if exists abl_amount;

notify pgrst, 'reload schema';
