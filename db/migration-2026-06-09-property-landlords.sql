-- ============================================================================
-- Migration: add property_landlords junction (2026-06-09)
-- ============================================================================
-- ADDITIVE migration. Does NOT touch existing tables or data — only:
--   1. Creates the new property_landlords junction table
--   2. Disables RLS on it (for parity with the other tables)
--   3. Backfills it from existing data:
--      a. Properties WITH a contract → inherit landlords from contract_landlords
--      b. Vacant properties → parse "Propiedad de X (vacante)" from address
--         and match to the landlord by name
--
-- Safe to run multiple times: the table is conditional and the backfills
-- use ON CONFLICT DO NOTHING. Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the table
-- ---------------------------------------------------------------------------
create table if not exists property_landlords (
  property_id   uuid not null references properties(id) on delete cascade,
  landlord_id   uuid not null references landlords(id) on delete restrict,
  ownership_pct numeric(5,2) not null default 100.0
                 check (ownership_pct > 0 and ownership_pct <= 100),
  primary key (property_id, landlord_id)
);

create index if not exists idx_property_landlords_landlord
  on property_landlords(landlord_id);

-- ---------------------------------------------------------------------------
-- 2. Disable RLS (parity with other Pampa tables for now)
-- ---------------------------------------------------------------------------
alter table property_landlords disable row level security;

-- ---------------------------------------------------------------------------
-- 3a. Backfill from contracts (102 properties with active/rescinded contracts)
--     Co-owned contracts → multiple rows. Ownership % comes from
--     contract_landlords.ownership_pct.
-- ---------------------------------------------------------------------------
insert into property_landlords (property_id, landlord_id, ownership_pct)
select distinct c.property_id, cl.landlord_id, cl.ownership_pct
from contracts c
join contract_landlords cl on cl.contract_id = c.id
on conflict (property_id, landlord_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3b. Backfill vacancies (~18 properties whose address is
--     "Propiedad de X (vacante)" — parse the landlord name out and match).
-- ---------------------------------------------------------------------------
insert into property_landlords (property_id, landlord_id, ownership_pct)
select p.id, l.id, 100.0
from properties p
join landlords l
  on upper(trim(l.name)) =
     upper(trim(regexp_replace(p.address, '^Propiedad de (.+?)( \(vacante\))?$', '\1')))
where p.address ~* '^Propiedad de '
  and p.id not in (select property_id from property_landlords)
on conflict (property_id, landlord_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Sanity check (just a SELECT — won't fail; check the row counts)
-- ---------------------------------------------------------------------------
select
  (select count(*) from properties)         as properties,
  (select count(*) from property_landlords) as property_landlord_rows,
  (select count(distinct property_id) from property_landlords) as properties_with_owner,
  (select count(distinct landlord_id) from property_landlords) as landlords_with_property;
-- Expected on Alejandro's data: 120 / 133 / 120 / 65
