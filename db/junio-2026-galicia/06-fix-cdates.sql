-- FIX 2 (fechas): corregir vigencia de 3 contratos verificados uno por uno contra
-- la hoja (columna CONTRATO), emparejados por nombre EXACTO + alquiler, no por
-- coincidencia de apellido. Solo estos 3 son inequivocos.

-- BRUGGER MIGUEL (alq 960.000): en DB figura vencido 2024-04..2026-03; la hoja
-- muestra la renovacion 01/04/2026 - 31/04/2028 (dia 31 invalido -> 30).
update contracts set start_date = '2026-04-01', end_date = '2028-04-30'
 where id = 'c6382ee8-9842-4ce7-a2b0-6d5526ff1da4';

-- BARTL/COMERCIAL (alq 613.600): en DB tenia fechas placeholder 2024-01-01..2027-12-31.
update contracts set start_date = '2025-12-01', end_date = '2027-11-30'
 where id = 'e5107e7f-d7a9-459a-b0af-9e343c37fb31';

-- LINARES ANA (alq 3.100.000): en DB tenia fechas placeholder 2024-01-01..2027-12-31.
update contracts set start_date = '2026-05-01', end_date = '2028-04-30'
 where id = '34ed85b0-d757-4939-af09-1fa82fee5cdb';
