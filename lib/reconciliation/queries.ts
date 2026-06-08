// ============================================================================
// Reconciliation queries — the section chief's per-account view.
//
// Alejandro confirmed (2026-06-08): keep the 3 destination columns SEPARATE.
// His section chief needs to filter all commissions per Pampa bank account
// and reconcile against the bank statement.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export type DestinationCode =
  | 'ADM_GALICIA'
  | 'ADM_FRANCES_50_9'
  | 'ADM_FRANCES_51_6'
  | 'OTHER'

export const DESTINATION_META: Record<
  DestinationCode,
  { label: string; subtitle: string; bank: string }
> = {
  ADM_GALICIA: {
    label:    'ADM Galicia',
    subtitle: 'Cuenta operativa Banco Galicia',
    bank:     'Banco Galicia',
  },
  ADM_FRANCES_50_9: {
    label:    'BBVA Francés 50/9',
    subtitle: 'Alias: DONDE.LISA.VALOR',
    bank:     'BBVA Francés',
  },
  ADM_FRANCES_51_6: {
    label:    'BBVA Francés 51/6',
    subtitle: 'Alias: DORSO.LISA.VALOR · marcada ADM FLAVIO',
    bank:     'BBVA Francés',
  },
  OTHER: {
    label:    'Sin destino identificado',
    subtitle: 'Movimientos sin etiqueta de cuenta',
    bank:     '—',
  },
}

export interface ReconciliationRow {
  amount:       number
  bankDate:     string | null
  description:  string | null
  contractId:   string | null
  tenant:       string | null
  landlord:     string | null
}

export interface ReconciliationBucket {
  code:    DestinationCode
  label:   string
  subtitle: string
  bank:    string
  total:   number
  count:   number
  rows:    ReconciliationRow[]
}

function classifyDestination(description: string | null): DestinationCode {
  const d = description ?? ''
  if (d.includes('ADM_GALICIA'))      return 'ADM_GALICIA'
  if (d.includes('ADM_FRANCES_50_9')) return 'ADM_FRANCES_50_9'
  if (d.includes('ADM_FRANCES_51_6')) return 'ADM_FRANCES_51_6'
  return 'OTHER'
}

export async function getReconciliationByDestination(
  period: string,
): Promise<ReconciliationBucket[]> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('transactions')
    .select(`
      amount, bank_date, description, contract_id,
      transaction_types!inner(code),
      contracts(
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(name))
      )
    `)
    .eq('transaction_types.code', 'COMMISSION_OUT')
    .eq('period', period)
    .order('bank_date', { ascending: true, nullsFirst: false })

  const buckets: Record<DestinationCode, ReconciliationBucket> = {
    ADM_GALICIA:      newBucket('ADM_GALICIA'),
    ADM_FRANCES_50_9: newBucket('ADM_FRANCES_50_9'),
    ADM_FRANCES_51_6: newBucket('ADM_FRANCES_51_6'),
    OTHER:            newBucket('OTHER'),
  }

  for (const tx of (data ?? []) as any[]) {
    const code  = classifyDestination(tx.description)
    const ct    = tx.contracts?.contract_tenants?.find((x: any) => x.is_primary)
                ?? tx.contracts?.contract_tenants?.[0]
    const cl    = (tx.contracts?.contract_landlords ?? [])
                  .slice()
                  .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
    const row: ReconciliationRow = {
      amount:      Number(tx.amount),
      bankDate:    tx.bank_date,
      description: tx.description,
      contractId:  tx.contract_id,
      tenant:      ct?.tenants?.name ?? null,
      landlord:    cl?.landlords?.name ?? null,
    }
    buckets[code].rows.push(row)
    buckets[code].total += row.amount
    buckets[code].count += 1
  }

  // Return only buckets that have rows, sorted by total desc, OTHER always last
  return Object.values(buckets)
    .filter(b => b.count > 0)
    .sort((a, b) => {
      if (a.code === 'OTHER') return 1
      if (b.code === 'OTHER') return -1
      return b.total - a.total
    })
}

function newBucket(code: DestinationCode): ReconciliationBucket {
  const meta = DESTINATION_META[code]
  return { code, label: meta.label, subtitle: meta.subtitle, bank: meta.bank, total: 0, count: 0, rows: [] }
}
