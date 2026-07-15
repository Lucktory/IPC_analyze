-- ============================================================================
-- 2026-07-15 - SCPL + Coagua recupero (service) types
--
-- Alejandro's properties are served by local cooperatives, not the AMBA
-- providers already seeded (Edesur / AySA / Metrogas). Two providers were
-- missing from the Servicios (recupero) list:
--   * SCPL  (Sociedad Cooperativa Popular Limitada) - bills luz + agua together
--   * Coagua (cooperativa de agua)                  - bills agua
--
-- Same shape as the 2026-06-16 recupero types: IN / category 'refund' /
-- affects_liquidacion = true, so they group with the other recuperos and count
-- toward gross cobrado. Adding types changes NOTHING for existing contracts.
--
-- Idempotent: ON CONFLICT (code) DO NOTHING.
-- ============================================================================

insert into transaction_types (code, label, direction, category, affects_liquidacion) values
  ('RECUPERO_SCPL_IN',   'Recupero SCPL (luz/agua)', 'IN', 'refund', true),
  ('RECUPERO_COAGUA_IN', 'Recupero Coagua (agua)',   'IN', 'refund', true)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
