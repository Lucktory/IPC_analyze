-- ============================================================================
-- Migration: rendiciones + liquidacion_payouts (2026-06-17 — Phase 11)
-- ============================================================================
-- Models the two structures Receipt 3 (SIMOES) requires that the existing
-- liquidaciones table cannot represent on its own:
--
--   1. MULTI-CONTRACT AGGREGATION
--      Receipt 3 shows ORIETA + MAGUNA rents on a SINGLE rendición because
--      the landlord is the same (SIMOES brothers). Today liquidaciones is
--      unique on (contract_id, landlord_id, period), so each contract
--      gets its own row and its own email. We need a parent grouping per
--      (landlord_id, period) that pulls the contract-level liquidaciones
--      together. That parent is `rendiciones`.
--
--   2. PER-LANDLORD PAYOUT ROWS
--      Receipt 3 ends with "JUAN $385.323 / ADRIAN $385.323". This split
--      is derived from contract_landlords.ownership_pct, but the displayed
--      amounts have rounding decisions baked in — once the receipt is
--      sent, those amounts have to stay reproducible. `liquidacion_payouts`
--      persists the (liquidacion → landlord → amount) split rows so the
--      receipt can be reprinted later identically.
--
-- ADDITIVE migration. The new `liquidaciones.rendicion_id` FK is nullable,
-- so existing rows (and the current per-contract email flow) stay valid
-- until the application code is updated to opt them into rendiciones.
-- Idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- ── 1. rendiciones — one row per (landlord, period) aggregating N contracts
create table if not exists rendiciones (
  id                 uuid primary key default gen_random_uuid(),
  administration_id  uuid not null references administrations(id) on delete cascade,
  landlord_id        uuid not null references landlords(id) on delete restrict,
  period             date not null,

  -- Totals across every child liquidación. Computed at send-time so the
  -- receipt PDF is reproducible.
  total_gross        numeric(14,2) not null default 0,
  total_deductions   numeric(14,2) not null default 0,
  total_neto         numeric(14,2) not null default 0,

  -- Same status lifecycle as liquidaciones: draft → sent → paid
  status             text not null default 'draft' check (status in ('draft','sent','paid')),
  sent_at            timestamptz,
  paid_at            timestamptz,

  -- Generated PDF (Supabase Storage) + free-text encargada notes
  pdf_url            text,
  notes              text,

  created_at         timestamptz not null default now(),

  -- One rendición per landlord per period. If the landlord owns multiple
  -- contracts that fall in the same month, they all roll under this one row.
  unique (landlord_id, period)
);
create index if not exists idx_rendiciones_admin
  on rendiciones (administration_id);
create index if not exists idx_rendiciones_landlord_period
  on rendiciones (landlord_id, period desc);
create index if not exists idx_rendiciones_status
  on rendiciones (status);

-- ── 2. liquidaciones.rendicion_id — opt-in link to a parent rendición ────
-- Nullable so the existing per-contract-per-landlord email flow continues
-- to work for the single-contract case. When the email generator detects
-- "this landlord has N liquidaciones for this period", it creates a parent
-- rendición and sets this FK on all the children.
alter table liquidaciones
  add column if not exists rendicion_id uuid references rendiciones(id) on delete set null;
create index if not exists idx_liquidaciones_rendicion
  on liquidaciones (rendicion_id);

-- ── 3. liquidacion_payouts — per-landlord split for the receipt footer ──
-- For a contract owned 50/50 by JUAN + ADRIAN, one liquidación produces TWO
-- payout rows. The receipt's "JUAN $X / ADRIAN $Y" lines read directly from
-- here. Persisting prevents re-deriving the split from ownership_pct later,
-- which could disagree after rounding (5 cent drift = receipt reprint bug).
create table if not exists liquidacion_payouts (
  liquidacion_id  uuid          not null references liquidaciones(id) on delete cascade,
  landlord_id     uuid          not null references landlords(id) on delete restrict,
  amount          numeric(14,2) not null,
  primary key (liquidacion_id, landlord_id)
);
create index if not exists idx_liquidacion_payouts_landlord
  on liquidacion_payouts (landlord_id);

-- ── Reload schema cache for PostgREST ─────────────────────────────────────
notify pgrst, 'reload schema';

-- ── Sanity check ──────────────────────────────────────────────────────────
select
  (select count(*) from rendiciones)         as rendicion_rows,
  (select count(*) from liquidacion_payouts) as payout_rows,
  (select count(*) from information_schema.columns
     where table_name='liquidaciones' and column_name='rendicion_id') as liq_has_rendicion_fk;
