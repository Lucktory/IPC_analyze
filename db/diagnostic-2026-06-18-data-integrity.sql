-- ============================================================================
-- DATA INTEGRITY DIAGNOSTIC — 2026-06-18
-- ============================================================================
-- Paste into Supabase SQL Editor. Returns one row per (contract, issue_kind)
-- covering every integrity rule the application now surfaces in the Check
-- column. Use it to find what's broken in the live data BEFORE applying
-- the Phase A3 schema constraints — those will fail the migration if
-- existing rows violate them.
--
-- Empty result set = data is clean; safe to apply constraints.
--
-- Issue kinds covered (matches lib/liquidacion/validations.ts rule codes):
--   end_date_le_start              CONTRACT_INVALID_DATE_RANGE       (error)
--   expired_but_active             CONTRACT_EXPIRED_BUT_ACTIVE       (error)
--   landlord_junction_empty        CONTRACT_LANDLORD_JUNCTION_EMPTY  (error)
--   tenant_junction_empty          CONTRACT_TENANT_JUNCTION_EMPTY    (error)
--   landlord_pct_sum_not_100       LANDLORD_PCT_SUM_NOT_100          (warning)
--   tenant_pct_sum_not_100         TENANT_PCT_SUM_NOT_100            (warning)
--   admin_pct_sum_invalid          ADMIN_PCT_SUM_INVALID             (warning)
--   missing_commission_pct         CONTRACT_MISSING_COMMISSION_PCT   (warning)
--   next_adjustment_overdue        CONTRACT_NEXT_ADJUSTMENT_OVERDUE  (warning)
--   sellado_pending                CONTRACT_SELLADO_PENDING          (warning)
--   deposit_state_invalid          CONTRACT_DEPOSIT_STATE_INVALID    (error)
--   billing_iva_mismatch           BILLING_IVA_MISMATCH              (warning)
-- ============================================================================

with
  active as (
    select * from contracts where status = 'active'
  ),
  landlord_sums as (
    select contract_id,
           sum(ownership_pct)::numeric(10,2) as pct_sum,
           count(*)                          as row_count
      from contract_landlords
     group by contract_id
  ),
  tenant_sums as (
    select contract_id,
           sum(share_pct)::numeric(10,2)     as pct_sum,
           count(*)                          as row_count
      from contract_tenants
     group by contract_id
  ),
  admin_sums as (
    select contract_id,
           sum(share_pct)::numeric(10,2)     as pct_sum,
           count(*)                          as row_count
      from contract_administrators
     group by contract_id
  ),
  primary_names as (
    select c.id as contract_id,
           (select string_agg(t.name, ' / ' order by ct.is_primary desc, t.name)
              from contract_tenants ct
              join tenants t on t.id = ct.tenant_id
             where ct.contract_id = c.id) as tenant_names,
           (select string_agg(l.name, ' / ' order by cl.ownership_pct desc, l.name)
              from contract_landlords cl
              join landlords l on l.id = cl.landlord_id
             where cl.contract_id = c.id) as landlord_names
      from contracts c
  ),
  -- ── ISSUE STREAMS ─────────────────────────────────────────────────────
  issues as (
    -- end_date <= start_date
    select c.id   as contract_id,
           c.contract_number,
           'end_date_le_start'  as issue_kind,
           'error'              as severity,
           c.end_date::text     as actual_value,
           '> ' || c.start_date as expected_value
      from active c
     where c.end_date <= c.start_date

    union all
    -- expired but still active
    select c.id, c.contract_number,
           'expired_but_active', 'error',
           c.end_date::text,
           current_date::text || ' (today)'
      from active c
     where c.end_date < current_date

    union all
    -- landlord junction empty
    select c.id, c.contract_number,
           'landlord_junction_empty', 'error',
           '0 rows',
           '>= 1 propietario'
      from active c
      left join landlord_sums ls on ls.contract_id = c.id
     where ls.contract_id is null

    union all
    -- tenant junction empty
    select c.id, c.contract_number,
           'tenant_junction_empty', 'error',
           '0 rows',
           '>= 1 inquilino'
      from active c
      left join tenant_sums ts on ts.contract_id = c.id
     where ts.contract_id is null

    union all
    -- landlord ownership_pct sum
    select c.id, c.contract_number,
           'landlord_pct_sum_not_100', 'warning',
           ls.pct_sum::text,
           '100'
      from active c
      join landlord_sums ls on ls.contract_id = c.id
     where abs(ls.pct_sum - 100) > 0.5

    union all
    -- tenant share_pct sum
    select c.id, c.contract_number,
           'tenant_pct_sum_not_100', 'warning',
           ts.pct_sum::text,
           '100'
      from active c
      join tenant_sums ts on ts.contract_id = c.id
     where abs(ts.pct_sum - 100) > 0.5

    union all
    -- contract_administrators sum invalid (only when rows exist)
    select c.id, c.contract_number,
           'admin_pct_sum_invalid', 'warning',
           sums.pct_sum::text,
           '100 (cuando hay split definido)'
      from active c
      join admin_sums sums on sums.contract_id = c.id
     where sums.row_count > 0
       and abs(sums.pct_sum - 100) > 0.5

    union all
    -- missing or zero commission_pct
    select c.id, c.contract_number,
           'missing_commission_pct', 'warning',
           coalesce(c.commission_pct::text, 'NULL'),
           '> 0'
      from active c
     where c.commission_pct is null or c.commission_pct = 0

    union all
    -- next_adjustment_date in the past while contract still runs
    select c.id, c.contract_number,
           'next_adjustment_overdue', 'warning',
           c.next_adjustment_date::text,
           '>= ' || current_date::text
      from active c
     where c.next_adjustment_date is not null
       and c.next_adjustment_date < current_date
       and c.end_date >= current_date

    union all
    -- sellado not applied 35+ days after start
    select c.id, c.contract_number,
           'sellado_pending', 'warning',
           'sellado_total=' || c.sellado_total::text || ', applied_at=NULL',
           'aplicar antes de ' || (c.start_date + interval '35 days')::date
      from active c
     where c.sellado_total > 0
       and c.sellado_applied_at is null
       and current_date >= (c.start_date + interval '35 days')::date

    union all
    -- deposit refunded but contract still active
    select c.id, c.contract_number,
           'deposit_state_invalid', 'error',
           c.deposit_status,
           'held o partially_used (contrato activo)'
      from active c
     where c.deposit_status = 'refunded'

    union all
    -- commission_includes_iva = true but billing administrator is not RI
    select c.id, c.contract_number,
           'billing_iva_mismatch', 'warning',
           'includes_iva=true / admin.tax_category=' || coalesce(adm.tax_category, 'NULL (admin no asignado)'),
           'admin.tax_category = RI'
      from active c
      left join administrators adm on adm.id = c.billing_administrator_id
     where c.commission_includes_iva = true
       and (adm.id is null or adm.tax_category <> 'RI')
  )
select
  i.contract_id,
  i.contract_number,
  pn.tenant_names,
  pn.landlord_names,
  i.issue_kind,
  i.severity,
  i.actual_value,
  i.expected_value
from issues i
left join primary_names pn on pn.contract_id = i.contract_id
order by
  case i.severity when 'error' then 0 else 1 end,
  i.issue_kind,
  i.contract_number nulls last;
