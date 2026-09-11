-- ============================================================================
-- 2026-09-11 - Deuda anterior (saldo de arrastre cargado a mano, por periodo)
--
-- Alejandro, 2026-09-11: "Agosto lo dejaria tambien como pagado, yo sigo
-- directamente con Septiembre. El unico problema va a ser los que deben en
-- serio. Hay algunas personas que si." Y despues: "La deuda cuando yo la
-- agrego, puedo poner a que periodo pertenece?"
--
-- Si. Por eso esto es una tabla y no una sola columna en contracts: un
-- inquilino puede deber Junio Y Julio, con montos distintos, y hay que poder
-- decir cual es cual. Una fila por contrato y periodo.
--
-- POR QUE EXISTE
-- --------------
-- Julio y Agosto 2026 nunca se cargaron (Julio tiene 23 alquileres de 97,
-- Agosto ninguno), asi que la falta de una fila de alquiler en esos meses NO
-- significa que el inquilino no pago. Por eso la deuda arrastrada automatica
-- arranca en Septiembre 2026 (DEUDA_EPOCH en
-- lib/liquidacion/deuda-breakdown.ts) y todo lo anterior queda cerrado.
--
-- Los que deben en serio entran por aca, a mano.
--
-- POR QUE EL MONTO Y NO SOLO EL MES
-- ---------------------------------
-- Se carga el monto ademas del periodo a proposito. Calcularlo desde el
-- alquiler historico daria un numero que parece exacto pero no lo es: puede
-- haber pagado una parte, puede haber un arreglo, y esos meses estan
-- incompletos en el sistema. El dato bueno lo tiene la oficina en sus propios
-- registros; el sistema guarda lo que la oficina afirma.
--
-- Tabla vacia = ningun contrato cambia de comportamiento. No hay nada que
-- backfillear y correr esto solo no cambia nada visible.
-- ============================================================================

create table if not exists deuda_anterior (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  -- Primero de mes, igual que transactions.period.
  period      date not null,
  amount      numeric(14,2) not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Un solo saldo por contrato y mes: cargar el mismo mes dos veces lo pisa
  -- en vez de duplicar la deuda.
  unique (contract_id, period)
);

comment on table deuda_anterior is
  'Deuda de periodos anteriores al corte automatico (DEUDA_EPOCH, Septiembre '
  '2026), cargada a mano por la oficina desde la ficha del contrato. Una fila '
  'por contrato y mes adeudado. Se suma a deudaCarryover en el desglose y '
  'dispara el (+) en la planilla. No se calcula ni se actualiza sola.';

comment on column deuda_anterior.period is
  'Mes al que pertenece la deuda, primero de mes (2026-07-01 = Julio 2026).';

comment on column deuda_anterior.amount is
  'Monto adeudado de ese mes, segun los registros de la oficina. Puede ser '
  'menor al alquiler del mes si el inquilino pago una parte.';

create index if not exists idx_deuda_anterior_contract
  on deuda_anterior (contract_id);

-- updated_at automatico, igual que contracts / landlords / tenants / banks.
drop trigger if exists trg_deuda_anterior_touch_updated_at on deuda_anterior;
create trigger trg_deuda_anterior_touch_updated_at
  before update on deuda_anterior
  for each row execute function touch_updated_at();

-- Audit, igual que el resto de las tablas de negocio: esto afecta plata que se
-- le reclama a un inquilino, asi que tiene que quedar registrado quien lo cargo.
drop trigger if exists audit_deuda_anterior on deuda_anterior;
create trigger audit_deuda_anterior
  after insert or update or delete on public.deuda_anterior
  for each row execute function public.audit_row();

-- RLS. db/enable-rls.sql descubre las tablas del catalogo en el momento en que
-- se corre, asi que una tabla creada despues NO queda cubierta: hay que
-- activarla aca con la misma politica piso.
alter table public.deuda_anterior enable row level security;
drop policy if exists deuda_anterior_authenticated_all on public.deuda_anterior;
create policy deuda_anterior_authenticated_all
  on public.deuda_anterior
  for all to authenticated
  using (true) with check (true);

-- ============================================================================
-- VERIFICACION - las tres tienen que dar bien
-- ============================================================================
-- 1. La tabla existe y tiene RLS activo:
--      select relname, relrowsecurity from pg_class
--      where relname = 'deuda_anterior';
--
-- 2. La politica existe:
--      select policyname, roles from pg_policies
--      where tablename = 'deuda_anterior';
--
-- 3. Arranca vacia:
--      select count(*) from deuda_anterior;   -- 0
-- ============================================================================
