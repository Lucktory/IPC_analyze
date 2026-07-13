-- Julio 2026 — backfill contracts.commission_destination + commission_pct.
-- Step 1: carry each contract's JUNE destination bank forward as the default.
-- Step 2: override with the July CTA 50/9 & 51/6 sheets (CLEAN name matches only).
-- Ambiguous / unmatched rows are NOT written here — see the review list.
-- REQUIRES db/julio-2026/01-commission-destination-column.sql first.

-- Step 1: June defaults (89 contracts)
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '144af4ab-9808-44f8-8387-686596ec07e7';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '8bf19f24-faa6-4ccc-ba93-6eded52ddd13';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '59d2e4b8-71ab-4ef8-a19f-5cfb01485167';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '8a19fd52-bb31-4879-82a1-abc03e20ae16';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '2968a898-2ad1-4750-ae19-c2fb96ecfdb4';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'a32907a6-32f3-4dfd-852f-a10e57792101';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '1809c8ba-6ed5-4452-8ed2-b296fa68c121';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '4e0bf9c9-e44a-4988-93ce-376489bc7c8a';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'e3dbf848-83d9-4317-bfe8-72860fac1ae8';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '029fa396-5378-45b7-bc9d-2f72ec09992f';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '34ed85b0-d757-4939-af09-1fa82fee5cdb';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'bc871f1a-f170-46f3-a25f-8e4d221207c2';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '2451ec5b-9393-4876-94a4-03288917d7fa';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '42cce6b2-301c-4275-a6d2-71ce8076f19e';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'c556a06e-abec-42fe-9fd2-085a44569f18';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '2d2c0568-d2a2-4325-aee4-baa9e8e52344';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'a87c3ac5-6031-4b7c-ae45-3a0a08a058b2';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'db1e62b9-bcd4-4b0c-b7ce-d8bb982edad1';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '312a256e-303c-4370-be4d-8cac5034557e';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '376cccf9-8ca4-4da4-8f65-ff1a4b7bcc07';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'c6382ee8-9842-4ce7-a2b0-6d5526ff1da4';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'd859a3d2-896e-4d46-82de-c3aac870eea8';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'e82409bc-261b-48ff-980b-3d478b864c94';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '15fc17bc-51f0-4adb-bf51-efece807356f';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '4b7c97ea-dbfd-46c3-8965-41268124314f';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '5188a0d0-a939-4649-b6c2-a05c73eaf7c8';
update contracts set commission_destination = 'ADM_GALICIA' where id = '6af0f29d-2a4f-40ab-84de-7a3693f60198';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '7911b11f-b1d6-4504-a02a-5ac07a3025a7';
update contracts set commission_destination = 'ADM_GALICIA' where id = '00a8215d-a628-4a54-b117-b540813514d1';
update contracts set commission_destination = 'ADM_GALICIA' where id = '3de97f12-6db4-48c0-a9f8-83d477f0fdf7';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'cfef854c-9008-4e6e-9760-f99b49af60e1';
update contracts set commission_destination = 'ADM_GALICIA' where id = '01c01942-9ed2-4ea3-9c89-1dcd20b1820f';
update contracts set commission_destination = 'ADM_GALICIA' where id = '9c895ea5-fcc5-4153-aa1d-c9f78eed9e46';
update contracts set commission_destination = 'ADM_GALICIA' where id = '29231147-9195-4b14-a607-83be17bf9457';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'dee5f24b-4525-4440-9790-4d0e8af98921';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'e5107e7f-d7a9-459a-b0af-9e343c37fb31';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'ac7d6400-8caa-42ab-9db6-ae35fcf82715';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'd638f27d-cfb6-4887-953e-1fa1ae44757f';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '8af110b7-3be5-46bd-8766-0d10fba5149b';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '02d1387a-b990-405f-9975-5c49ef55b85e';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'a8fe0a97-5e0e-4342-a96b-de120c306da8';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '776cd371-22ef-4716-9219-4a34560a21dc';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'e612972c-6043-42d1-8cf7-c03d6cd5af28';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '16f310fc-5049-4230-b000-5c99dae16bd1';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '761b386c-9d20-41ea-9bcb-c5016b28979a';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '9da5a7aa-17b8-40aa-bf5c-7cfba8de119e';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '40f73a5e-bfe7-4825-ae34-c6be071d3aed';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'bf3304d9-cd3d-486d-95e8-1b1eadb6fd6a';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '05a5f7de-ba3f-4e39-b81e-f5c9ecf67b8d';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'c26509e2-06ee-4a58-9570-886b70de31d6';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '10b149d1-da43-452d-a9b0-47a13a8729a5';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'b44b2af2-0c9c-4b70-ad6b-e7d37f828851';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '885d6b9c-1bd9-4720-b234-8e209947ba0b';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'bc92c0d3-72d7-4084-a05e-d91478ab0709';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'ea141636-72fa-40d2-8854-68b9dfbd9537';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'df4b05da-4fe7-4e2a-a55b-d7445155d63d';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '9c2e6a86-1da0-41ec-887b-97b423bfa9ae';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'd2183f98-70a9-4cca-a99c-c6012984f0dd';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'd3cccd06-a4ed-4783-b064-c99b663f6cf3';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '41bcd05e-5d3e-48b8-babd-69407dc5f239';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '0a990dd4-c9d6-4c08-abfe-ac6f1a25ff84';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '6397b3d9-7a84-4e36-974a-2305a992fb52';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'ab0fc70f-494d-4354-a064-e0cff8bf0145';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '547efb48-7dd0-443c-b484-7a8108c3f040';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '91274a38-d327-4b13-b022-01ef84b2e6f1';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '78a5f6c2-2676-428a-be1a-591d24b84b6a';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '3cce41be-74fc-4ed9-a86f-c1fe8e3f4645';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'a8f57225-d779-4179-b7e6-c1764017b80f';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'e4e19bc8-479d-4399-adb5-9f2e2a686dc5';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '102b4657-dfbd-473d-bbe5-28707bc726b4';
update contracts set commission_destination = 'ADM_GALICIA' where id = '9d5705ee-0272-48e0-88fb-51468518561c';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '45b03e3e-c131-4700-97e4-973c3ad4a4f7';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '8eff6db2-e14a-448b-baf7-be09fc2d6857';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'c1be7993-f4bd-46ac-8d96-f9920da5936d';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'bcb39ab2-5c31-489c-9b56-60e969295153';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'c2476860-1f9b-46d8-b787-1b473b628b1d';
update contracts set commission_destination = 'ADM_GALICIA' where id = '43440c40-8dbf-4e28-a7a9-5f6d0a88249c';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '2874e057-7f98-4388-b457-2ae398f0f20d';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '09f3c4e4-dcd9-4530-abc5-338317b37a80';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'dff33483-869b-477d-93e9-84f5d979ff62';
update contracts set commission_destination = 'ADM_GALICIA' where id = '1848e0e5-965b-4c44-b4b2-6ac23fbfb0c9';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'f698938f-3aaf-4e29-8f8b-50d9e1c16c6d';
update contracts set commission_destination = 'ADM_GALICIA' where id = '6a00c96d-3adb-498c-9c58-fb3688de39a9';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'd03b72ce-1030-4a2b-bda9-05f9f1665b49';
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = 'd72445ad-1877-47ad-9f35-82e18e6d68d7';
update contracts set commission_destination = 'ADM_GALICIA' where id = 'ce67b249-a879-421a-bb73-02512bdc67c5';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'dba282e8-2f33-48c8-8beb-3abd0f75c000';
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = 'fc79235d-4df9-4cd5-b724-f5f7175932dc';

-- Step 2: July overrides (CLEAN matches: 74)
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = 'd3cccd06-a4ed-4783-b064-c99b663f6cf3';  -- C-2025-0031 TUDESCO MAURO 0000003100033533
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '102b4657-dfbd-473d-bbe5-28707bc726b4';  -- C-2025-0009 PEREZ FRANCISCO
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '41bcd05e-5d3e-48b8-babd-69407dc5f239';  -- C-2025-0006 LOPEZ VERONICA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = 'ea141636-72fa-40d2-8854-68b9dfbd9537';  -- C-2025-0026 FERNANDEZ // COMERCIAL
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '3cce41be-74fc-4ed9-a86f-c1fe8e3f4645';  -- C-2023-0001 MARTINEZ SOLEDAD
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '6397b3d9-7a84-4e36-974a-2305a992fb52';  -- C-2024-0035 MUJICA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '78a5f6c2-2676-428a-be1a-591d24b84b6a';  -- C-2025-0024 HERNANDEZ ORIANA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '91274a38-d327-4b13-b022-01ef84b2e6f1';  -- C-2024-0027 TASSIN MARIELA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '0a990dd4-c9d6-4c08-abfe-ac6f1a25ff84';  -- C-2024-0002 TEIXIDO/E.PERRONE
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = 'ab0fc70f-494d-4354-a064-e0cff8bf0145';  -- C-2026-0010 OSSES CAROLINA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '8eff6db2-e14a-448b-baf7-be09fc2d6857';  -- C-2025-0045 TULA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '45b03e3e-c131-4700-97e4-973c3ad4a4f7';  -- C-2025-0027 LUDUEÑA MICAELA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = 'c1be7993-f4bd-46ac-8d96-f9920da5936d';  -- C-2024-0015 HERRERA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = 'c2476860-1f9b-46d8-b787-1b473b628b1d';  -- C-2024-0016 CAVANNA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = 'e612972c-6043-42d1-8cf7-c03d6cd5af28';  -- C-2024-0018 RUARTE
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '2874e057-7f98-4388-b457-2ae398f0f20d';  -- C-2025-0010 GONZALEZ FRANCO
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '09f3c4e4-dcd9-4530-abc5-338317b37a80';  -- C-2026-0002 NORVAL
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 10 where id = 'd72445ad-1877-47ad-9f35-82e18e6d68d7';  -- C-2025-0033 VILLAREAL
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = 'df4b05da-4fe7-4e2a-a55b-d7445155d63d';  -- C-2024-0012 ALVAREZ SOLOAGA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 10 where id = 'bc871f1a-f170-46f3-a25f-8e4d221207c2';  -- C-2024-0004 SANCHEZ ROCIO / AGRICOLA GONZA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '8a19fd52-bb31-4879-82a1-abc03e20ae16';  -- C-2024-0036 IBARRA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '34ed85b0-d757-4939-af09-1fa82fee5cdb';  -- C-2026-0013 LINARES
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = 'fa99ed2c-ba0e-411e-a57e-d5f86c08413e';  -- C-2024-0019 REARTE
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '1ba934b6-142d-4015-b9d5-9df39ba82e84';  -- C-2024-0009 DEOMOJAN
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 7 where id = '5188a0d0-a939-4649-b6c2-a05c73eaf7c8';  -- C-2026-0015 GONZALEZ ESCUDERO FLORENCIA AB
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 8 where id = '2d2c0568-d2a2-4325-aee4-baa9e8e52344';  -- C-2025-0001 LECUMBERRI MIGUEL ANGEL
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 9 where id = 'a87c3ac5-6031-4b7c-ae45-3a0a08a058b2';  -- C-2024-0028 GARIS
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 10 where id = 'e82409bc-261b-48ff-980b-3d478b864c94';  -- C-2024-0033 ALVAREZ
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 10 where id = '15fc17bc-51f0-4adb-bf51-efece807356f';  -- C-2024-0007 MARDONES
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 9 where id = 'db1e62b9-bcd4-4b0c-b7ce-d8bb982edad1';  -- C-2025-0015 BERARDI
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 9 where id = '312a256e-303c-4370-be4d-8cac5034557e';  -- C-2024-0013 GARCIA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 9 where id = 'ac7d6400-8caa-42ab-9db6-ae35fcf82715';  -- C-2025-0014 PICHUMAN
update contracts set commission_destination = 'ADM_FRANCES_51_6' where id = '16f310fc-5049-4230-b000-5c99dae16bd1';  -- C-2025-0004 VEGA
update contracts set commission_destination = 'ADM_FRANCES_51_6', commission_pct = 10 where id = '4b7c97ea-dbfd-46c3-8965-41268124314f';  -- C-2025-0041 ROQUETA PRAT
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 6 where id = 'e4e19bc8-479d-4399-adb5-9f2e2a686dc5';  -- C-2026-0005 HERNANDO LEONARDO | GOMEZ
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 6 where id = 'c0371f1d-d856-40a0-a07f-467d848c38b0';  -- C-2025-0038 CHAILE GABRIELA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 6 where id = '92476fff-4388-454f-9ea2-f5829bb1ca28';  -- C-2025-0032 CARRIZO JORGE
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 6 where id = '376cccf9-8ca4-4da4-8f65-ff1a4b7bcc07';  -- C-2025-0034 HERNANDEZ GILBERTO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 7 where id = '8af110b7-3be5-46bd-8766-0d10fba5149b';  -- C-2024-0026 FONSECA LOPEZ DEL PILAR/FERREI
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = 'a8fe0a97-5e0e-4342-a96b-de120c306da8';  -- C-2025-0036 CARCAMO JONATAN
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = '776cd371-22ef-4716-9219-4a34560a21dc';  -- C-2025-0043 FAJARDO MARIA FERNANDA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = '02d1387a-b990-405f-9975-5c49ef55b85e';  -- C-2026-0006 ARNEDO JAVIER TRIMESTRAL IPC P
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = '761b386c-9d20-41ea-9bcb-c5016b28979a';  -- C-2025-0007 CAMPOSANO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = '9da5a7aa-17b8-40aa-bf5c-7cfba8de119e';  -- C-2025-0003 MURUA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '40f73a5e-bfe7-4825-ae34-c6be071d3aed';  -- C-2026-0008 CENTENO HORACIO | GRILLO NURIA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 7 where id = '5b5f3378-ec8d-45c0-ba84-576146dc6da9';  -- C-2024-0034 RIVAS NAZAR
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 7 where id = 'de25d61a-631f-4a7b-bd7a-4609d8d5c453';  -- C-2024-0011 FERNANDEZ MAXIMILIANO / BURGUE
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 6 where id = 'a32907a6-32f3-4dfd-852f-a10e57792101';  -- C-2024-0014 SALSO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 7 where id = '1809c8ba-6ed5-4452-8ed2-b296fa68c121';  -- C-2024-0008 CONDORI/COMERCIAL / VICTOR ORT
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 7 where id = 'bf3304d9-cd3d-486d-95e8-1b1eadb6fd6a';  -- C-2025-0025 GONZALEZ
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = '05a5f7de-ba3f-4e39-b81e-f5c9ecf67b8d';  -- C-2025-0017 AVENTRA SRL
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = 'c26509e2-06ee-4a58-9570-886b70de31d6';  -- C-2024-0006 BOGADO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = 'b44b2af2-0c9c-4b70-ad6b-e7d37f828851';  -- C-2025-0037 OJEDA/CARDENAS// COMERCIAL
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '885d6b9c-1bd9-4720-b234-8e209947ba0b';  -- C-2025-0013 OPORTO TAMARA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = 'bc92c0d3-72d7-4084-a05e-d91478ab0709';  -- C-2024-0021 GALLARDO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '9c2e6a86-1da0-41ec-887b-97b423bfa9ae';  -- C-2025-0002 NUÑEZ
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '031371a9-5314-4ee1-a7e1-e2cf5dbd7735';  -- C-2024-0001 RAMIREZ
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 7 where id = 'd2183f98-70a9-4cca-a99c-c6012984f0dd';  -- C-2023-0004 CALVO MAXIMILIANO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = 'cc632fa9-3d7b-43e5-8801-60a83c0943bd';  -- C-2023-0002 PASCUAL GASPAR //COMERCIAL
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 9 where id = 'dba282e8-2f33-48c8-8beb-3abd0f75c000';  -- C-2024-0030 DONGHI / SCHMIDT MELIZA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = 'fc79235d-4df9-4cd5-b724-f5f7175932dc';  -- C-2025-0020 RINALDI
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '144af4ab-9808-44f8-8387-686596ec07e7';  -- C-2024-0031 GIMENEZ ALEJANDRO
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '59d2e4b8-71ab-4ef8-a19f-5cfb01485167';  -- C-2024-0024 ELGUETA PRISCILA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = '4e0bf9c9-e44a-4988-93ce-376489bc7c8a';  -- C-2022-0001 POCARESSI
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = 'e3dbf848-83d9-4317-bfe8-72860fac1ae8';  -- C-2025-0008 HENNING ALHANA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = '029fa396-5378-45b7-bc9d-2f72ec09992f';  -- C-2025-0040 ARAIZ //COMERCIAL
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '54bd64c9-0a6e-414a-b3b7-1ca36c9cead2';  -- C-2025-0012 LATOSINSKI MARIANO
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '87897db7-16a7-476e-9157-7a17730a1c7c';  -- C-2025-0044 FERNANDEZ HORACIO
update contracts set commission_destination = 'ADM_FRANCES_50_9' where id = '25959302-e331-4e88-8c75-c3973709ff99';  -- C-2025-0021 GIMENEZ BELINDA/ TORRES KARINA
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = 'a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a';  -- C-2026-0014 LOURENCO/ PEREA EVELIN
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = '42cce6b2-301c-4275-a6d2-71ce8076f19e';  -- C-2025-0023 MARQUEZ
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 10 where id = '9cee1b49-cdac-4ba1-878f-b0b8b3be638c';  -- C-2026-0003 GOMEZ CID MANUEL
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = 'c556a06e-abec-42fe-9fd2-085a44569f18';  -- C-2025-0029 TOLEDO//COMERCIAL
update contracts set commission_destination = 'ADM_FRANCES_50_9', commission_pct = 8 where id = '10b149d1-da43-452d-a9b0-47a13a8729a5';  -- C-2026-0001 JIMENEZ //COMERCIAL
