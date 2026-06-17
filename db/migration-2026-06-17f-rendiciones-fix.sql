-- ============================================================================
-- Migration: rendiciones model correction (2026-06-17 — Phase 11 fix)
-- ============================================================================
-- Fixes two design errors in migration 17d:
--
--   1. `liquidacion_payouts` was redundant. Each liquidación is already
--      per (contract, landlord, period); the per-landlord receipt-footer
--      amount derives from SUM(net_to_landlord) GROUP BY landlord_id.
--      Drop the unused table.
--
--   2. `rendiciones.landlord_id` + UNIQUE(landlord_id, period) modeled a
--      rendición as PER-LANDLORD. But Receipt 3 (SIMOES) shows ONE
--      document going to BOTH Adrián and Juan jointly. A rendición is
--      really per "ownership group × period". Replace landlord_id +
--      its UNIQUE with a `rendicion_landlords` junction so multiple
--      landlords can receive the same rendición. The new uniqueness
--      guarantee is that any given liquidación can only belong to ONE
--      rendición at a time (already enforced via the FK on liquidaciones).
--
-- SAFE because neither table has rows yet — application code does not
-- read or write them. Idempotent (uses IF EXISTS / IF NOT EXISTS).
-- ============================================================================

-- ── 1. Drop the redundant payouts table ──────────────────────────────────
drop index if exists idx_liquidacion_payouts_landlord;
drop table if exists liquidacion_payouts;

-- ── 2. Reshape rendiciones from per-landlord to per-group ────────────────
alter table rendiciones
  drop constraint if exists rendiciones_landlord_id_period_key;

drop index if exists idx_rendiciones_landlord_period;

alter table rendiciones
  drop column if exists landlord_id;

-- New junction: which landlords receive each rendición. Composite PK
-- enforces "this landlord appears at most once per rendición".
create table if not exists rendicion_landlords (
  rendicion_id uuid not null references rendiciones(id) on delete cascade,
  landlord_id  uuid not null references landlords(id)   on delete restrict,
  primary key (rendicion_id, landlord_id)
);
create index if not exists idx_rendicion_landlords_landlord
  on rendicion_landlords (landlord_id);

-- The "one rendición per landlord-set per period" rule is enforced in
-- application code at insert time (compute the sorted landlord set
-- signature, dedupe). SQL cannot express this elegantly without an
-- expression unique index over a derived signature.

-- ── Reload schema cache ─────────────────────────────────────────────────
notify pgrst, 'reload schema';

-- ── Sanity ──────────────────────────────────────────────────────────────
select
  (select count(*) from rendiciones)                                       as rendicion_rows,
  (select count(*) from rendicion_landlords)                               as junction_rows,
  (select count(*) from information_schema.columns
     where table_name='rendiciones' and column_name='landlord_id')         as still_has_old_landlord_col,
  (select count(*) from information_schema.tables
     where table_name='liquidacion_payouts')                               as payouts_still_exists;
