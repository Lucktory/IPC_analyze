-- ============================================================================
-- Migration 2026-07-06 - Two-part commercial rent (facturado + N/F)
--
-- Some commercial contracts bill the rent in two fractions:
--   * facturado  (black in the encargada's Excel) - issued with factura;
--                carries 21% IVA when the landlord is RI, 0% when Monotributo
--                (Factura C).
--   * no facturado / N/F (violet) - real rent paid WITHOUT an invoice.
--
-- Both parts are owed to the landlord AND the administracion (8-9%) is charged
-- on both. The IPC aumento scales each part independently.
--
-- This migration only adds the STRUCTURE (columns + a new income line type).
-- It changes no behavior on its own; the per-contract values are loaded and
-- the liquidacion is wired in the follow-up steps.
-- ============================================================================

-- 1. Contract-level breakdown. NULL rent_facturado_neto = ordinary contract
--    (no N/F split); rent_no_facturado defaults to 0 so additive logic is a
--    no-op everywhere it is 0.
alter table contracts
  add column if not exists rent_facturado_neto numeric(14,2);
alter table contracts
  add column if not exists rent_no_facturado   numeric(14,2) not null default 0;

comment on column contracts.rent_facturado_neto is
  'Net facturado rent (pre-IVA). NULL = contract has no facturado/N-F split. '
  'IVA is derived via rent_iva_rate; facturado con IVA = neto * (1 + rate/100).';
comment on column contracts.rent_no_facturado is
  'No-facturado (N/F) rent fraction, paid without invoice. 0 = none. '
  'When the split is used, current_rent holds the full total '
  '(facturado con IVA + N/F).';

-- 2. New income line type for the N/F fraction - the "renglon mas" the office
--    records each period. affects_liquidacion=true so it sums into ingresos,
--    feeds the transferencia to the landlord, and the COMMISSION_OUT the
--    encargada records covers it.
insert into transaction_types (code, label, direction, category, affects_liquidacion)
values ('RENT_NF_IN', 'Alquiler s/factura (N/F)', 'IN', 'rent', true)
on conflict (code) do nothing;
