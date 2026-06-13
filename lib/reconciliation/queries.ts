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

export interface DestinationMeta {
  label:    string
  subtitle: string
  bank:     string
  /** Alias bancario (es-AR alias). Shown next to the title for fast match against bank statement. */
  alias:    string | null
  /** CBU/CVU — shown next to the alias when known. Leave null until populated. */
  cbu:      string | null
  /** Internal note about the account (e.g. "marcada ADM FLAVIO"). */
  note:     string | null
}

export const DESTINATION_META: Record<DestinationCode, DestinationMeta> = {
  ADM_GALICIA: {
    label:    'ADM Galicia',
    subtitle: 'Cuenta operativa Banco Galicia',
    bank:     'Banco Galicia',
    alias:    null,
    cbu:      null,
    note:     null,
  },
  ADM_FRANCES_50_9: {
    label:    'BBVA Francés 50/9',
    subtitle: 'Cuenta operativa BBVA',
    bank:     'BBVA Francés',
    alias:    'DONDE.LISA.VALOR',
    cbu:      null,
    note:     null,
  },
  ADM_FRANCES_51_6: {
    label:    'BBVA Francés 51/6',
    subtitle: 'Cuenta operativa BBVA',
    bank:     'BBVA Francés',
    alias:    'DORSO.LISA.VALOR',
    cbu:      null,
    note:     'marcada ADM FLAVIO',
  },
  OTHER: {
    label:    'Sin destino identificado',
    subtitle: 'Movimientos sin etiqueta de cuenta',
    bank:     '—',
    alias:    null,
    cbu:      null,
    note:     null,
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
  alias:   string | null
  cbu:     string | null
  note:    string | null
  total:   number
  count:   number
  rows:    ReconciliationRow[]
}

export function classifyDestination(description: string | null): DestinationCode {
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
  return {
    code,
    label:    meta.label,
    subtitle: meta.subtitle,
    bank:     meta.bank,
    alias:    meta.alias,
    cbu:      meta.cbu,
    note:     meta.note,
    total:    0,
    count:    0,
    rows:     [],
  }
}
