// ============================================================================
// Conciliacion — reconciliation STATUS of the system's movements. Our "bank
// confirmed" signal is transactions.bank_date (set = confirmed on the bank).
// There is no imported bank statement (extracto) in the schema yet, so the
// right-hand external-statement cross-check is a future feature; this view
// reconciles each movement against its own recorded bank confirmation.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface ConciliacionMov {
  id:             string
  bankDate:       string | null   // YYYY-MM-DD, null = not confirmed on the bank
  typeLabel:      string
  typeCode:       string
  direction:      'IN' | 'OUT'
  contractId:     string | null
  contractNumber: string | null
  tenantName:     string | null
  bank:           string | null   // derived from the ADM_* description tag
  amount:         number          // unsigned
  conciliado:     boolean         // bank_date is set
  description:    string
}

const BANK_SHORT: Record<string, string> = {
  ADM_GALICIA: 'Galicia', ADM_FRANCES_50_9: 'BBVA 50-9', ADM_FRANCES_51_6: 'BBVA 51-6',
}
function bankFromDescription(desc: string): string | null {
  for (const tag of Object.keys(BANK_SHORT)) if (desc.includes(tag)) return BANK_SHORT[tag]
  return null
}

export async function getConciliacionMovimientos(period: string): Promise<ConciliacionMov[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select(`
      id, amount, bank_date, description, contract_id,
      transaction_types!inner(code, label, direction),
      contracts(contract_number, contract_tenants(is_primary, tenants(name)))
    `)
    .eq('period', period)
    .order('bank_date', { ascending: true, nullsFirst: false })

  return (data ?? []).map((r: any) => {
    const c       = r.contracts
    const primary = c?.contract_tenants?.find((ct: any) => ct.is_primary) ?? c?.contract_tenants?.[0]
    return {
      id:             r.id,
      bankDate:       r.bank_date ?? null,
      typeLabel:      r.transaction_types?.label ?? r.transaction_types?.code ?? '',
      typeCode:       r.transaction_types?.code ?? '',
      direction:      (r.transaction_types?.direction ?? 'IN') as 'IN' | 'OUT',
      contractId:     r.contract_id ?? null,
      contractNumber: c?.contract_number ?? null,
      tenantName:     primary?.tenants?.name ?? null,
      bank:           bankFromDescription(r.description ?? ''),
      amount:         Number(r.amount),
      conciliado:     !!r.bank_date,
      description:    r.description ?? '',
    }
  })
}
