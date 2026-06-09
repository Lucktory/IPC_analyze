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
drop table if exists liquidacion_lines cascade;
drop table if exists liquidaciones cascade;
drop table if exists recibos cascade;
drop table if exists adjustments cascade;
drop table if exists cpi_values cascade;
drop table if exists transactions cascade;
drop table if exists transaction_types cascade;
drop table if exists contract_administrators cascade;
drop table if exists contract_tenants cascade;
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
  created_at timestamptz default now()
);
create index idx_landlords_admin on landlords(administration_id);

-- ----------------------------------------------------------------------------
-- 6. BANKS — lookup of Argentine banks
-- ----------------------------------------------------------------------------
create table banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text,
  created_at timestamptz default now()
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
  created_at timestamptz default now()
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
  notes text,
  created_at timestamptz default now()
);
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
  created_at timestamptz default now(),
  unique (contract_id, landlord_id, period)
);
create index idx_liquidaciones_admin on liquidaciones(administration_id);
create index idx_liquidaciones_contract on liquidaciones(contract_id);
create index idx_liquidaciones_period on liquidaciones(period);
create index idx_liquidaciones_status on liquidaciones(status);

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

-- Transaction types (21 codes covering everything Alejandro records)
insert into transaction_types (code, label, direction, category, affects_liquidacion) values
  ('RENT_IN',           'Alquiler cobrado',                'IN',  'rent',       true),
  ('EXPENSAS_IN',       'Expensas cobradas',               'IN',  'expense',    true),
  ('DEPOSIT_IN',        'Depósito de garantía',            'IN',  'deposit',    false),
  ('LATE_FEE_IN',       'Recargo por mora',                'IN',  'rent',       true),
  ('UTILITY_REFUND_IN', 'Reintegro servicios',             'IN',  'refund',     true),
  ('OTHER_IN',          'Otro ingreso',                    'IN',  'other',      true),

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

-- Administration + 4 partners (matches Alejandro's real partnership)
with admin_row as (
  insert into administrations (name, legal_name)
  values ('Pampa Administración', 'Pampa Administración SRL')
  returning id
)
insert into administrators (administration_id, name, email, default_commission_pct)
select id, n, e, p from admin_row, (values
  ('Flavio H.',    'flavio@pampa-admin.com.ar',    25.0),
  ('Lisa H.',      'lisa@pampa-admin.com.ar',      25.0),
  ('Alejandro H.', 'alejandro@pampa-admin.com.ar', 25.0),
  ('Dorso',        'dorso@pampa-admin.com.ar',     25.0)
) as t(n, e, p);

-- ============================================================================
-- DONE. After running this, the next step is to populate landlords / tenants /
-- properties / contracts from the migration script that parses Alejandro's
-- spreadsheet CSV.
-- ============================================================================
