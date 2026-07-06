-- ============================================================================
-- PENDIENTE (NO ejecutado) — limpieza de 9 contratos con end_date vencida pero
-- status = 'active'. Detectado el 2026-07-05. Ver HALLAZGOS.md, seccion 1.
--
-- Ejecutar SOLO tras confirmar con Alejandro. Son dos grupos distintos.
-- ============================================================================

-- 0) Revisar los 9 antes de tocar nada:
SELECT id, current_rent, start_date, end_date, status
FROM contracts
WHERE id IN (
  -- grupo A (facturados en junio -> renovados, corregir end_date)
  'c26509e2-06ee-4a58-9570-886b70de31d6',
  'df4b05da-4fe7-4e2a-a55b-d7445155d63d',
  '43440c40-8dbf-4e28-a7a9-5f6d0a88249c',
  '4e0bf9c9-e44a-4988-93ce-376489bc7c8a',
  '15fc17bc-51f0-4adb-bf51-efece807356f',
  -- grupo B (sin facturar -> probablemente finalizados)
  'de25d61a-631f-4a7b-bd7a-4609d8d5c453',
  'cc632fa9-3d7b-43e5-8801-60a83c0943bd',
  '60c90bc9-6ea8-4d04-ae07-ada7354359a3',
  '1ba934b6-142d-4015-b9d5-9df39ba82e84'
);

-- ----------------------------------------------------------------------------
-- GRUPO A — renovados, siguen facturando. NO dar de baja.
-- Cuando Alejandro pase las fechas de fin correctas, actualizar una por una:
--
-- UPDATE contracts SET end_date = 'AAAA-MM-DD' WHERE id = 'c26509e2-06ee-4a58-9570-886b70de31d6';
-- UPDATE contracts SET end_date = 'AAAA-MM-DD' WHERE id = 'df4b05da-4fe7-4e2a-a55b-d7445155d63d';
-- UPDATE contracts SET end_date = 'AAAA-MM-DD' WHERE id = '43440c40-8dbf-4e28-a7a9-5f6d0a88249c';
-- UPDATE contracts SET end_date = 'AAAA-MM-DD' WHERE id = '4e0bf9c9-e44a-4988-93ce-376489bc7c8a';
-- UPDATE contracts SET end_date = 'AAAA-MM-DD' WHERE id = '15fc17bc-51f0-4adb-bf51-efece807356f';

-- ----------------------------------------------------------------------------
-- GRUPO B — sin facturar, probablemente finalizados. Dar de baja si Alejandro
-- confirma (el esquema solo tiene 'active'/'rescinded'):
--
-- UPDATE contracts
-- SET status = 'rescinded'
-- WHERE id IN (
--   'de25d61a-631f-4a7b-bd7a-4609d8d5c453',  -- end 2026-05-31  rent 426.837
--   'cc632fa9-3d7b-43e5-8801-60a83c0943bd',  -- end 2025-02-28  rent 940.745
--   '60c90bc9-6ea8-4d04-ae07-ada7354359a3',  -- end 2026-04-30  rent 550.000
--   '1ba934b6-142d-4015-b9d5-9df39ba82e84'   -- end 2026-04-30  rent 684.714
-- );
-- Esperado: 4 filas -> Contratos activos 101 -> 97, morosidad baja ~2,6M.
