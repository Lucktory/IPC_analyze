-- Rental Admin schema — paste into Supabase SQL Editor and run.
-- Designed for the Plager-derived rental administration domain.

drop table if exists recibos cascade;
drop table if exists adjustments cascade;
drop table if exists payments cascade;
drop table if exists contracts cascade;
drop table if exists tenants cascade;
drop table if exists owners cascade;
drop table if exists bank_accounts cascade;
drop table if exists cpi_values cascade;
drop table if exists administrations cascade;

create table administrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid references administrations(id) on delete cascade,
  bank_name text not null,
  account_alias text not null,
  account_number text,
  created_at timestamptz default now()
);

create table owners (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid references administrations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  commission_pct numeric(5,2) default 8.0,
  created_at timestamptz default now()
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid references administrations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid references administrations(id) on delete cascade,
  owner_id uuid references owners(id) not null,
  tenant_id uuid references tenants(id) not null,
  bank_account_id uuid references bank_accounts(id),
  address text not null,
  property_type text default 'vivienda',
  current_rent numeric(12,2) not null,
  expensas numeric(12,2) default 0,
  indexer text default 'IPC_GENERAL',
  cadence text default 'trimestral',
  start_date date not null,
  end_date date not null,
  next_adjustment_date date,
  payment_day int default 5,
  late_interest_enabled boolean default false,
  late_interest_rate numeric(5,2) default 5.0,
  status text default 'active',
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  bank_account_id uuid references bank_accounts(id),
  direction text not null check (direction in ('IN', 'OUT')),
  amount numeric(12,2) not null,
  period date not null,
  expected_date date not null,
  bank_date date,
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

create table adjustments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  applied_at date not null,
  old_rent numeric(12,2) not null,
  new_rent numeric(12,2) not null,
  factor numeric(10,6) not null,
  cpi_values jsonb not null,
  formula text default 'compound',
  cadence_used text not null,
  created_at timestamptz default now()
);

create table cpi_values (
  month date primary key,
  variation_pct numeric(6,3) not null,
  source text default 'INDEC',
  fetched_at timestamptz default now()
);

create table recibos (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  payment_id uuid references payments(id),
  numero text not null,
  serie text default 'A',
  fecha date not null,
  monto numeric(12,2) not null,
  concepto text not null,
  estado text default 'emitido',
  created_at timestamptz default now()
);

create index idx_recibos_contract on recibos(contract_id);
create index idx_recibos_fecha on recibos(fecha);

create index idx_contracts_next_adjustment on contracts(next_adjustment_date);
create index idx_contracts_admin on contracts(administration_id);
create index idx_payments_contract on payments(contract_id);
create index idx_payments_period on payments(period);
create index idx_adjustments_contract on adjustments(contract_id);
