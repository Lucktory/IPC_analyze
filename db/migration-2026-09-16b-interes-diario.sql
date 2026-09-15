-- ============================================================================
-- 2026-09-16b - El interes por mora es DIARIO, no mensual
--
-- Mariela, via Alejandro (2026-09-16): "El interes por atraso. Es del 1%
-- diario." Y Alejandro: "el 1% es justamente para que no se atrasen".
--
-- El sistema lo venia tratando como MENSUAL: deuda x tasa% x dias/30. El panel
-- incluso decia "5% mensual". Con 5 dias de atraso sobre una deuda de
-- 2.653.000 mostraba $22.109; al 1% diario son $132.655. Seis veces mas.
--
-- POR QUE SE PUEDE CAMBIAR SIN CONVERTIR NADA
--
-- Los 103 contratos tienen exactamente el mismo valor, 5.00, y ninguno tiene
-- late_interest_enabled en true. O sea que ese 5 no lo eligio nadie: es el
-- default de cuando se armo el esquema, y el interes nunca se aplico. No hay
-- ninguna decision de negocio guardada ahi que haya que preservar.
--
-- ORDEN: ESTO VA ANTES DEL DEPLOY
--
-- El codigo nuevo multiplica por los dias sin dividir por 30. Si se sube el
-- codigo con los datos en 5.00, ese 5 pasa a leerse como 5% DIARIO — 150% al
-- mes. Corriendo esto primero, el peor caso intermedio es 1% mensual con el
-- codigo viejo: un numero chico, y ademas apagado en todos los contratos.
--
-- QUE NO CAMBIA
--
-- late_interest_enabled sigue en false en todos. El interes se muestra como
-- ESTIMACION y no se cobra solo: la oficina decide contrato por contrato y, si
-- lo cobra, carga el recargo a mano. Alejandro lo confirmo asi.
-- ============================================================================

update contracts
set late_interest_rate = 1.00
where coalesce(late_interest_rate, 0) <> 1.00
returning contract_number, late_interest_rate;

-- ============================================================================
-- VERIFICACION
-- ============================================================================
--   -- todos en 1.00, y ninguno activado:
--   select late_interest_rate, late_interest_enabled, count(*)
--   from contracts group by 1, 2;
-- ============================================================================
