// ============================================================================
// Movimientos — the period's transaction ledger + month summary for the KPIs.
// All figures are real: amounts are unsigned in the DB with the sign coming
// from transaction_types.direction. Bank is only known for commission rows
// (the ADM_* description tag); transactions.bank_account_id is not populated,
// so other rows show no bank rather than a fabricated one.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { bankShortFromDescription } from '@/lib/bancos/destination'
import { pickPrimaryLandlord } from '@/lib/contract/primary'

const bankFromDescription = bankShortFromDescription

export interface MovimientoRow {
  id:             string
  bankDate:       string | null
  typeLabel:      string
  typeCode:       string
  direction:      'IN' | 'OUT'
  contractId:     string | null
  contractNumber: string | null
  counterparty:   string | null   // tenant (payer) for most; landlord (payee) for LANDLORD_PAYOUT
  bank:           string | null
  amount:         number          // unsigned
  description:    string
}

export async function getMovimientos(period: string): Promise<MovimientoRow[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select(`
      id, amount, bank_date, description, contract_id,
      transaction_types!inner(code, label, direction),
      contracts(
        contract_number,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(name))
      )
    `)
    .eq('period', period)
    .order('bank_date', { ascending: false, nullsFirst: false })

  return (data ?? []).map((r: any) => {
    const c        = r.contracts
    const tenant   = c?.contract_tenants?.find((ct: any) => ct.is_primary) ?? c?.contract_tenants?.[0]
    const landlord = pickPrimaryLandlord(c?.contract_landlords)
    const code     = r.transaction_types?.code ?? ''
    const counterparty = code === 'LANDLORD_PAYOUT'
      ? (landlord?.landlords?.name ?? null)
      : (tenant?.tenants?.name ?? null)
    return {
      id:             r.id,
      bankDate:       r.bank_date ?? null,
      typeLabel:      r.transaction_types?.label ?? code,
      typeCode:       code,
      direction:      (r.transaction_types?.direction ?? 'IN') as 'IN' | 'OUT',
      contractId:     r.contract_id ?? null,
      contractNumber: c?.contract_number ?? null,
      counterparty,
      bank:           bankFromDescription(r.description ?? ''),
      amount:         Number(r.amount),
      description:    r.description ?? '',
    }
  })
}

export interface MovimientosSummary {
  count:      number
  ingresos:   number   // sum of IN
  egresos:    number   // sum of OUT
  neto:       number   // ingresos - egresos
  comisiones: number   // sum of commission-category rows (agency commission)
}

// Light aggregate query — used for the current month AND the prior month (deltas).
export async function getMovimientosSummary(period: string): Promise<MovimientosSummary> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select('amount, transaction_types!inner(direction, category)')
    .eq('period', period)

  let ingresos = 0, egresos = 0, comisiones = 0, count = 0
  for (const r of (data ?? []) as any[]) {
    const a = Number(r.amount)
    count++
    if (r.transaction_types?.direction === 'IN') ingresos += a
    else egresos += a
    if (r.transaction_types?.category === 'commission') comisiones += a
  }
  return { count, ingresos, egresos, neto: ingresos - egresos, comisiones }
}
