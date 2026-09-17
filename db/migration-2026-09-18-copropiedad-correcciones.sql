-- ============================================================================
-- 2026-09-18 - Correcciones de los contratos con dos propietarios
--
-- Alejandro repaso el 2026-09-17 los 15 contratos con dos dueños, uno por uno.
-- De ahi salen estas correcciones. Los 6 que ya estaban bien no se tocan:
-- C-2024-0008, C-2024-0014, C-2024-0020, C-2025-0011, C-2025-0016, C-2025-0025.
--
-- LA REGLA QUE HAY DETRAS
--
-- El porcentaje decide cuanta plata le toca a cada uno; estar en el contrato
-- decide si recibe la rendicion por mail. Por eso ahora se puede poner 0%: es la
-- unica forma de decir "a esta persona no le transfieras, pero mandale el mail".
-- Antes habia que sacarla del contrato, y eso la dejaba sin mail tambien.
--
-- TODO EN UNA TRANSACCION
--
-- O entra todo o no entra nada. Si algo falla, la base queda como estaba.
--
-- VERIFICADO ANTES DE ESCRIBIRLO
--
--   • PEREZ FRANCISCO esta en DOS contratos, asi que NO se le cambia el nombre:
--     se crea el inquilino correcto y se cambia el vinculo de este contrato solo.
--     Renombrarlo hubiera roto el otro.
--   • La unica liquidacion guardada en los contratos que se tocan es un borrador
--     vacio de Junio en C-2026-0016, a nombre de SIMOES CAMILA: sin ajuste y sin
--     notas. No se pierde nada. La fila queda huerfana y no la lee nadie.
--   • SIMOES ADRIAN, SIMOES JUAN, BIRKHOFER SONIA y ANDRADE BERTA ya existen.
-- ============================================================================

begin;

-- ── 1. C-2024-0004 — Kruse fallecio. Leiva queda sola. ──────────────────────
delete from contract_landlords
where contract_id = (select id from contracts where contract_number = 'C-2024-0004')
  and landlord_id = (select id from landlords where name = 'KRUSE');

update contract_landlords set ownership_pct = 100
where contract_id = (select id from contracts where contract_number = 'C-2024-0004');

-- ── 2. C-2024-0022 — sucesion Jasenovsky: dar de baja. ──────────────────────
update contracts set status = 'rescinded'
where contract_number = 'C-2024-0022';

-- ── 3. C-2024-0034 — Enrique fallecio: su mitad pasa a Sonia. ───────────────
-- Quedan Monica 50 / Sonia 50, que ya es el reparto que tenia.
update contract_landlords
set landlord_id = (select id from landlords where name = 'BIRKHOFER SONIA')
where contract_id = (select id from contracts where contract_number = 'C-2024-0034')
  and landlord_id = (select id from landlords where name = 'PEREZ');

-- ── 4. C-2025-0003 y C-2025-0007 — Andrade cobra todo; la hija recibe copia ──
-- Silvia Bautista figuraba como dueña del 50% y no lo es. Queda en 0: sigue en
-- el contrato para que le llegue el mail, pero no se le transfiere nada.
update contract_landlords cl
set ownership_pct = case when l.name = 'ANDRADE BERTA' then 100 else 0 end
from landlords l
where l.id = cl.landlord_id
  and cl.contract_id in (select id from contracts
                         where contract_number in ('C-2025-0003', 'C-2025-0007'));

-- ── 5. C-2025-0009 — el inquilino es Otero Walsh ────────────────────────────
insert into tenants (administration_id, name)
select t.administration_id, 'OTERO WALSH'
from tenants t
where t.name = 'PEREZ FRANCISCO'
  and not exists (select 1 from tenants where name = 'OTERO WALSH')
limit 1;

update contract_tenants
set tenant_id = (select id from tenants where name = 'OTERO WALSH')
where contract_id = (select id from contracts where contract_number = 'C-2025-0009')
  and tenant_id  = (select id from tenants where name = 'PEREZ FRANCISCO');

-- ── 6. C-2025-0009 — Manuel Pacho recibe la rendicion sin ser propietario ────
-- Va en alt_emails, que es justamente para los que tienen que recibirla sin
-- tener parte en el contrato.
update landlords
set alt_emails = coalesce(alt_emails, '{}'::text[]) || array['manuelpachort@gmail.com']
where name = 'LORENA CABALLERO HIJA'
  and not (coalesce(alt_emails, '{}'::text[]) @> array['manuelpachort@gmail.com']);

-- ── 7. C-2025-0028 — Abilio fallecio. Cobra Adrian, el mail va a los dos. ───
-- "por ahora sujeto a modificacion", asi que cuando se acomode la sucesion es
-- cambiar un numero.
delete from contract_landlords
where contract_id = (select id from contracts where contract_number = 'C-2025-0028');

insert into contract_landlords (contract_id, landlord_id, ownership_pct)
select c.id, l.id, v.pct
from contracts c
join (values ('SIMOES ADRIAN', 100), ('SIMOES JUAN', 0)) as v(nombre, pct) on true
join landlords l on l.name = v.nombre
where c.contract_number = 'C-2025-0028';

-- Trivellini no es inquilino de este contrato. Queda Bahamonde sola al 100%.
delete from contract_tenants
where contract_id = (select id from contracts where contract_number = 'C-2025-0028')
  and tenant_id in (select id from tenants where name ilike '%trivellini%');

update contract_tenants set is_primary = true, share_pct = 100
where contract_id = (select id from contracts where contract_number = 'C-2025-0028');

-- ── 8. C-2026-0016 — Ordeig fallecio y Camila sale. Mismo criterio. ─────────
delete from contract_landlords
where contract_id = (select id from contracts where contract_number = 'C-2026-0016');

insert into contract_landlords (contract_id, landlord_id, ownership_pct)
select c.id, l.id, v.pct
from contracts c
join (values ('SIMOES ADRIAN', 100), ('SIMOES JUAN', 0)) as v(nombre, pct) on true
join landlords l on l.name = v.nombre
where c.contract_number = 'C-2026-0016';

commit;

-- ============================================================================
-- VERIFICACION — correr despues, deberia dar exactamente esto:
-- ============================================================================
--
--   select c.contract_number,
--          string_agg(l.name || ' ' || cl.ownership_pct || '%', ' | '
--                     order by cl.ownership_pct desc, l.name) as propietarios,
--          c.status
--   from contracts c
--   join contract_landlords cl on cl.contract_id = c.id
--   join landlords l on l.id = cl.landlord_id
--   where c.contract_number in ('C-2024-0004','C-2024-0022','C-2024-0034',
--         'C-2025-0003','C-2025-0007','C-2025-0028','C-2026-0016')
--   group by c.contract_number, c.status
--   order by c.contract_number;
--
--   C-2024-0004  LEIVA ADRIANA 100%                        active
--   C-2024-0022  ORDEIG MIRTA INES 50% | SIMOES CAMILA 50% rescinded
--   C-2024-0034  BIRKHOFER MONICA 50% | BIRKHOFER SONIA 50% active
--   C-2025-0003  ANDRADE BERTA 100% | SILVIA BAUTISTA 0%   active
--   C-2025-0007  ANDRADE BERTA 100% | SILVIA BAUTISTA 0%   active
--   C-2025-0028  SIMOES ADRIAN 100% | SIMOES JUAN 0%       active
--   C-2026-0016  SIMOES ADRIAN 100% | SIMOES JUAN 0%       active
--
--   -- el inquilino de C-2025-0009:
--   select t.name from contract_tenants ct
--   join tenants t on t.id = ct.tenant_id
--   join contracts c on c.id = ct.contract_id
--   where c.contract_number = 'C-2025-0009';        -- OTERO WALSH
--
--   -- la copia de Manuel Pacho:
--   select name, alt_emails from landlords
--   where name = 'LORENA CABALLERO HIJA';
--
-- ============================================================================
-- QUEDA PENDIENTE, NO SE PUEDE RESOLVER ACA
-- ============================================================================
--
-- SILVIA BAUTISTA no tiene email cargado, y en C-2025-0003 y C-2025-0007 tiene
-- que recibir copia de la rendicion. Sin el mail, la copia no sale. Hay que
-- pedirselo a Alejandro y cargarlo en su ficha.
-- ============================================================================
