// ============================================================================
// Bancos — commission-by-destination views. The 3 "banks" are the description
// tag conventions ADM_GALICIA / ADM_FRANCES_50_9 / ADM_FRANCES_51_6 on
// COMMISSION_OUT transactions (there is no destination table).
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getRecentPeriods, periodAxisLabel } from '@/lib/period'
import { displayCity } from '@/lib/geo'
import { classifyDestination, type DestinationCode } from '@/lib/bancos/destination'

// Re-exported for existing importers of the bancos surface.
export type BankDest = DestinationCode
export { classifyDestination }

// Per-COMMISSION_OUT row for the period: contract + property + destination + %.
export interface CommissionContractRow {
  txId:            string
  contractId:      string | null
  contractNumber:  string | null
  propertyAddress: string | null
  propertyCity:    string | null
  destination:     BankDest
  amount:          number
  pct:             number
}

export async function getCommissionByContract(period: string): Promise<CommissionContractRow[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select('id, amount, description, contract_id, contracts(contract_number, properties(address, city)), transaction_types!inner(code)')
    .eq('transaction_types.code', 'COMMISSION_OUT')
    .eq('period', period)

  const rows  = (data ?? []) as any[]
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  return rows.map(r => ({
    txId:            r.id as string,
    contractId:      r.contract_id ?? null,
    contractNumber:  r.contracts?.contract_number ?? null,
    propertyAddress: r.contracts?.properties?.address ?? null,
    propertyCity:    displayCity(r.contracts?.properties?.city),
    destination:     classifyDestination(r.description ?? ''),
    amount:          Number(r.amount),
    pct:             total > 0 ? (Number(r.amount) / total) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount)
}

// Per-destination commission per month, over the last `months` ending at `anchor`.
export interface BankMonthly {
  periods: string[]
  labels:  string[]
  byDest:  Record<BankDest, number[]>
}

export async function getCommissionByBankMonthly(months: number, anchor: string): Promise<BankMonthly> {
  const supabase = await createSupabaseServer()
  const periods  = getRecentPeriods(months, anchor)
  const { data } = await supabase
    .from('transactions')
    .select('amount, description, period, transaction_types!inner(code)')
    .eq('transaction_types.code', 'COMMISSION_OUT')
    .in('period', periods)

  const zero = () => periods.map(() => 0)
  const byDest: Record<BankDest, number[]> = {
    ADM_GALICIA: zero(), ADM_FRANCES_50_9: zero(), ADM_FRANCES_51_6: zero(), OTHER: zero(),
  }
  const idx = new Map(periods.map((p, i) => [p, i]))
  for (const r of (data ?? []) as any[]) {
    const i = idx.get(r.period)
    if (i == null) continue
    byDest[classifyDestination(r.description ?? '')][i] += Number(r.amount)
  }
  return { periods, labels: periods.map(periodAxisLabel), byDest }
}
