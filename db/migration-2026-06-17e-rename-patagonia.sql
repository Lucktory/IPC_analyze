-- ============================================================================
-- Migration: rename "Pampa Administración" → "Patagonia Propiedades" (2026-06-17)
-- ============================================================================
-- Per Alejandro's 2026-06-17 voice message:
--
--   "Logo de la inmobiliaria es Patagonia Propiedades"
--
-- The seed in db/schema.sql created the administration row with the
-- placeholder name "Pampa Administración SRL". The receipts he sent
-- (ALVAREZ / VILLAREAL / SIMOES) all show the real agency:
--
--   • Name:     Patagonia Propiedades
--   • Address:  Mitre 674, (9000) Comodoro Rivadavia - Chubut
--   • Phone:    (0297) 444-4862 / 4441695
--   • Email:    patagoniainmo@gmail.com
--
-- This migration UPDATEs the existing row in place rather than dropping
-- and recreating, so all foreign keys (administrators, landlords, tenants,
-- contracts, transactions, …) remain valid. Nothing else needs to change.
--
-- IDEMPOTENT: only updates when the current name matches the placeholder.
-- Safe to re-run; safe if the name has already been changed by hand.
-- ============================================================================

update administrations
   set name       = 'Patagonia Propiedades',
       legal_name = 'Patagonia Propiedades',
       address    = 'Mitre 674, (9000) Comodoro Rivadavia - Chubut',
       phone      = '(0297) 444-4862 / 4441695',
       email      = 'patagoniainmo@gmail.com'
 where name in ('Pampa Administración', 'Pampa Administración SRL', 'Patagonia Propiedades');
-- The third value is included so re-running the migration after a partial
-- success still settles the remaining fields (address / phone / email)
-- that may not have been set by a prior manual rename.

-- ── Sanity check — confirm the row exists and is renamed ────────────────
select
  (select count(*) from administrations
     where name = 'Patagonia Propiedades') as patagonia_rows,
  (select count(*) from administrations
     where name in ('Pampa Administración','Pampa Administración SRL')) as legacy_rows;
