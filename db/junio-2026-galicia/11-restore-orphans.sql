-- restore_orphans.sql: reponer el Junio de REARTE y GOMEZ CID que fix_amounts.sql
-- habia borrado. El usuario pidio NO borrarlos. Valores originales; reconcilian
-- internamente (recibo = transferencia); se conserva el destino de comision real
-- (ADM_FRANCES). Descripciones en ASCII.

-- REARTE LEANDRO [fa99ed2c]  alq 423.355, comision 8% (ADM_FRANCES_51_6), transf 389.487
update contracts set commission_pct = 8, commission_includes_iva = false
 where id = 'fa99ed2c-ba0e-411e-a57e-d5f86c08413e';
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','fa99ed2c-ba0e-411e-a57e-d5f86c08413e','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',423355,'2026-05-27','Alquiler Junio - REARTE LEANDRO'),
('7257451b-83aa-4767-9472-25926d563bf5','fa99ed2c-ba0e-411e-a57e-d5f86c08413e','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',33868,'2026-05-27','Comision 8% sobre total cobrado - ADM_FRANCES_51_6'),
('7257451b-83aa-4767-9472-25926d563bf5','fa99ed2c-ba0e-411e-a57e-d5f86c08413e','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',389487,'2026-05-27','Transferencia a propietario Junio');

-- GOMEZ CID MANUEL JESUS [9cee1b49]  alq 1.204.326, comision 10% (ADM_FRANCES_50_9), transf 1.083.893
update contracts set commission_pct = 10, commission_includes_iva = false
 where id = '9cee1b49-cdac-4ba1-878f-b0b8b3be638c';
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','9cee1b49-cdac-4ba1-878f-b0b8b3be638c','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',1204326,'2026-06-10','Alquiler Junio - GOMEZ CID MANUEL JESUS'),
('7257451b-83aa-4767-9472-25926d563bf5','9cee1b49-cdac-4ba1-878f-b0b8b3be638c','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',120433,'2026-06-10','Comision 10% sobre total cobrado - ADM_FRANCES_50_9'),
('7257451b-83aa-4767-9472-25926d563bf5','9cee1b49-cdac-4ba1-878f-b0b8b3be638c','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',1083893,'2026-06-10','Transferencia a propietario Junio');
