-- ============================================================================
-- 2026-09-16 - Recordatorios con fin: cuotas_total
--
-- Alejandro, 2026-09-16, sobre el deposito en garantia pagado en partes:
-- "Quizas estaria bueno que el sistema me diga al mes siguiente que la cuota
-- 2 de 3 hay que cobrarla. Y luego la 3 de 3."
--
-- Hasta hoy un recordatorio no tiene final. Tiene start_period (desde cuando)
-- e interval_months (cada cuanto), pero una vez que arranca avisa para
-- siempre. Para un cargo fijo —la THU, el gas— esta bien. Para algo que dura
-- un numero conocido de veces, no: al terminar hay que acordarse de apagarlo a
-- mano, y si no, el punto rojo queda ahi para siempre.
--
-- Esta columna es ese final, contado en veces y no en fecha, porque asi es como
-- se habla: "3 cuotas", "12 meses". Y de paso da el numero de cuota para
-- mostrar "2 de 3".
--
-- QUE RESUELVE
--
--   * Deposito en garantia en 2 o 3 cuotas (lo que pidio).
--   * Las expensas extraordinarias de Alassia, que son por 12 meses. Hasta hoy
--     la unica salida era escribir "(1 de 12)" a mano en la descripcion.
--   * La validacion RECURRING_CHARGE_NOT_RECORDED deja de avisar sola despues
--     de la ultima cuota, en vez de quedar colgada.
--
-- NULL = sin final, que es como se comportan hoy TODOS los recordatorios
-- cargados. Correr esto no cambia ninguno.
-- ============================================================================

alter table contract_recurring_charges
  add column if not exists cuotas_total integer
    check (cuotas_total is null or (cuotas_total >= 1 and cuotas_total <= 60));

comment on column contract_recurring_charges.cuotas_total is
  'Cantidad de veces que se cobra este recargo, contando desde start_period y '
  'avanzando de a interval_months. NULL = indefinido (se cobra siempre), que es '
  'el comportamiento historico. 3 = tres cuotas y se apaga solo. Sirve tambien '
  'para saber en que cuota se esta: "2 de 3".';

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'contract_recurring_charges'
--     and column_name = 'cuotas_total';
--
--   -- todos los recordatorios existentes quedan en NULL = sin cambio:
--   select cuotas_total, count(*) from contract_recurring_charges group by 1;
-- ============================================================================
