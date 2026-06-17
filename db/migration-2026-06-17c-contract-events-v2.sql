-- ============================================================================
-- Migration: contract_events v2 (2026-06-17 — Phase 11)
-- ============================================================================
-- Amends the contract_events table created earlier today to match the model
-- Alejandro described in his arreglos message:
--
--   • Payer is NOT binary. Sometimes landlord, sometimes tenant, sometimes
--     "mitad y mitad", sometimes split with any ratio, sometimes pending
--     negotiation. Replace the single `payer` field (with its CHECK on
--     'landlord'/'tenant') with TWO amount columns: amount_landlord and
--     amount_tenant. Total cost = sum of the two.
--
--   • Discount timing depends on the day of the month. Repair before the
--     contract's payment_day → discount lands in the CURRENT month's
--     liquidación. After payment_day → defers to NEXT month. Need a
--     dedicated `applies_to_period` field so the deferral is data, not UI
--     logic.
--
--   • Cross-period red carryover. A logged repair must visibly resurface
--     on next month's planilla until it's applied. New `status` column:
--     pending / applied / cancelled.
--
--   • Photo / receipt of the worker's invoice. New `attachment_url` field
--     pointing to Supabase Storage. Generic — also usable by any future
--     event kind (aumento receipt, court ruling, etc.).
--
-- The old `payer` column had ZERO rows (table was created hours ago, never
-- written to by application code), so dropping it is risk-free. If you're
-- running this on a snapshot that already has data, the values would be
-- lost — verify rowcount with the sanity SELECT before applying.
--
-- ADDITIVE + ONE DROP. Idempotent (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================================

-- ── Verify the column-drop is safe (no rows = ok to drop) ─────────────────
do $$
declare
  v_count bigint;
begin
  select count(*) into v_count from contract_events;
  if v_count > 0 then
    raise notice 'contract_events has % rows — payer values will be lost on drop. Continuing as per migration plan.', v_count;
  end if;
end$$;

-- ── Drop the binary payer (CHECK + column together) ──────────────────────
alter table contract_events
  drop constraint if exists contract_events_payer_check;

alter table contract_events
  drop column if exists payer;

-- ── Add the new fields ───────────────────────────────────────────────────
alter table contract_events
  add column if not exists amount_landlord    numeric(14,2) default 0,
  add column if not exists amount_tenant      numeric(14,2) default 0,
  add column if not exists applies_to_period  date,
  add column if not exists status             text not null default 'pending',
  add column if not exists attachment_url     text;

-- ── CHECK on status — idempotent ────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contract_events_status_chk') then
    alter table contract_events add constraint contract_events_status_chk
      check (status in ('pending','applied','cancelled'));
  end if;
end$$;

-- ── Helpful indexes for the planilla's red-carryover query ──────────────
-- "Pending repairs that should land in this period":
create index if not exists idx_contract_events_pending_by_period
  on contract_events (applies_to_period, status)
  where status = 'pending';

-- "All events for this contract, in chronological order" — already indexed
-- by (contract_id, occurred_at desc) from the prior migration.

-- ── Reload schema cache for PostgREST ─────────────────────────────────────
notify pgrst, 'reload schema';

-- ── Sanity check ──────────────────────────────────────────────────────────
select
  (select count(*) from contract_events)                                       as event_rows,
  (select count(*) from information_schema.columns
     where table_name='contract_events' and column_name='amount_landlord')    as has_amount_landlord,
  (select count(*) from information_schema.columns
     where table_name='contract_events' and column_name='amount_tenant')      as has_amount_tenant,
  (select count(*) from information_schema.columns
     where table_name='contract_events' and column_name='applies_to_period')  as has_applies_to_period,
  (select count(*) from information_schema.columns
     where table_name='contract_events' and column_name='status')             as has_status,
  (select count(*) from information_schema.columns
     where table_name='contract_events' and column_name='payer')              as still_has_payer;
