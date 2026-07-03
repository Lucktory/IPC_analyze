-- fix_amounts.sql: alinear DB con la hoja de Junio (importes exactos)

-- BARTL [e5107e7f]: reconstruir Junio con valores exactos de la hoja (ing=614000 6%)
update contracts set commission_pct = 6, commission_includes_iva = false where id = 'e5107e7f-d7a9-459a-b0af-9e343c37fb31';
delete from transactions where administration_id = '7257451b-83aa-4767-9472-25926d563bf5' and contract_id = 'e5107e7f-d7a9-459a-b0af-9e343c37fb31' and period = '2026-06-01';
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','e5107e7f-d7a9-459a-b0af-9e343c37fb31','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',614000,'2026-06-10','Alquiler Junio - BARTL/COMERCIAL--COMERCIAL'),
('7257451b-83aa-4767-9472-25926d563bf5','e5107e7f-d7a9-459a-b0af-9e343c37fb31','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',36840,'2026-06-10','Comision 6% sobre total cobrado - ADM_GALICIA'),
('7257451b-83aa-4767-9472-25926d563bf5','e5107e7f-d7a9-459a-b0af-9e343c37fb31','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',577160,'2026-06-10','Transferencia a propietario Junio');

-- LOURENCO|PEREA [a6b1138c]: reconstruir Junio con valores exactos de la hoja (ing=305000 10%)
update contracts set commission_pct = 10, commission_includes_iva = false where id = 'a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a';
delete from transactions where administration_id = '7257451b-83aa-4767-9472-25926d563bf5' and contract_id = 'a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a' and period = '2026-06-01';
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',305000,'2026-06-05','Alquiler Junio - LOURENCO'),
('7257451b-83aa-4767-9472-25926d563bf5','a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',30500,'2026-06-05','Comision 10% sobre total cobrado - ADM_GALICIA'),
('7257451b-83aa-4767-9472-25926d563bf5','a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a','718f095e-e73f-465d-8dcd-5ebc1d0663ac','2026-06-01',26000,'2026-06-05','Otros deducciones 06/2026'),
('7257451b-83aa-4767-9472-25926d563bf5','a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',248500,'2026-06-05','Transferencia a propietario Junio');

-- REARTE [fa99ed2c] y GOMEZ CID [9cee1b49]: la hoja de Junio muestra 0 -> quitar el Junio cargado
-- (datos provenientes de un import viejo con etiqueta ADM_FRANCES, no coinciden con la hoja GALICIA)
delete from transactions where administration_id = '7257451b-83aa-4767-9472-25926d563bf5' and contract_id = 'fa99ed2c-ba0e-411e-a57e-d5f86c08413e' and period = '2026-06-01';
delete from transactions where administration_id = '7257451b-83aa-4767-9472-25926d563bf5' and contract_id = '9cee1b49-cdac-4ba1-878f-b0b8b3be638c' and period = '2026-06-01';
