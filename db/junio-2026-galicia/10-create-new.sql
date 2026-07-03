-- create_new.sql: crear los 2 contratos nuevos que estan en la hoja de Junio pero
-- no en el sistema. Propietarios ya existen (se reutilizan). Todo dentro de un
-- bloque para encadenar los ids generados. Ambos reconcilian (recibo = transferencia).
do $$
declare
  v_admin   uuid := '7257451b-83aa-4767-9472-25926d563bf5';
  v_morelli uuid := '6de3f70e-9c72-4c26-915d-4c7d2e82184a';
  v_ordeig  uuid := 'de016422-baaf-4d7f-b263-a080170dec4b';
  v_simoes  uuid := '7269503a-f18f-4491-9ad4-d2068fa09463';
  v_rent uuid; v_comm uuid; v_otro uuid; v_pay uuid;
  v_prop uuid; v_tenant uuid; v_contract uuid;
begin
  select id into v_rent from transaction_types where code = 'RENT_IN';
  select id into v_comm from transaction_types where code = 'COMMISSION_OUT';
  select id into v_otro from transaction_types where code = 'OTHER_OUT';
  select id into v_pay  from transaction_types where code = 'LANDLORD_PAYOUT';

  -- ============ GONZALEZ ESCUDERO FLORENCIA ABRIL (prop. MORELLI) ============
  -- alq 500.000, 7%, otros 103.256,26, transf 361.743,74; comision -> ADM_FRANCES_51_6
  insert into properties (id, administration_id, address, property_type)
    values (gen_random_uuid(), v_admin, 'Propiedad de MORELLI (GONZALEZ ESCUDERO)', 'vivienda')
    returning id into v_prop;
  insert into property_landlords (property_id, landlord_id, ownership_pct) values (v_prop, v_morelli, 100);
  insert into tenants (id, administration_id, name)
    values (gen_random_uuid(), v_admin, 'GONZALEZ ESCUDERO FLORENCIA ABRIL') returning id into v_tenant;
  insert into contracts (id, administration_id, property_id, current_rent, initial_rent, start_date, end_date, commission_pct, lfa_code, status, cadence)
    values (gen_random_uuid(), v_admin, v_prop, 500000, 500000, '2026-06-01', '2028-05-31', 7, 'F', 'active', 'trimestral')
    returning id into v_contract;
  insert into contract_landlords (contract_id, landlord_id, ownership_pct) values (v_contract, v_morelli, 100);
  insert into contract_tenants (contract_id, tenant_id, is_primary) values (v_contract, v_tenant, true);
  insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
    (v_admin, v_contract, v_rent, '2026-06-01', 500000,    '2026-06-04', 'Alquiler Junio - GONZALEZ ESCUDERO FLORENCIA ABRIL'),
    (v_admin, v_contract, v_comm, '2026-06-01', 35000,     '2026-06-04', 'Comision 7% sobre total cobrado - ADM_FRANCES_51_6'),
    (v_admin, v_contract, v_otro, '2026-06-01', 103256.26, '2026-06-04', 'Otros deducciones 06/2026'),
    (v_admin, v_contract, v_pay,  '2026-06-01', 361743.74, '2026-06-23', 'Transferencia a propietario Junio');

  -- ============ SUAREZ LUCIANA LAURA (prop. ORDEIG + SIMOES CAMILA, 50/50) ====
  -- alq 800.000, 10%, sin otros, transf 720.000; comision -> ADM_GALICIA
  -- NOTA: la hoja no trae fechas de contrato; se usa 2026-06-01..2028-05-31 como
  -- provisorio (start/end son obligatorios). Confirmar la vigencia real con Alejandro.
  insert into properties (id, administration_id, address, property_type)
    values (gen_random_uuid(), v_admin, 'Propiedad de ORDEIG/SIMOES (SUAREZ LUCIANA)', 'vivienda')
    returning id into v_prop;
  insert into property_landlords (property_id, landlord_id, ownership_pct) values (v_prop, v_ordeig, 50), (v_prop, v_simoes, 50);
  insert into tenants (id, administration_id, name)
    values (gen_random_uuid(), v_admin, 'SUAREZ LUCIANA LAURA') returning id into v_tenant;
  insert into contracts (id, administration_id, property_id, current_rent, initial_rent, start_date, end_date, commission_pct, status, cadence)
    values (gen_random_uuid(), v_admin, v_prop, 800000, 800000, '2026-06-01', '2028-05-31', 10, 'active', 'trimestral')
    returning id into v_contract;
  insert into contract_landlords (contract_id, landlord_id, ownership_pct) values (v_contract, v_ordeig, 50), (v_contract, v_simoes, 50);
  insert into contract_tenants (contract_id, tenant_id, is_primary) values (v_contract, v_tenant, true);
  insert into transactions (administration_id, contract_id, transaction_type_id, period, amount, bank_date, description) values
    (v_admin, v_contract, v_rent, '2026-06-01', 800000, '2026-06-26', 'Alquiler Junio - SUAREZ LUCIANA LAURA'),
    (v_admin, v_contract, v_comm, '2026-06-01', 80000,  '2026-06-26', 'Comision 10% sobre total cobrado - ADM_GALICIA'),
    (v_admin, v_contract, v_pay,  '2026-06-01', 720000, '2026-06-26', 'Transferencia a propietario Junio');
end $$;
