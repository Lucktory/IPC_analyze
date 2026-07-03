-- BARTL: la liquidacion guardada venia de un test viejo (gross 613.600, ajuste
-- manual 3), desalineada con las transacciones actuales de Junio (614.000). Se
-- sincroniza con los valores reales y se pone el ajuste en 0, para que
-- recibo = transferencia = 577.160 (desaparece el desbalance de 3).
update liquidaciones
   set gross_amount     = 614000,
       total_deductions = 36840,
       net_to_landlord  = 577160,
       adjustment_amount = 0
 where contract_id = 'e5107e7f-d7a9-459a-b0af-9e343c37fb31'
   and period = '2026-06-01';
