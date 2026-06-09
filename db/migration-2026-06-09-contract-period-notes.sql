-- ============================================================================
-- Migration: add contract_period_notes (2026-06-09)
-- ============================================================================
-- ADDITIVE migration. Creates a per-contract per-period free-text scratchpad
-- to replicate Alejandro's "DEUDA Y/U OBSERVACIONES" column in his ledger.
--
-- His spreadsheet pattern (from analysis of 228 rows / 43 multi-line cells):
--   line 1: current month's expected rent value
--           e.g. "ALQUILER A PARTIR DE MARZO $1.300.000"
--   line 2+: one-off notes — THU bills, deposit recoveries, accountant
--            remarks, renewal honorarios pending, etc.
--
-- These notes are per (contract × period) — same contract gets a fresh note
-- each month. Free text on purpose: it's a scratchpad, not structured data.
--
-- Safe to run multiple times.
-- ============================================================================

create table if not exists contract_period_notes (
  contract_id uuid        not null references contracts(id) on delete cascade,
  period      date        not null,                  -- first-of-month, e.g. 2026-05-01
  body        text        not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  text,                                  -- email of editor, or null
  primary key (contract_id, period)
);

create index if not exists idx_contract_period_notes_period
  on contract_period_notes(period);

alter table contract_period_notes disable row level security;

-- Sanity check
select
  (select count(*) from contract_period_notes) as rows;
