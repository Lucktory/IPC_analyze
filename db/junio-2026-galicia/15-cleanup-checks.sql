-- cleanup_checks.sql: limpiar avisos del check (fechas vencidas, % inquilinos, alquiler)

-- 1. Vigencia vencida: actualizar end_date desde la hoja (solo donde la hoja tiene fecha futura)

-- 2. Suma de % de inquilinos = 100 (reparto equitativo en contratos multi-inquilino)
update contract_tenants set share_pct = 50 where contract_id = 'b44b2af2-0c9c-4b70-ad6b-e7d37f828851';
update contract_tenants set share_pct = 50 where contract_id = 'de25d61a-631f-4a7b-bd7a-4609d8d5c453';
update contract_tenants set share_pct = 50 where contract_id = '0a990dd4-c9d6-4c08-abfe-ac6f1a25ff84';
update contract_tenants set share_pct = 50 where contract_id = 'ab0fc70f-494d-4354-a064-e0cff8bf0145';
update contract_tenants set share_pct = 50 where contract_id = 'e4e19bc8-479d-4399-adb5-9f2e2a686dc5';
update contract_tenants set share_pct = 50 where contract_id = 'df4b05da-4fe7-4e2a-a55b-d7445155d63d';
update contract_tenants set share_pct = 50 where contract_id = 'dba282e8-2f33-48c8-8beb-3abd0f75c000';
update contract_tenants set share_pct = 33.33 where contract_id = '8bf19f24-faa6-4ccc-ba93-6eded52ddd13';
update contract_tenants set share_pct = 33.33 where contract_id = '25959302-e331-4e88-8c75-c3973709ff99';
update contract_tenants set share_pct = 50 where contract_id = '9c52acd9-c038-41bf-9514-bd31dfce2a6e';
update contract_tenants set share_pct = 50 where contract_id = '59d2e4b8-71ab-4ef8-a19f-5cfb01485167';
update contract_tenants set share_pct = 50 where contract_id = '2968a898-2ad1-4750-ae19-c2fb96ecfdb4';
update contract_tenants set share_pct = 50 where contract_id = 'a6b1138c-3fcb-4803-93ba-1e23c9d6ca2a';
update contract_tenants set share_pct = 50 where contract_id = '1809c8ba-6ed5-4452-8ed2-b296fa68c121';
update contract_tenants set share_pct = 50 where contract_id = '9c895ea5-fcc5-4153-aa1d-c9f78eed9e46';
update contract_tenants set share_pct = 50 where contract_id = 'bc871f1a-f170-46f3-a25f-8e4d221207c2';

-- 3. GUSTAVO FERNANDEZ: current_rent al alquiler vigente de Junio
update contracts set current_rent = 1164162 where id = 'ea141636-72fa-40d2-8854-68b9dfbd9537';
