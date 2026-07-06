# Hallazgos del sistema — validacion junio 2026 (PARTICULARES-GALICIA)

Registro de las inconsistencias que el sistema detecto al reproducir el libro de
Alejandro. Sirve como prueba de que el sistema actua como CONTROL (no como copia)
y como lista de tareas para la proxima sesion.

Ultima verificacion contra la base: 2026-07-05.

---

## 1. PENDIENTE — 9 contratos con `end_date` vencida pero `status = 'active'`

El panel muestra "Contratos activos = 101" y "Morosidad = 8,3%", ambos INFLADOS
por estos 9 contratos. Detectado al verificar los datos del dashboard.

### 1a. 5 contratos SEGUIAN facturados en junio  -> renovados, fecha sin actualizar
NO dar de baja. Pedir a Alejandro la fecha de fin correcta y actualizar `end_date`.

| contract_id                          | end_date (vieja) | alquiler   |
|--------------------------------------|------------------|------------|
| c26509e2-06ee-4a58-9570-886b70de31d6 | 2026-02-28       | 1.300.000  |
| df4b05da-4fe7-4e2a-a55b-d7445155d63d | 2026-05-31       |   500.080  |
| 43440c40-8dbf-4e28-a7a9-5f6d0a88249c | 2026-05-31       |   249.919  |
| 4e0bf9c9-e44a-4988-93ce-376489bc7c8a | 2023-07-31 (!)   |   520.000  |
| 15fc17bc-51f0-4adb-bf51-efece807356f | 2026-03-31       | 1.200.000  |

### 1b. 4 contratos SIN facturar en junio  -> probablemente finalizados
Dar de baja SOLO si Alejandro confirma que terminaron. SQL: `PENDIENTE-baja-contratos-vencidos.sql`.

| contract_id                          | end_date   | alquiler |
|--------------------------------------|------------|----------|
| de25d61a-631f-4a7b-bd7a-4609d8d5c453 | 2026-05-31 |  426.837 |
| cc632fa9-3d7b-43e5-8801-60a83c0943bd | 2025-02-28 |  940.745 |
| 60c90bc9-6ea8-4d04-ae07-ada7354359a3 | 2026-04-30 |  550.000 |
| 1ba934b6-142d-4015-b9d5-9df39ba82e84 | 2026-04-30 |  684.714 |

**Efecto esperado tras la limpieza:** Contratos activos 101 -> 97, morosidad 8,3% -> ~5,5%.

**Importante:** NO agregar un filtro por `end_date` en el dashboard: descartaria
por error los 5 contratos renovados que si estan facturando. El arreglo es de datos.

---

## 2. Correcciones YA aplicadas (junio 2026)

Documentadas en los scripts de esta carpeta (ver README.md):

- **Distribucion de bancos**: las comisiones estaban todas en ADM_GALICIA. Se
  repartieron 17 Galicia / 36 BBVA 50-9 / 36 BBVA 51-6 ->
  $1.202.243 / $2.718.506 / $2.953.089 (total $6.873.838).
- **IVA - doble conteo de "otros"**: la columna OTROS de los 7 contratos con IVA
  ya era el IVA de la comision (dentro de ADMI); se eliminaron 7 filas OTHER_OUT.
- **GUSTAVO - % de comision**: guardado 8 vs planilla 7 -> corregido a 7.
- **BARTL - descuadre de $3**: liquidacion de prueba con ajuste viejo -> corregido.

Resultado: 89/89 contratos cuadran exactos con la planilla; totales
$81.165.471 (ingresos) / $6.873.838 (comision) / $73.620.088 (a propietarios),
descuadre 0.

---

## 3. Notas del dashboard (no son errores, son limites de datos)

- **Tendencia de ingresos**: solo mayo ($95,9M, seed viejo) y junio ($81,2M)
  tienen datos reales; enero-abril estan vacios o con ruido. El grafico ahora
  oculta los meses en cero y se ira completando a medida que se carguen meses.
- **Salud de cobranza en meses viejos**: mayo tiene mas filas RENT_IN que
  contratos (duplicados del seed) -> cobrado > esperado. El medidor se topea
  en 100%. Junio es correcto.
