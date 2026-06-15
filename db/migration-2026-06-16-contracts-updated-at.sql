-- ============================================================================
-- 2026-06-16 — contracts.updated_at + auto-touch trigger
--
-- Goal: sort the planilla by "most recently added or modified" — so when the
-- encargada creates or edits a contract, the row floats to the top. This
-- requires:
--   1. an updated_at column on contracts (default now())
--   2. a trigger that bumps it on every UPDATE
--
-- Both new and existing contracts get a sensible value: existing rows are
-- backfilled to their created_at so the initial order is "most recent first"
-- by creation date, then any edit moves the row to the top.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

alter table contracts
  add column if not exists updated_at timestamptz default now();

-- Backfill: existing rows get their created_at value.
update contracts
   set updated_at = coalesce(updated_at, created_at)
 where updated_at is null;

-- Trigger function: bump updated_at on every UPDATE.
create or replace function touch_contract_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contracts_touch_updated_at on contracts;
create trigger trg_contracts_touch_updated_at
  before update on contracts
  for each row execute function touch_contract_updated_at();

-- ── Side-effect triggers: when a transaction or liquidación changes,
--    bump the parent contract's updated_at too. Otherwise the planilla
--    sort wouldn't surface the row when the encargada records a cobranza,
--    because she only touches transactions (not contracts) for that work.

create or replace function touch_contract_from_transaction()
returns trigger
language plpgsql
as $$
begin
  if new.contract_id is not null then
    update contracts set updated_at = now() where id = new.contract_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_transactions_touch_contract on transactions;
create trigger trg_transactions_touch_contract
  after insert or update on transactions
  for each row execute function touch_contract_from_transaction();

create or replace function touch_contract_from_liquidacion()
returns trigger
language plpgsql
as $$
begin
  if new.contract_id is not null then
    update contracts set updated_at = now() where id = new.contract_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_liquidaciones_touch_contract on liquidaciones;
create trigger trg_liquidaciones_touch_contract
  after insert or update on liquidaciones
  for each row execute function touch_contract_from_liquidacion();

-- Force PostgREST to pick up the new column.
notify pgrst, 'reload schema';
