-- ============================================================================
-- Migration: landlords.alt_emails (2026-06-17 — Phase 11)
-- ============================================================================
-- Some landlords keep more than one email on file (LODDO ALBERTO,
-- NEYERTZ AMELIA, ESQUINA 4 in Alejandro's current list — each with two
-- addresses separated by " | " or " / "). landlords.email is single-valued;
-- the second address was getting stashed into landlords.notes which is
-- fragile (typos, gets edited away, etc.).
--
-- This column holds zero or more SECONDARY email addresses. Primary stays
-- in landlords.email. When the "Liquidar y enviar" button picks a
-- recipient list, it can fan out to email + alt_emails based on the
-- encargada's selection (matches the saved communication-model rule:
-- automate the drafting, never the decision).
--
-- ADDITIVE migration. Idempotent. Existing rows get the default empty
-- array — no data lost, no application code needs to change.
-- ============================================================================

alter table landlords
  add column if not exists alt_emails text[] not null default '{}';

-- Tell PostgREST to pick up the new column immediately.
notify pgrst, 'reload schema';

-- Sanity check
select
  (select count(*) from landlords)                             as total_landlords,
  (select count(*) from landlords where array_length(alt_emails, 1) > 0) as with_alt_emails;
