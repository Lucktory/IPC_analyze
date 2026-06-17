-- ============================================================================
-- Migration: contracts billing fields + tax categories (2026-06-17 — Phase 11)
-- ============================================================================
-- Captures everything Alejandro showed us in the three sample rendiciones
-- (ALVAREZ / VILLAREAL / SIMOES) that the schema did not yet model:
--
--   • Billing identity per contract       — RI (Alejandro) vs Mono (relative)
--     determines whether IVA is added to commission.
--   • Commission base argument            — "9% sobre el alquiler, NO sobre
--     el IVA" — some landlords dispute what the % applies to.
--   • Commercial-contract IVA on rent     — only commercial RI tenants pay
--     IVA on the rent itself.
--   • Sellado de rentas                   — one-time municipal stamp tax,
--     50% landlord / 50% tenant, deducted on first liquidación.
--   • Depósito en garantía                — explicit amount + status
--     (held / partially_used / refunded) tied to end-of-contract refund.
--   • Recurring ABL surcharge             — many contracts: rent + ABL
--     monthly (tenant pays both).
--   • Expensas payer                      — receipt 3 shows EXPENSAS ARTIGAS
--     deducted from landlord (agency paid consorcio), not always tenant.
--
-- Plus tax_category columns on administrators / tenants / landlords so the
-- IVA decisions for commission and rent can be computed deterministically
-- without hard-coding "Alejandro" anywhere.
--
-- ADDITIVE migration. All new columns are nullable or defaulted, so no
-- existing row breaks and no application code needs to change in lockstep.
-- Idempotent (every ADD COLUMN uses IF NOT EXISTS).
-- ============================================================================

-- ── contracts: 11 new columns ─────────────────────────────────────────────
alter table contracts
  add column if not exists billing_administrator_id   uuid references administrators(id),
  add column if not exists commission_includes_iva    boolean not null default false,
  add column if not exists commission_base            text    not null default 'gross_ingresos',
  add column if not exists is_commercial              boolean not null default false,
  add column if not exists rent_iva_rate              numeric(5,2) not null default 0,
  add column if not exists sellado_total              numeric(14,2),
  add column if not exists sellado_landlord_share_pct numeric(5,2) default 50,
  add column if not exists sellado_applied_at         date,
  add column if not exists deposit_amount             numeric(14,2),
  add column if not exists deposit_status             text    not null default 'held',
  add column if not exists includes_abl               boolean not null default false,
  add column if not exists abl_amount                 numeric(14,2),
  add column if not exists expensas_payer             text    not null default 'tenant';

-- ── CHECK constraints (added separately so they're idempotent via DO blocks)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_commission_base_chk') then
    alter table contracts add constraint contracts_commission_base_chk
      check (commission_base in ('gross_ingresos','rent_only','rent_plus_iva','rent_plus_recuperos'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contracts_deposit_status_chk') then
    alter table contracts add constraint contracts_deposit_status_chk
      check (deposit_status in ('held','partially_used','refunded'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contracts_expensas_payer_chk') then
    alter table contracts add constraint contracts_expensas_payer_chk
      check (expensas_payer in ('tenant','landlord','split'));
  end if;
end$$;

-- ── administrators: who invoices (RI adds IVA, Mono doesn't) ──────────────
alter table administrators
  add column if not exists tax_category text not null default 'RI';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'administrators_tax_category_chk') then
    alter table administrators add constraint administrators_tax_category_chk
      check (tax_category in ('RI','MONOTRIBUTO','EXENTO'));
  end if;
end$$;

-- ── tenants: commercial-IVA classification ────────────────────────────────
alter table tenants
  add column if not exists tax_category text not null default 'CF';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_tax_category_chk') then
    alter table tenants add constraint tenants_tax_category_chk
      check (tax_category in ('RI','MONOTRIBUTO','CF','EXENTO'));
  end if;
end$$;

-- ── landlords: tax classification (CF = consumidor final by default) ──────
alter table landlords
  add column if not exists tax_category text not null default 'CF';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'landlords_tax_category_chk') then
    alter table landlords add constraint landlords_tax_category_chk
      check (tax_category in ('RI','MONOTRIBUTO','CF','EXENTO'));
  end if;
end$$;

-- ── Helpful index for "all contracts billed by entity X" queries ──────────
create index if not exists idx_contracts_billing_admin
  on contracts (billing_administrator_id);

-- ── Reload schema cache for PostgREST ─────────────────────────────────────
notify pgrst, 'reload schema';

-- ── Sanity check ──────────────────────────────────────────────────────────
select
  (select count(*) from contracts)       as contracts_rows,
  (select count(*) from administrators)  as administrators_rows,
  (select count(*) from tenants)         as tenants_rows,
  (select count(*) from landlords)       as landlords_rows;
