-- FIX 1 (dinero): en los 7 contratos RI (IVA), la columna OTROS de la hoja es el
-- IVA de la comision, que YA esta incluido en ADMI. Se importo por error como una
-- deduccion extra, generando un desbalance (recibo != transferencia). Se elimina.
-- Tras esto: recibo = ingreso - comision(con IVA) = transferencia real.
delete from transactions
 where period = '2026-06-01'
   and transaction_type_id = '718f095e-e73f-465d-8dcd-5ebc1d0663ac'  -- OTHER_OUT
   and description = 'Otros deducciones 06/2026'
   and contract_id in (
     'a8fe0a97-5e0e-4342-a96b-de120c306da8',  -- CARCAMO JONATAN
     '776cd371-22ef-4716-9219-4a34560a21dc',  -- FAJARDO MARIA FERNANDA
     'e612972c-6043-42d1-8cf7-c03d6cd5af28',  -- RUARTE NOELIA COMERCIAL
     '16f310fc-5049-4230-b000-5c99dae16bd1',  -- VEGA
     'db1e62b9-bcd4-4b0c-b7ce-d8bb982edad1',  -- BERARDI
     '312a256e-303c-4370-be4d-8cac5034557e',  -- GARCIA JULIETA
     'ac7d6400-8caa-42ab-9db6-ae35fcf82715'); -- PICHUMAN SAUL
