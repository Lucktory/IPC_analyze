-- ============================================================================
-- 2026-06-16 — Labeled "recupero" inflow transaction types
--
-- Phase 6 of Alejandro's June-16 spec ("celdas dinámicas"): the Ingresos
-- cell on the planilla needs to expose the components the tenant paid
-- (alquiler + ABL + gas + …). Today the only labeled IN type for
-- recuperos is the generic UTILITY_REFUND_IN; everything else falls
-- through to OTHER_IN, which makes the breakdown dropdown unhelpful.
--
-- Adds five clear, self-documenting recupero codes — one per common
-- service the encargada reimburses through the rent.
--
-- All affect_liquidacion = true (they're cash the tenant deposited and
-- they contribute to gross cobrado on the liquidación), all IN direction,
-- category = 'refund' so reports group them together.
--
-- Idempotent: ON CONFLICT (code) DO NOTHING.
-- ============================================================================

insert into transaction_types (code, label, direction, category, affects_liquidacion) values
  ('RECUPERO_ABL_IN',      'Recupero ABL',             'IN', 'refund', true),
  ('RECUPERO_AYSA_IN',     'Recupero AySA',            'IN', 'refund', true),
  ('RECUPERO_METROGAS_IN', 'Recupero Metrogas / Gas',  'IN', 'refund', true),
  ('RECUPERO_EDESUR_IN',   'Recupero Edesur / Luz',    'IN', 'refund', true),
  ('RECUPERO_OTRO_IN',     'Recupero otro servicio',   'IN', 'refund', true)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
