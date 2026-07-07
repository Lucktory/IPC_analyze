-- ============================================================================
-- 2026-07-06c - Normalize the 10 N/F contracts so current_rent = full TOTAL.
--
-- Run this AFTER deploying the liquidacion wiring (RENT_NF_IN). It:
--   * turns on commercial IVA per contract (21 for RI, 0 for Monotributo),
--   * sets current_rent = facturado con IVA + N/F, so deuda + the Alquiler
--     column reflect the whole rent.
--
-- EXPECTED SIDE EFFECT: once current_rent = total, a contract shows the N/F
-- fraction as pending deuda until the encargada records its RENT_NF_IN cobro
-- for the period. That is correct (it flags the N/F that must be recorded),
-- not a bug.
--
-- NOTE: the facturado/N-F amounts are still the MARCH snapshot for the
-- contracts that adjusted in June (e.g. Mansilla). Refresh those to the
-- current July values in the accuracy pass; this only changes the shape.
-- ============================================================================

-- RI / commercial: facturado carries 21% IVA.
update contracts
   set is_commercial = true,
       rent_iva_rate = 21,
       current_rent  = round(rent_facturado_neto * 1.21 + rent_no_facturado, 2)
 where contract_number in
   ('C-2024-0017','C-2025-0030','C-2025-0042','C-2026-0007',
    'C-2026-0009','C-2026-0011','C-2026-0004','C-2026-0001');

-- Monotributo / Factura C: no IVA on the facturado part.
update contracts
   set is_commercial = true,
       rent_iva_rate = 0,
       current_rent  = round(rent_facturado_neto + rent_no_facturado, 2)
 where contract_number in ('C-2025-0035','C-2025-0037');

-- Check the resulting totals.
select contract_number, rent_facturado_neto, rent_iva_rate, rent_no_facturado, current_rent
from contracts
where contract_number in
  ('C-2024-0017','C-2025-0030','C-2025-0042','C-2026-0007','C-2026-0009',
   'C-2026-0011','C-2025-0035','C-2026-0004','C-2025-0037','C-2026-0001')
order by contract_number;
