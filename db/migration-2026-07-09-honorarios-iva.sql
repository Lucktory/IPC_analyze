-- ============================================================================
-- 2026-07-09 - Honorarios IVA flag on contract_events
--
-- Honorarios (agency income, kind='honorarios') sometimes carry 21% IVA and
-- sometimes don't (RI vs Monotributo) - same rule the commission already uses
-- via contracts.commission_includes_iva. Add the same kind of boolean flag to
-- the event so a honorario can be "Con IVA 21%" or "Sin IVA", and the 21%
-- portion is derived for display / totals (never stored redundantly).
--
-- Defaults false, so every existing arreglo/ajuste/honorario is unaffected.
-- ============================================================================

alter table contract_events
  add column if not exists includes_iva boolean not null default false;

comment on column contract_events.includes_iva is
  'For honorarios: true = the neto amount also charges 21% IVA on top. Stored '
  'amount is NETO (agency income); IVA = amount*0.21 and total con IVA = '
  'amount*1.21 are derived, not stored.';
