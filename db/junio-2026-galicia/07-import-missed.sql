-- Import Junio para 2 contratos existentes que el matcher no cargo (por tolerancia de alquiler)
insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
('7257451b-83aa-4767-9472-25926d563bf5','ea141636-72fa-40d2-8854-68b9dfbd9537','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',1164162,'2026-05-30','Alquiler Junio - GUSTAVO FERNANDEZ'),
('7257451b-83aa-4767-9472-25926d563bf5','ea141636-72fa-40d2-8854-68b9dfbd9537','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',81491.34,'2026-05-30','Comision 7% sobre total cobrado - ADM_GALICIA'),
('7257451b-83aa-4767-9472-25926d563bf5','ea141636-72fa-40d2-8854-68b9dfbd9537','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',1082670.66,'2026-06-03','Transferencia a propietario Junio'),
('7257451b-83aa-4767-9472-25926d563bf5','df4b05da-4fe7-4e2a-a55b-d7445155d63d','892ca2ee-4b24-4b5b-9ee0-8b26ff02df70','2026-06-01',600000,'2026-06-11','Alquiler Junio - ALVAREZ/SOLOAGA'),
('7257451b-83aa-4767-9472-25926d563bf5','df4b05da-4fe7-4e2a-a55b-d7445155d63d','f012c9a4-42a7-4977-9c36-45a18291c88d','2026-06-01',48000,'2026-06-11','Comision 8% sobre total cobrado - ADM_GALICIA'),
('7257451b-83aa-4767-9472-25926d563bf5','df4b05da-4fe7-4e2a-a55b-d7445155d63d','11126c5d-0799-4da4-830d-f604d128951e','2026-06-01',552000,'2026-06-12','Transferencia a propietario Junio');