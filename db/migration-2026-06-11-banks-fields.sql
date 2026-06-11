-- ============================================================================
-- Migration: extend banks table with operational fields (2026-06-11)
-- ============================================================================
-- The banks master list was display-only (just name + short_code). Adding
-- the fields the encargada actually needs to track:
--   • monthly maintenance fee
--   • transfer fee (%) and (fixed)
--   • commercial contact (name / phone / email)
--   • free-text notes
--
-- ADDITIVE migration. All columns nullable. Idempotent. Safe to re-run.
-- ============================================================================

alter table banks
  add column if not exists monthly_fee        numeric(12,2),
  add column if not exists transfer_fee_pct   numeric(5,2),
  add column if not exists transfer_fee_fixed numeric(12,2),
  add column if not exists contact_name       text,
  add column if not exists contact_phone      text,
  add column if not exists contact_email      text,
  add column if not exists notes              text;

-- Sanity check
select column_name, data_type
from information_schema.columns
where table_name = 'banks'
order by ordinal_position;
