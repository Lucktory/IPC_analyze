-- ============================================================================
-- 2026-06-16 — landlords / tenants / banks: updated_at + auto-touch triggers
--
-- Mirrors the contracts.updated_at trigger from the same date but for the
-- three master tables shown on /propietarios, /inquilinos, /bancos. These
-- list pages will sort by updated_at desc so the most recently edited row
-- appears at the top (per Alejandro's request).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ── Columns ─────────────────────────────────────────────────────────────────
alter table landlords add column if not exists updated_at timestamptz default now();
alter table tenants   add column if not exists updated_at timestamptz default now();
alter table banks     add column if not exists updated_at timestamptz default now();

-- ── Backfill existing rows from created_at ─────────────────────────────────
update landlords set updated_at = coalesce(updated_at, created_at) where updated_at is null;
update tenants   set updated_at = coalesce(updated_at, created_at) where updated_at is null;
update banks     set updated_at = coalesce(updated_at, created_at) where updated_at is null;

-- ── Shared trigger function: bump updated_at on every UPDATE ───────────────
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_landlords_touch_updated_at on landlords;
create trigger trg_landlords_touch_updated_at
  before update on landlords
  for each row execute function touch_updated_at();

drop trigger if exists trg_tenants_touch_updated_at on tenants;
create trigger trg_tenants_touch_updated_at
  before update on tenants
  for each row execute function touch_updated_at();

drop trigger if exists trg_banks_touch_updated_at on banks;
create trigger trg_banks_touch_updated_at
  before update on banks
  for each row execute function touch_updated_at();

-- Force PostgREST to pick up the new columns immediately.
notify pgrst, 'reload schema';
