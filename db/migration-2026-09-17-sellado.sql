-- ============================================================================
-- 2026-09-17 - Tipo SELLADO_OUT, para que el sellado llegue a la rendicion
--
-- POR QUE
--
-- En la rendicion que mando Alejandro (ALVAREZ CRISTINA / FAJARDO, 2026-09-16)
-- hay una linea de deducciones que dice "SELLADO PROPIETARIO $95.075,76". El
-- sistema ya guardaba el sellado en el contrato -- sellado_total,
-- sellado_landlord_share_pct (default 50) y sellado_applied_at, mas una
-- validacion que avisa cuando quedo sin aplicar -- pero no habia ningun tipo de
-- transaccion para el, asi que no habia forma de que apareciera en la hoja del
-- propietario. Solo el numero guardado, sin salida.
--
-- EL SELLADO NO SE VA
--
-- Alejandro, 2026-09-17: cada contrato nuevo habia que sellarlo, mitad el
-- propietario y mitad el inquilino. Una ley lo derogo para vivienda pero NO
-- para los comerciales, asi que todo contrato comercial va a seguir teniendo
-- sellado. Son 10 contratos comerciales de 105 hoy.
--
-- SOLO LA MITAD DEL PROPIETARIO
--
-- La mitad del inquilino no pasa por la rendicion. Alejandro: al inquilino se
-- le da un recibo a mano cuando viene a pagar, y ahi adentro va su mitad. La
-- rendicion es para el propietario, asi que aca solo entra la parte de el.
-- Por eso el tipo es OUT y afecta la liquidacion: se le descuenta al dueño.
--
-- direction OUT + affects_liquidacion true lo hace caer en el balde "otros" de
-- funnelBucketOf, que es exactamente donde va: no es la comision, y se resta
-- de lo que se le transfiere.
-- ============================================================================

insert into transaction_types (code, label, direction, category, affects_liquidacion)
values ('SELLADO_OUT', 'Sellado (parte del propietario)', 'OUT', 'tax', true)
on conflict (code) do nothing;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   select code, label, direction, category, affects_liquidacion
--   from transaction_types where code = 'SELLADO_OUT';
--   -- esperado: OUT / tax / true
--
--   -- cuantos contratos tienen sellado cargado (deberia ser 0 hasta que la
--   -- oficina empiece a cargarlos):
--   select count(*) from contracts where coalesce(sellado_total, 0) > 0;
-- ============================================================================
