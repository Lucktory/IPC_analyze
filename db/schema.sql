-- ============================================================================
-- IPC-ANALYZE — Rental Administration Schema v2
-- ============================================================================
-- Designed from Alejandro H.'s real spreadsheet (567 rows, 130 contracts,
-- 4-administrator partnership). Paste into Supabase SQL Editor and run.
--
-- Key design decisions:
--   • Properties are independent of contracts (vacancies are first-class)
--   • Contracts use junction tables for co-ownership, co-tenancy, and
--     multi-administrator commission splits (Flavio / Lisa / Alejandro / Dorso)
--   • Bank accounts are polymorphic — owned by administration, administrator,
--     or landlord — enforced via a check constraint
--   • Transactions reference a transaction_types lookup (21 seeded types)
--   • Liquidaciones (monthly settlements) follow Alejandro's gray→green→blue
--     status flow: draft → sent → paid
--   • IPC adjustments store the cpi_values snapshot as jsonb for audit trail
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP EXISTING (reverse order of create due to FKs)
-- ----------------------------------------------------------------------------
drop table if exists contract_events cascade;
drop table if exists contract_recurring_charges cascade;
drop table if exists rendicion_landlords cascade;
drop table if exists rendiciones cascade;
drop table if exists liquidacion_lines cascade;
drop table if exists liquidaciones cascade;
drop table if exists recibos cascade;
drop table if exists adjustments cascade;
drop table if exists cpi_values cascade;
drop table if exists transactions cascade;
drop table if exists transaction_types cascade;
drop table if exists contract_administrators cascade;
drop table if exists contract_tenants cascade;
drop table if exists contract_period_notes cascade;
drop table if exists property_landlords cascade;
drop table if exists contract_landlords cascade;
drop table if exists contracts cascade;
drop table if exists properties cascade;
drop table if exists tenants cascade;
drop table if exists bank_accounts cascade;
drop table if exists banks cascade;
drop table if exists landlords cascade;
drop table if exists external_accountants cascade;
drop table if exists administrators cascade;
drop table if exists administrations cascade;

-- ----------------------------------------------------------------------------
-- 2. ADMINISTRATIONS — parent org (one row per admin company)
-- ----------------------------------------------------------------------------
create table administrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cuit text,
  address text,
  phone text,
  email text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 3. ADMINISTRATORS — individual partners (Flavio, Lisa, Alejandro, Dorso)
-- ----------------------------------------------------------------------------
create table administrators (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  default_commission_pct numeric(5,2) default 25.0,
  is_active boolean default true,
  -- Phase 11: RI adds IVA on commission invoices, Monotributo doesn't.
  -- Determines whether contracts billed by this administrator add IVA.
  tax_category text not null default 'RI' check (tax_category in ('RI','MONOTRIBUTO','EXENTO')),
  created_at timestamptz default now()
);
create index idx_administrators_admin on administrators(administration_id);

-- ----------------------------------------------------------------------------
-- 4. EXTERNAL ACCOUNTANTS — outsourced bookkeepers some landlords use
--    (defined before landlords so the FK resolves)
-- ----------------------------------------------------------------------------
create table external_accountants (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  firm_name text,
  created_at timestamptz default now()
);
create index idx_external_accountants_admin on external_accountants(administration_id);

-- ----------------------------------------------------------------------------
-- 5. LANDLORDS — property owners (called "propietarios" in ES)
-- ----------------------------------------------------------------------------
create table landlords (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  dni_or_cuit text,
  external_accountant_id uuid references external_accountants(id) on delete set null,
  notes text,
  -- Phase 11: tax classification for receipt generation
  tax_category text not null default 'CF' check (tax_category in ('RI','MONOTRIBUTO','CF','EXENTO')),
  -- Phase 11: secondary email addresses (LODDO, NEYERTZ, ESQUINA 4 in
  -- Alejandro's current list each have two on file). Primary stays in
  -- `email`; this array carries the rest. NULL → no extras.
  alt_emails text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
create index idx_landlords_admin on landlords(administration_id);

-- ----------------------------------------------------------------------------
-- 6. BANKS — lookup of Argentine banks
-- ----------------------------------------------------------------------------
create table banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text,
  -- Operational fields (added 2026-06-11 — per-bank fees + contact info)
  monthly_fee        numeric(12,2),
  transfer_fee_pct   numeric(5,2),
  transfer_fee_fixed numeric(12,2),
  contact_name       text,
  contact_phone      text,
  contact_email      text,
  notes              text,
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. BANK ACCOUNTS — polymorphic owner (admin OR administrator OR landlord)
--    Enforced via check constraint: exactly one of the three FKs must be set.
-- ----------------------------------------------------------------------------
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references banks(id),
  administration_id uuid references administrations(id) on delete cascade,
  administrator_id uuid references administrators(id) on delete cascade,
  landlord_id uuid references landlords(id) on delete cascade,
  alias text not null,
  account_number text,
  cbu text,
  account_type text default 'CA' check (account_type in ('CA','CC','USD')),
  is_active boolean default true,
  created_at timestamptz default now(),
  constraint bank_account_one_owner check (
    (administration_id is not null)::int +
    (administrator_id  is not null)::int +
    (landlord_id       is not null)::int = 1
  )
);
create index idx_bank_accounts_admin on bank_accounts(administration_id);
create index idx_bank_accounts_administrator on bank_accounts(administrator_id);
create index idx_bank_accounts_landlord on bank_accounts(landlord_id);

-- ----------------------------------------------------------------------------
-- 8. TENANTS — renters (called "inquilinos" in ES)
-- ----------------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  dni text,
  notes text,
  -- Phase 11: tax classification. Commercial RI tenants pay IVA on rent;
  -- commercial Monotributo tenants don't; residential = CF by default.
  tax_category text not null default 'CF' check (tax_category in ('RI','MONOTRIBUTO','CF','EXENTO')),
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
create index idx_tenants_admin on tenants(administration_id);

-- ----------------------------------------------------------------------------
-- 9. PROPERTIES — independent of contracts (vacancies are first-class)
-- ----------------------------------------------------------------------------
create table properties (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  address text not null,
  unit text,
  city text default 'CABA',
  province text default 'Buenos Aires',
  property_type text default 'vivienda' check (property_type in ('vivienda','local','cochera','oficina','deposito')),
  rooms int,
  surface_m2 numeric(8,2),
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index idx_properties_admin on properties(administration_id);

-- ----------------------------------------------------------------------------
-- 9b. PROPERTY_LANDLORDS — direct property↔landlord ownership (junction)
--
-- Why this junction exists separately from contract_landlords:
--   • A property has owners even when it has NO active contract (vacancies
--     would otherwise be orphaned).
--   • Co-ownership at the property level: BIRKHOFER MONICA + SONIA,
--     ESTRADA ENRIQUE + QUEDIMAN, etc. — these share ownership independent
--     of which contract is currently active.
--   • Ownership persists across contract changes (when one tenant rescinds
--     and another comes in, the owners don't change).
--   • Future: add is_active + start_date + end_date here to track ownership
--     transfers (property sold from X to Y on date Z).
-- ----------------------------------------------------------------------------
create table property_landlords (
  property_id uuid not null references properties(id) on delete cascade,
  landlord_id uuid not null references landlords(id) on delete restrict,
  ownership_pct numeric(5,2) not null default 100.0 check (ownership_pct > 0 and ownership_pct <= 100),
  primary key (property_id, landlord_id)
);
create index idx_property_landlords_landlord on property_landlords(landlord_id);

-- ----------------------------------------------------------------------------
-- 10. CONTRACTS — rental agreements (tied to a property)
-- ----------------------------------------------------------------------------
create table contracts (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  property_id uuid not null references properties(id) on delete restrict,
  contract_number text,
  current_rent numeric(12,2) not null,
  initial_rent numeric(12,2) not null,
  expensas numeric(12,2) default 0,
  -- Two-part commercial rent (2026-07-06): some contracts bill a facturado
  -- part (with factura; +IVA when RI, 0 when Monotributo) plus a "no facturado"
  -- (N/F) part paid without invoice. Both are real rent. When the split is
  -- used, current_rent holds the full total; these break it down and drive
  -- the aumento (applied to each part) + the liquidacion N/F line (RENT_NF_IN).
  rent_facturado_neto numeric(14,2),
  rent_no_facturado   numeric(14,2) not null default 0,
  currency text default 'ARS' check (currency in ('ARS','USD')),
  indexer text default 'IPC_GENERAL' check (indexer in ('IPC_GENERAL','ICL','CASA_PROPIA','FIXED')),
  cadence text default 'trimestral' check (cadence in ('mensual','bimestral','trimestral','cuatrimestral','semestral','anual')),
  start_date date not null,
  end_date date not null,
  next_adjustment_date date,
  last_adjustment_date date,
  payment_day int default 5 check (payment_day between 1 and 31),
  late_interest_enabled boolean default false,
  late_interest_rate numeric(5,2) default 5.0,
  bank_account_id uuid references bank_accounts(id),
  status text default 'active' check (status in ('draft','active','suspended','ended','rescinded')),
  -- Pampa-internal code identifying which administrator handles this
  -- contract (L=Lisa, F=Flavio, A=Alejandro). Matches the LFA column from
  -- the encargada's current Excel.
  lfa_code text,
  -- Pampa's commission percentage, applied to TOTAL COBRADO (alquiler
  -- + recuperos), per Alejandro's confirmed spec #2.
  commission_pct numeric(5,2) default 8.0,
  -- Durable default destination bank for this contract's commission (ADMI).
  -- The commission follows the administración's assigned Pampa account; every
  -- period's COMMISSION_OUT inherits this (see lib/transaction setCommission).
  -- NULL = no default yet. Added 2026-07 (db/julio-2026/01-…).
  commission_destination text
    check (commission_destination in ('ADM_GALICIA','ADM_FRANCES_50_9','ADM_FRANCES_51_6')),
  -- ── Phase 11: billing identity + tax rules (2026-06-17) ───────────────
  --
  -- Who invoices the commission. RI administrators add IVA; Monotributo
  -- administrators don't. NULL = use the administration's default partner.
  billing_administrator_id   uuid references administrators(id),
  -- Stored explicitly so a contract can override the billing entity's
  -- default. Defaults to false, set to true when billed by an RI partner.
  commission_includes_iva    boolean not null default false,
  -- What the commission % applies against. Default = full cobrado.
  -- Some landlords dispute and want it on rent only.
  commission_base            text not null default 'gross_ingresos'
                             check (commission_base in
                               ('gross_ingresos','rent_only','rent_plus_iva','rent_plus_recuperos')),
  -- Commercial contract IVA on rent itself (residential = 0).
  is_commercial              boolean not null default false,
  rent_iva_rate              numeric(5,2) not null default 0,
  -- Sellado de rentas (one-time municipal stamp tax, 50/50 by default).
  -- Deducted from the landlord's first liquidación when applied.
  sellado_total              numeric(14,2),
  sellado_landlord_share_pct numeric(5,2) default 50,
  sellado_applied_at         date,
  -- Depósito en garantía (paid by tenant on month 1, held by landlord,
  -- refunded at contract end).
  deposit_amount             numeric(14,2),
  deposit_status             text not null default 'held'
                             check (deposit_status in ('held','partially_used','refunded')),
  -- (Recurring charges that get added to the rent — ABL, THU, Camuzzi, etc.
  -- — live in the `contract_recurring_charges` table below. The old
  -- includes_abl + abl_amount columns were dropped 2026-06-20 in favor of
  -- the more general N-per-contract design.)
  -- Who pays the building consorcio expensas.
  expensas_payer             text not null default 'tenant'
                             check (expensas_payer in ('tenant','landlord','split')),
  notes text,
  created_at timestamptz default now(),
  -- 2026-06-16: planilla sorts by "most recently added or modified".
  -- The trigger below bumps this on every UPDATE.
  updated_at timestamptz not null default now()
);
create index idx_contracts_billing_admin on contracts(billing_administrator_id);
create index idx_contracts_admin on contracts(administration_id);
create index idx_contracts_property on contracts(property_id);
create index idx_contracts_status on contracts(status);
create index idx_contracts_next_adjustment on contracts(next_adjustment_date);

-- ----------------------------------------------------------------------------
-- 11. CONTRACT_LANDLORDS — junction for co-ownership (sum of pct should = 100)
-- ----------------------------------------------------------------------------
create table contract_landlords (
  contract_id uuid not null references contracts(id) on delete cascade,
  landlord_id uuid not null references landlords(id) on delete restrict,
  ownership_pct numeric(5,2) not null default 100.0 check (ownership_pct > 0 and ownership_pct <= 100),
  primary key (contract_id, landlord_id)
);
create index idx_contract_landlords_landlord on contract_landlords(landlord_id);

-- ----------------------------------------------------------------------------
-- 12. CONTRACT_TENANTS — junction for co-tenancy (one is_primary per contract)
-- ----------------------------------------------------------------------------
create table contract_tenants (
  contract_id uuid not null references contracts(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete restrict,
  is_primary boolean default false,
  -- Phase 11: per-tenant share of the rent (default 100 = single tenant).
  -- Sum across rows for the same contract is enforced in application code.
  share_pct numeric(5,2) not null default 100
            check (share_pct > 0 and share_pct <= 100),
  primary key (contract_id, tenant_id)
);
create index idx_contract_tenants_tenant on contract_tenants(tenant_id);

-- ----------------------------------------------------------------------------
-- 13. CONTRACT_ADMINISTRATORS — commission split among the 4 partners
-- ----------------------------------------------------------------------------
create table contract_administrators (
  contract_id uuid not null references contracts(id) on delete cascade,
  administrator_id uuid not null references administrators(id) on delete restrict,
  share_pct numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  primary key (contract_id, administrator_id)
);
create index idx_contract_administrators_administrator on contract_administrators(administrator_id);

-- ----------------------------------------------------------------------------
-- 13b. CONTRACT_PERIOD_NOTES — free-text scratchpad per (contract × period).
--      Mirrors Alejandro's DEUDA Y/U OBSERVACIONES column from his ledger:
--      a place to jot the month's expected rent, ad-hoc deductions
--      (THU bills, deposit recoveries, accountant remarks, etc.).
-- ----------------------------------------------------------------------------
create table contract_period_notes (
  contract_id uuid        not null references contracts(id) on delete cascade,
  period      date        not null,
  body        text        not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (contract_id, period)
);
create index idx_contract_period_notes_period on contract_period_notes(period);

-- ----------------------------------------------------------------------------
-- 13b-ter. CONTRACT_RECURRING_CHARGES — recargos mensuales (ABL, THU,
--      Camuzzi, Tasa de Limpieza, Edesur, AySA, ...). Each contract can
--      have many; each has an optional `recupero_type_code` linking to
--      transaction_types so the planilla can check "this charge was
--      recorded this month" automatically. Replaces the single-ABL
--      contracts.includes_abl/abl_amount columns (migration 2026-06-20).
-- ----------------------------------------------------------------------------
create table contract_recurring_charges (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid not null references contracts(id) on delete cascade,
  label               text not null,
  amount              numeric(12,2) not null check (amount > 0),
  -- Optional FK to transaction_types.code. When set, drives the cobro
  -- completeness check used by the planilla Recargos cell + validation rule.
  recupero_type_code  text references transaction_types(code) on delete set null,
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_contract_recurring_charges_contract
  on contract_recurring_charges(contract_id);
create index idx_contract_recurring_charges_active
  on contract_recurring_charges(contract_id, active)
  where active = true;

-- ----------------------------------------------------------------------------
-- 13b-bis. CONTRACT_EVENTS — unified per-contract timeline / dossier (Phase 11).
--      One row per situation that happens during a contract's life:
--      arreglos (pintura, plomería), aumentos aplicados, mails enviados,
--      observaciones libres, cambios de estado. Distinguished by `kind`,
--      queried by `contract_id` and ordered by `occurred_at`.
--      Designed minimal: six business columns. New kinds can be added in
--      the application layer without a schema change.
-- ----------------------------------------------------------------------------
create table contract_events (
  id                  bigserial    primary key,
  contract_id         uuid         not null references contracts(id) on delete cascade,
  occurred_at         timestamptz  not null default now(),
  kind                text         not null,    -- arreglo | aumento | mail_enviado | observacion | status_change | ...
  description         text,
  -- Total monetary impact of the event (for arreglos: amount_landlord + amount_tenant).
  amount              numeric(14,2),
  -- Phase 11 (v2): payer is NOT binary. Split allowed (mitad y mitad, 70/30, etc.).
  amount_landlord     numeric(14,2) default 0,
  amount_tenant       numeric(14,2) default 0,
  -- Honorarios only: true = the (neto) amount also charges 21% IVA on top.
  -- Stored amount is NETO (agency income); IVA = amount*0.21, total con IVA =
  -- amount*1.21 (both DERIVED, not stored). Mirrors commission_includes_iva.
  includes_iva        boolean not null default false,
  -- When the discount/charge lands in a liquidación. Drives the day-of-month
  -- deferral rule (repair before payment_day → this period, after → next period).
  applies_to_period   date,
  -- Drives the planilla's red carryover reminder.
  status              text not null default 'pending'
                      check (status in ('pending','applied','cancelled')),
  -- Photo / worker receipt URL (Supabase Storage).
  attachment_url      text,
  created_by          uuid,                       -- auth.users id (loose link, not FK)
  created_at          timestamptz not null default now()
);
create index idx_contract_events_contract_occurred
  on contract_events (contract_id, occurred_at desc);
-- "Pending repairs landing in this period" — drives the red carryover view.
create index idx_contract_events_pending_by_period
  on contract_events (applies_to_period, status)
  where status = 'pending';

-- ----------------------------------------------------------------------------
-- 14. TRANSACTION_TYPES — lookup for every kind of money movement
-- ----------------------------------------------------------------------------
create table transaction_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  direction text not null check (direction in ('IN','OUT')),
  category text not null check (category in ('rent','commission','expense','tax','utility','deposit','refund','transfer','other')),
  affects_liquidacion boolean default true,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 15. TRANSACTIONS — all money movements (replaces v1's payments table)
-- ----------------------------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  contract_id uuid references contracts(id) on delete set null,
  transaction_type_id uuid not null references transaction_types(id),
  bank_account_id uuid references bank_accounts(id),
  amount numeric(12,2) not null check (amount >= 0),
  currency text default 'ARS' check (currency in ('ARS','USD')),
  period date,
  expected_date date,
  bank_date date,
  status text default 'pending' check (status in ('pending','partial','paid','overdue','cancelled')),
  description text,
  external_ref text,
  created_at timestamptz default now()
);
create index idx_transactions_admin on transactions(administration_id);
create index idx_transactions_contract on transactions(contract_id);
create index idx_transactions_type on transactions(transaction_type_id);
create index idx_transactions_period on transactions(period);
create index idx_transactions_status on transactions(status);
create index idx_transactions_bank_date on transactions(bank_date);

-- ----------------------------------------------------------------------------
-- 15b. RENDICIONES — Phase 11. Aggregates one or more child liquidaciones
--      for a single (landlord × period). Receipt 3 (SIMOES) had Orieta and
--      Maguna contracts on ONE rendición because the landlord (Simoes
--      brothers) was the same. Created BEFORE liquidaciones because the
--      liquidaciones.rendicion_id FK references this table.
-- ----------------------------------------------------------------------------
create table rendiciones (
  id                uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  period            date not null,
  total_gross       numeric(14,2) not null default 0,
  total_deductions  numeric(14,2) not null default 0,
  total_neto        numeric(14,2) not null default 0,
  status            text not null default 'draft' check (status in ('draft','sent','paid')),
  sent_at           timestamptz,
  paid_at           timestamptz,
  pdf_url           text,
  notes             text,
  created_at        timestamptz not null default now()
  -- Uniqueness of "one rendición per (landlord-set × period)" is
  -- enforced in application code (sort-and-hash the landlord set).
);
create index idx_rendiciones_admin   on rendiciones (administration_id);
create index idx_rendiciones_period  on rendiciones (period desc);
create index idx_rendiciones_status  on rendiciones (status);

-- Junction: which landlords receive this rendición. Receipt 3 (SIMOES)
-- has two rows here (Adrián + Juan); a single-owner rendición has one.
create table rendicion_landlords (
  rendicion_id uuid not null references rendiciones(id) on delete cascade,
  landlord_id  uuid not null references landlords(id)   on delete restrict,
  primary key (rendicion_id, landlord_id)
);
create index idx_rendicion_landlords_landlord on rendicion_landlords (landlord_id);

-- ----------------------------------------------------------------------------
-- 16. LIQUIDACIONES — monthly settlement to landlord (gray→green→blue flow)
-- ----------------------------------------------------------------------------
create table liquidaciones (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references administrations(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete restrict,
  landlord_id uuid not null references landlords(id) on delete restrict,
  period date not null,
  gross_amount numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_to_landlord numeric(12,2) not null default 0,
  status text default 'draft' check (status in ('draft','sent','paid')),
  sent_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  notes text,
  -- Signed manual adjustment to the transferencia al propietario. Positive
  -- = extra paid out, negative = extra deducted. Shown alongside notes in
  -- the OBSERVACIONES column of the liquidación grid.
  adjustment_amount numeric(12,2) default 0,
  -- Phase 11: opt-in parent rendición for multi-contract aggregation
  -- (Receipt 3 / SIMOES case). NULL = single-contract email flow.
  rendicion_id uuid references rendiciones(id) on delete set null,
  created_at timestamptz default now(),
  unique (contract_id, landlord_id, period)
);
create index idx_liquidaciones_admin     on liquidaciones(administration_id);
create index idx_liquidaciones_contract  on liquidaciones(contract_id);
create index idx_liquidaciones_period    on liquidaciones(period);
create index idx_liquidaciones_status    on liquidaciones(status);
create index idx_liquidaciones_rendicion on liquidaciones(rendicion_id);

-- ----------------------------------------------------------------------------
-- 17. LIQUIDACION_LINES — itemized breakdown linked to transactions
-- ----------------------------------------------------------------------------
create table liquidacion_lines (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references liquidaciones(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  direction text not null check (direction in ('IN','OUT')),
  label text not null,
  amount numeric(12,2) not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
create index idx_liquidacion_lines_liq on liquidacion_lines(liquidacion_id);

-- ----------------------------------------------------------------------------
-- 18. ADJUSTMENTS — IPC rent adjustments (audit trail with cpi_values snapshot)
-- ----------------------------------------------------------------------------
create table adjustments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  applied_at date not null,
  old_rent numeric(12,2) not null,
  new_rent numeric(12,2) not null,
  factor numeric(10,6) not null,
  cpi_values jsonb not null,
  formula text default 'compound' check (formula in ('compound','simple','manual')),
  cadence_used text not null,
  notified_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
create index idx_adjustments_contract on adjustments(contract_id);
create index idx_adjustments_applied_at on adjustments(applied_at);

-- ----------------------------------------------------------------------------
-- 19. CPI_VALUES — INDEC monthly IPC variation
-- ----------------------------------------------------------------------------
create table cpi_values (
  month date primary key,
  variation_pct numeric(6,3) not null,
  source text default 'INDEC',
  fetched_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 20. RECIBOS — receipts issued to tenants
-- ----------------------------------------------------------------------------
create table recibos (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  numero text not null,
  serie text default 'A',
  fecha date not null,
  monto numeric(12,2) not null,
  concepto text not null,
  estado text default 'emitido' check (estado in ('emitido','anulado','reemplazado')),
  pdf_url text,
  created_at timestamptz default now(),
  unique (serie, numero)
);
create index idx_recibos_contract on recibos(contract_id);
create index idx_recibos_fecha on recibos(fecha);

-- ============================================================================
-- 20b. AUTO-TOUCH TRIGGERS — keep updated_at fresh on every UPDATE.
--      The planilla, the /propietarios list, /inquilinos list, /bancos list
--      all sort or highlight by updated_at desc so the most recently edited
--      row floats to the top. Without these triggers updated_at stays at
--      the insert value forever and the sort becomes meaningless.
--
--      Two trigger functions because the contracts trigger predated the
--      generic one; kept both for backwards compat with existing seeds.
-- ============================================================================

create or replace function touch_contract_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contracts_touch_updated_at on contracts;
create trigger trg_contracts_touch_updated_at
  before update on contracts
  for each row execute function touch_contract_updated_at();

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

-- ============================================================================
-- 21. SEED DATA
-- ============================================================================

-- Banks (most common in Argentina)
insert into banks (name, short_code) values
  ('Banco Galicia',        'GALICIA'),
  ('Banco Santander',      'SANTANDER'),
  ('Banco Macro',          'MACRO'),
  ('Banco BBVA',           'BBVA'),
  ('Banco Nación',         'NACION'),
  ('Banco Provincia',      'PROVINCIA'),
  ('Banco Ciudad',         'CIUDAD'),
  ('Banco Patagonia',      'PATAGONIA'),
  ('Banco Hipotecario',    'HIPOTECARIO'),
  ('Banco Supervielle',    'SUPERVIELLE'),
  ('Banco Itaú',           'ITAU'),
  ('Banco Credicoop',      'CREDICOOP'),
  ('Banco ICBC',           'ICBC'),
  ('Banco Comafi',         'COMAFI'),
  ('Mercado Pago',         'MP');

-- Transaction types (22 codes covering everything Alejandro records)
insert into transaction_types (code, label, direction, category, affects_liquidacion) values
  ('RENT_IN',              'Alquiler cobrado',              'IN',  'rent',       true),
  ('RENT_NF_IN',           'Alquiler s/factura (N/F)',      'IN',  'rent',       true),
  ('EXPENSAS_IN',          'Expensas cobradas',             'IN',  'expense',    true),
  ('DEPOSIT_IN',           'Depósito de garantía',          'IN',  'deposit',    false),
  ('LATE_FEE_IN',          'Recargo por mora',              'IN',  'rent',       true),
  ('UTILITY_REFUND_IN',    'Reintegro servicios',           'IN',  'refund',     true),
  ('OTHER_IN',             'Otro ingreso',                  'IN',  'other',      true),
  -- Labeled recupero types so the planilla's Ingresos breakdown can show
  -- which service the tenant paid back (Phase 6 / migration 2026-06-16).
  -- Without these the seeded transaction_types only has UTILITY_REFUND_IN
  -- and the InlineIngresosCell dropdown breaks for fresh installs.
  ('RECUPERO_ABL_IN',      'Recupero ABL',                  'IN',  'refund',     true),
  ('RECUPERO_AYSA_IN',     'Recupero AySA',                 'IN',  'refund',     true),
  ('RECUPERO_METROGAS_IN', 'Recupero Metrogas / Gas',       'IN',  'refund',     true),
  ('RECUPERO_EDESUR_IN',   'Recupero Edesur / Luz',         'IN',  'refund',     true),
  ('RECUPERO_SCPL_IN',     'Recupero SCPL (luz/agua)',      'IN',  'refund',     true),
  ('RECUPERO_COAGUA_IN',   'Recupero Coagua (agua)',        'IN',  'refund',     true),
  ('RECUPERO_OTRO_IN',     'Recupero otro servicio',        'IN',  'refund',     true),

  ('COMMISSION_OUT',    'Comisión administrador',          'OUT', 'commission', true),
  ('LANDLORD_PAYOUT',   'Pago a propietario',              'OUT', 'rent',       false),
  ('EXPENSAS_OUT',      'Pago de expensas',                'OUT', 'expense',    true),
  ('ABL_OUT',           'ABL / Tasas municipales',         'OUT', 'tax',        true),
  ('AYSA_OUT',          'AySA',                            'OUT', 'utility',    true),
  ('EDESUR_OUT',        'Edesur / Electricidad',           'OUT', 'utility',    true),
  ('METROGAS_OUT',      'Metrogas / Gas',                  'OUT', 'utility',    true),
  ('AFIP_OUT',          'AFIP / Impuestos nacionales',     'OUT', 'tax',        true),
  ('REPAIR_OUT',        'Reparación / Mantenimiento',      'OUT', 'expense',    true),
  ('LEGAL_OUT',         'Honorarios legales',              'OUT', 'expense',    true),
  ('INSURANCE_OUT',     'Seguro',                          'OUT', 'expense',    true),
  ('DEPOSIT_REFUND',    'Devolución de garantía',          'OUT', 'deposit',    false),
  ('BANK_FEE_OUT',      'Gastos bancarios',                'OUT', 'expense',    true),
  ('TRANSFER_OUT',      'Transferencia interna',           'OUT', 'transfer',   false),
  ('OTHER_OUT',         'Otro egreso',                     'OUT', 'other',      true);

-- Administration + 4 partners (matches Alejandro's real partnership).
-- 2026-06-17: real agency is "Patagonia Propiedades" — the seed names
-- below were placeholders during early development.
with admin_row as (
  insert into administrations (name, legal_name, address, phone, email)
  values (
    'Patagonia Propiedades',
    'Patagonia Propiedades',
    'Mitre 674, (9000) Comodoro Rivadavia - Chubut',
    '(0297) 444-4862 / 4441695',
    'patagoniainmo@gmail.com'
  )
  returning id
)
insert into administrators (administration_id, name, email, default_commission_pct)
select id, n, e, p from admin_row, (values
  ('Flavio H.',    'flavio@patagoniainmo.com.ar',    25.0),
  ('Lisa H.',      'lisa@patagoniainmo.com.ar',      25.0),
  ('Alejandro H.', 'alejandro@patagoniainmo.com.ar', 25.0),
  ('Dorso',        'dorso@patagoniainmo.com.ar',     25.0)
) as t(n, e, p);

-- ----------------------------------------------------------------------------
-- 26. USUARIOS — app user profiles + roles (1:1 with Supabase auth.users)
--     Mirrors db/julio-2026/04-usuarios.sql. Admin CRUD runs via the
--     service-role client (bypasses RLS); users self-serve their own row.
-- ----------------------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  dni         text,
  photo_url   text,
  role        text not null default 'user' check (role in ('super_admin','user')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_auth_user();

alter table public.usuarios enable row level security;
drop policy if exists usuarios_select_self on public.usuarios;
create policy usuarios_select_self on public.usuarios for select using (auth.uid() = id);
drop policy if exists usuarios_update_self on public.usuarios;
create policy usuarios_update_self on public.usuarios
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 27. AUDIT_LOG — append-only activity tracking (who did what, when).
--     Mirrors db/julio-2026/05-audit-log.sql. A generic AFTER trigger on every
--     business table captures data changes (before/after jsonb + JWT actor);
--     the app layer logs auth/session/usuarios events via the service-role
--     client. RLS on + no policies => only the trigger + service-role touch it.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,
  actor_email  text,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  summary      text,
  before       jsonb,
  after        jsonb,
  source       text not null default 'trigger'
);
create index if not exists idx_audit_log_occurred on public.audit_log (occurred_at desc);
create index if not exists idx_audit_log_actor    on public.audit_log (actor_id);
create index if not exists idx_audit_log_entity   on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_action   on public.audit_log (action);

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_claims json; v_actor uuid; v_email text;
begin
  begin v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  exception when others then v_claims := null; end;
  v_actor := nullif(v_claims ->> 'sub', '')::uuid;
  v_email := v_claims ->> 'email';
  insert into public.audit_log (occurred_at, actor_id, actor_email, action, entity_type, entity_id, before, after, source)
  values (now(), v_actor, v_email, lower(tg_op), tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(OLD) ->> 'id') else (to_jsonb(NEW) ->> 'id') end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(NEW) else null end,
    'trigger');
  return coalesce(NEW, OLD);
end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'transactions','contracts','liquidaciones','liquidacion_lines','adjustments',
    'contract_landlords','contract_tenants','contract_administrators','contract_period_notes',
    'contract_events','contract_recurring_charges','properties','property_landlords',
    'landlords','tenants','banks','bank_accounts'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
    end if;
  end loop;
end; $$;

-- usuarios: UPDATE + DELETE only (creation captured as 'signup' on auth.users).
drop trigger if exists audit_usuarios on public.usuarios;
create trigger audit_usuarios after update or delete on public.usuarios
  for each row execute function public.audit_row();

-- auth.users: signup (insert) + login (last_sign_in_at change), all in-database.
create or replace function public.audit_auth_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary, source)
    values (new.id, new.email, 'signup', 'auth', new.id::text, 'Alta de cuenta', 'trigger');
  elsif tg_op = 'UPDATE' and new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary, source)
    values (new.id, new.email, 'login', 'session', new.id::text, 'Inicio de sesion en el sistema', 'trigger');
  end if;
  return new;
end; $$;
drop trigger if exists audit_auth_signup on auth.users;
create trigger audit_auth_signup after insert on auth.users for each row execute function public.audit_auth_event();
drop trigger if exists audit_auth_login on auth.users;
create trigger audit_auth_login after update on auth.users for each row execute function public.audit_auth_event();

alter table public.audit_log enable row level security;
revoke update, delete on public.audit_log from anon, authenticated;

-- ============================================================================
-- DONE. After running this, the next step is to populate landlords / tenants /
-- properties / contracts from the migration script that parses Alejandro's
-- spreadsheet CSV.
-- ============================================================================
