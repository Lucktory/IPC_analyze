-- ============================================================================
-- 2026-07-06b - Load the two-part rent values for the 10 N/F contracts.
--
-- IMPORTANT / SAFE BY DESIGN: this only fills the two NEW columns
-- (rent_facturado_neto, rent_no_facturado). It does NOT touch current_rent,
-- is_commercial or rent_iva_rate, so it changes ZERO existing numbers and
-- cannot alter any current liquidacion. Those fields + current_rent -> total
-- are set in the next step (liquidacion wiring), once verified.
--
-- Values transcribed from client-data/alejandro-sheet.csv (a MARCH-era
-- snapshot). Three items need the office to confirm against the CURRENT
-- (July) planilla before go-live -- see FLAGs. Correcting a value later is a
-- one-line UPDATE.
-- ============================================================================

-- ESQUINA S.A group (facturado carries 21% IVA) ------------------------------
-- FLAG: Falletti/Tamburini - sheet says facturado c/IVA 693.985,80 but
--       neto 573.294,05 x 1,21 = 693.685,80 (300 gap). Confirm the neto.
update contracts set rent_facturado_neto = 573294.05, rent_no_facturado = 573294.05 where contract_number = 'C-2024-0017'; -- Falletti/Tamburini
update contracts set rent_facturado_neto = 530072.57, rent_no_facturado = 766251.55 where contract_number = 'C-2025-0030'; -- Simeoni
update contracts set rent_facturado_neto = 379490.06, rent_no_facturado = 650554.38 where contract_number = 'C-2025-0042'; -- Kochowicz
update contracts set rent_facturado_neto = 1400000.00, rent_no_facturado = 1400000.00 where contract_number = 'C-2026-0007'; -- Falletti Carlos
update contracts set rent_facturado_neto = 650000.00, rent_no_facturado = 650000.00 where contract_number = 'C-2026-0009'; -- Quintas
-- FLAG: Mansilla - these are MARCH figures (neto 700.000). The current JULY
--       value is neto 764.154,75 / N/F 764.154,75 (from Alejandro's example).
--       Update before go-live.
update contracts set rent_facturado_neto = 700000.00, rent_no_facturado = 700000.00 where contract_number = 'C-2026-0011'; -- Mansilla

-- TOME ZULLY group -----------------------------------------------------------
update contracts set rent_facturado_neto = 407865.67, rent_no_facturado = 582665.24 where contract_number = 'C-2025-0035'; -- Aranda/Calculef (Monotributo, IVA 0)
update contracts set rent_facturado_neto = 497655.27, rent_no_facturado = 602162.88 where contract_number = 'C-2026-0004'; -- Multimarcas (IVA 21)

-- Others ---------------------------------------------------------------------
-- FLAG: Ojeda/Cardenas - sheet total 1.554.929,62 but facturado + N/F =
--       1.514.929,62 (40.000 gap). Confirm which figure is right.
update contracts set rent_facturado_neto = 757464.81, rent_no_facturado = 757464.81 where contract_number = 'C-2025-0037'; -- Ojeda/Cardenas (Monotributo, IVA 0)
update contracts set rent_facturado_neto = 299334.35, rent_no_facturado = 299334.35 where contract_number = 'C-2026-0001'; -- Jimenez (current_rent already = total)

-- Eyeball the result -------------------------------------------------------
select contract_number, current_rent, rent_facturado_neto, rent_no_facturado
from contracts
where contract_number in
  ('C-2024-0017','C-2025-0030','C-2025-0042','C-2026-0007','C-2026-0009',
   'C-2026-0011','C-2025-0035','C-2026-0004','C-2025-0037','C-2026-0001')
order by contract_number;
