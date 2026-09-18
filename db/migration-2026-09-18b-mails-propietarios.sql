-- ============================================================================
-- 2026-09-18b - Mails de propietarios que faltaban
--
-- Se va completando a medida que Alejandro los manda. Cada bloque es
-- independiente: agregar los nuevos abajo y volver a correr el archivo entero
-- es seguro, porque cada update apunta a una persona concreta y solo escribe si
-- el valor cambia.
--
-- POR QUE IMPORTA
--
-- Desde el 2026-09-17 la rendicion sale por mail a TODOS los propietarios del
-- contrato, no solo al principal. Un propietario sin mail cargado no la recibe,
-- y no hay ningun aviso: simplemente no le llega.
--
-- Al 2026-09-18 hay 36 contratos activos de 98 donde NINGUN propietario tiene
-- mail. En esos no se le puede mandar la rendicion a nadie.
-- ============================================================================

begin;

-- ── Silvia Bautista ─────────────────────────────────────────────────────────
-- Recibe copia en los dos contratos de Andrade (C-2025-0003 y C-2025-0007).
-- Figura con 0%: no cobra, pero tiene que recibir la rendicion.
update landlords
set email = 'bautis111@yahoo.com.ar'
where name = 'SILVIA BAUTISTA'
  and coalesce(email, '') <> 'bautis111@yahoo.com.ar';

commit;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   select name, email from landlords where name = 'SILVIA BAUTISTA';
--
--   -- cuantos propietarios activos siguen sin mail:
--   select count(distinct l.id)
--   from landlords l
--   join contract_landlords cl on cl.landlord_id = l.id
--   join contracts c on c.id = cl.contract_id
--   where c.status = 'active'
--     and coalesce(trim(l.email),'') = ''
--     and coalesce(array_length(l.alt_emails,1),0) = 0;
-- ============================================================================
