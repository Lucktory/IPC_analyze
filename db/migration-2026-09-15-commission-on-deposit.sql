-- ============================================================================
-- 2026-09-15 - Comision sobre el deposito en garantia, por contrato
--
-- Alejandro, 2026-09-14, sobre el deposito: "Se lo mandamos al propietario,
-- previa deduccion de la administracion. Hay algun caso que nos pelea para que
-- no le cobremos. Pero trato de cobrarle la comision sobre el sellado a todos
-- los que pueda."
--
-- O sea: por defecto la comision SI alcanza al deposito, y la excepcion es por
-- acuerdo con cada propietario. De ahi el default true.
--
-- QUE HACE Y QUE NO
--
-- El deposito se le transfiere al propietario igual, se le cobre o no la
-- comision, asi que sigue contando en `ingresos` y en la transferencia. Lo
-- unico que decide esta columna es si entra en la BASE de la comision
-- (lib/liquidacion/funnel.ts -> commissionBaseOf).
--
-- Es por CONTRATO y no por propietario, que es la misma granularidad que
-- commission_pct y commission_includes_iva. Ojo: un dueño con varios contratos
-- necesita la marca en cada uno.
--
-- Correr esto solo NO cambia ningun numero: mientras DEPOSIT_IN siga con
-- affects_liquidacion = false no hay ningun deposito dentro de `ingresos`, asi
-- que la base de la comision da igual con true o con false.
-- ============================================================================

alter table contracts
  add column if not exists commission_on_deposit boolean not null default true;

comment on column contracts.commission_on_deposit is
  'true (default) = la administracion se cobra tambien sobre el deposito en '
  'garantia cobrado al inquilino. false = concesion al propietario: el deposito '
  'se le transfiere igual pero queda fuera de la base de la comision. No afecta '
  'la transferencia, solo la base del calculo.';

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_name = 'contracts' and column_name = 'commission_on_deposit';
--
--   -- todos en true, ningun contrato cambia de comportamiento:
--   select commission_on_deposit, count(*) from contracts group by 1;
-- ============================================================================
