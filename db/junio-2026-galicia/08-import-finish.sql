-- FINISH: 2 contratos que existen en DB pero estan guardados bajo el nombre del
-- PROPIETARIO (por eso el match por apellido del inquilino fallaba). Confirmados por
-- VIGENCIA + IMPORTE exactos contra la hoja. Ambos plain (sin IVA), reconcilian.

-- PEREZ FRANCISCO [102b4657] == hoja "OTERO WALSH CAMILA"
--   alquiler 2.923.667, vig 2025-03-01..2028-02-28 (identicos), comision 8%
update contracts set commission_pct = 8, commission_includes_iva = false
 where id = '102b4657-dfbd-473d-bbe5-28707bc726b4';
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','102b4657-dfbd-473d-bbe5-28707bc726b4','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',2923667,'2026-06-11','Alquiler Junio - OTERO WALSH CAMILA'),
('7257451b-83aa-4767-9472-25926d563bf5','102b4657-dfbd-473d-bbe5-28707bc726b4','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',233893.36,'2026-06-11','Comision 8% sobre total cobrado - ADM_GALICIA'),
('7257451b-83aa-4767-9472-25926d563bf5','102b4657-dfbd-473d-bbe5-28707bc726b4','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',2689773.64,'2026-06-11','Transferencia a propietario Junio');

-- QUINTAS [9d5705ee] == hoja "(EX CASTELLANI) ... QUINTAS COMERCIAL"
--   alquiler 858.582, vig 2026-03-01..2028-02-28 (identicos), comision 9%
--   NOTA: la hoja trae fecha de ingreso "8-sept" (anomala); se usa la fecha de
--   transferencia 09/06 como fecha de banco. Confirmar con Alejandro.
update contracts set commission_pct = 9, commission_includes_iva = false
 where id = '9d5705ee-0272-48e0-88fb-51468518561c';
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','9d5705ee-0272-48e0-88fb-51468518561c','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',858582.43,'2026-06-09','Alquiler Junio - QUINTAS (ex Castellani)'),
('7257451b-83aa-4767-9472-25926d563bf5','9d5705ee-0272-48e0-88fb-51468518561c','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',77272.42,'2026-06-09','Comision 9% sobre total cobrado - ADM_GALICIA'),
('7257451b-83aa-4767-9472-25926d563bf5','9d5705ee-0272-48e0-88fb-51468518561c','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',781310.01,'2026-06-09','Transferencia a propietario Junio');
