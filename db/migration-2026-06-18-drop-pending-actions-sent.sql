-- 2026-06-18 — Drop pending_actions_sent.
--
-- The table backed a Phase 7 "marcar enviado / 7-day snooze" feature on
-- /pendientes that was abandoned during the Phase 8 digest unification.
-- After the 2026-06-18 redesign the /pendientes page is a focused three-
-- category cashflow inbox: cobranza_proxima, pendiente_transferencia,
-- liquidacion_abierta. Items disappear when the underlying state changes
-- (rent gets recorded, transfer is made, liquidación is marked paid), so
-- a separate snooze table is no longer needed.
--
-- Companion file `db/schema.sql` will be updated to remove the seed-time
-- definition in a follow-up so fresh installs don't re-create the table.

drop table if exists pending_actions_sent;
