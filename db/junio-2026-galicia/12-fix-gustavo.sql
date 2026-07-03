-- GUSTAVO FERNANDEZ: la comision de la hoja es 7% (81.491 = 1.164.162 x 7%), pero
-- el contrato tenia commission_pct = 8. Al alinearlo desaparecen el desvio de
-- comision y el desbalance de transferencia (el recibo se recalcula con 7%).
update contracts set commission_pct = 7, commission_includes_iva = false
 where id = 'ea141636-72fa-40d2-8854-68b9dfbd9537';
