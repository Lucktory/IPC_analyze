-- ============================================================================
-- 2026-09-18a - Permitir 0% de propiedad en un contrato
--
-- CORRER ESTA ANTES QUE migration-2026-09-18-copropiedad-correcciones.sql
--
-- POR QUE
--
-- El porcentaje decide cuanta plata le toca a cada propietario; estar en el
-- contrato decide si recibe la rendicion por mail. Son dos cosas distintas, y
-- sin el 0 no habia forma de separarlas: la unica manera de decir "a esta
-- persona no le transfieras nada" era sacarla del contrato, y sacarla la dejaba
-- tambien sin mail.
--
-- Los casos reales, del repaso que hizo Alejandro el 2026-09-17:
--   • C-2025-0003 y C-2025-0007 — Andrade Berta 100 / Silvia Bautista 0. La
--     plata va entera a Berta; la hija recibe copia del mail.
--   • C-2025-0028 y C-2026-0016 — Simoes Adrian 100 / Juan 0, mientras se
--     acomoda la sucesion. Cobra Adrian, el mail va a los dos hermanos.
--
-- QUE NO CAMBIA
--
-- Los porcentajes tienen que seguir sumando 100, y eso lo valida la aplicacion
-- (isPctSum100), no la base. Asi que 100 + 0 pasa, pero 0 + 0 y 50 + 0 siguen
-- rechazados al guardar. El tope de 100 tampoco se mueve, y los negativos
-- siguen prohibidos.
--
-- SOLO contract_landlords. contract_tenants y property_landlords quedan con
-- > 0, porque ahi el porcentaje no tiene nada que ver con a quien se le manda
-- un mail: un inquilino con 0% de la locacion, o un dueño con 0% de la
-- propiedad, no significan nada.
--
-- POR QUE APARECIO RECIEN AHORA
--
-- La validacion estaba escrita en DOS lugares: en la aplicacion y en la base. Se
-- corrigio la de la aplicacion el 2026-09-17 y la de la base quedo intacta, asi
-- que guardar un 0% fallaba con un error de constraint. Este archivo cierra la
-- segunda mitad.
-- ============================================================================

alter table contract_landlords
  drop constraint if exists contract_landlords_ownership_pct_check;

alter table contract_landlords
  add constraint contract_landlords_ownership_pct_check
  check (ownership_pct >= 0 and ownership_pct <= 100);

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname = 'contract_landlords_ownership_pct_check';
--
--   -- esperado: CHECK ((ownership_pct >= 0) AND (ownership_pct <= 100))
-- ============================================================================
