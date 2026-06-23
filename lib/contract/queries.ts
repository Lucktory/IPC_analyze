// ============================================================================
// Per-contract detail + liquidación "embudo" — Alejandro's confirmed design.
//
// From his message 2026-06-08:
//   "total cobrado = alquiler + recuperos (TASA, CAMUZZI, ABL, etc.)
//    % administración → calculado sobre el total cobrado
//    resto → transferencia al propietario"
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface ContractDetail {
  id:              string
  status:          string
  currentRent:     number
  initialRent:     number
  expensas:        number
  currency:        string
  cadence:         string
  indexer:         string
  startDate:       string
  endDate:         string
  nextAdjustmentDate: string | null
  paymentDay:      number
  notes:           string | null
  landlords:       { id: string; name: string; ownershipPct: number }[]
  tenants:         { id: string; name: string; phone: string | null; isPrimary: boolean }[]
  property:        { id: string; address: string; propertyType: string } | null
}

export async function getContractDetail(id: string): Promise<ContractDetail | null> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('contracts')
    .select(`
      id, status, current_rent, initial_rent, expensas, currency, cadence, indexer,
      start_date, end_date, next_adjustment_date, payment_day, notes,
      contract_landlords(ownership_pct, landlords(id, name)),
      contract_tenants(is_primary, tenants(id, name, phone)),
      properties(id, address, property_type)
    `)
    .eq('id', id)
    .single()

  if (!data) return null
  const c = data as any

  return {
    id:              c.id,
    status:          c.status,
    currentRent:     Number(c.current_rent),
    initialRent:     Number(c.initial_rent),
    expensas:        Number(c.expensas ?? 0),
    currency:        c.currency,
    cadence:         c.cadence,
    indexer:         c.indexer,
    startDate:       c.start_date,
    endDate:         c.end_date,
    nextAdjustmentDate: c.next_adjustment_date,
    paymentDay:      c.payment_day,
    notes:           c.notes,
    landlords:       (c.contract_landlords ?? []).map((cl: any) => ({
      id:           cl.landlords.id,
      name:         cl.landlords.name,
      ownershipPct: Number(cl.ownership_pct),
    })),
    tenants: (c.contract_tenants ?? []).map((ct: any) => ({
      id:        ct.tenants.id,
      name:      ct.tenants.name,
      phone:     ct.tenants.phone,
      isPrimary: ct.is_primary,
    })),
    property: c.properties
      ? { id: c.properties.id, address: c.properties.address, propertyType: c.properties.property_type }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Liquidación embudo per period
// ---------------------------------------------------------------------------
export interface LiquidacionEmbudo {
  period:         string
  rent:           number   // RENT_IN sum
  recoveries:     { label: string; amount: number; typeCode: string }[]  // TASA, CAMUZZI, etc.
  recoveriesTotal: number
  totalIn:        number   // rent + recoveries
  commission:     { destination: string; amount: number }[]
  commissionTotal: number
  otherOut:       number   // OTHER_OUT sum (real deductions)
  landlordPayout: number   // LANDLORD_PAYOUT sum
}

const RECOVERY_TYPES = new Set([
  'ABL_OUT', 'AYSA_OUT', 'EDESUR_OUT', 'METROGAS_OUT', 'AFIP_OUT',
  'REPAIR_OUT', 'LEGAL_OUT', 'INSURANCE_OUT', 'BANK_FEE_OUT',
])
const RECOVERY_LABEL: Record<string, string> = {
  ABL_OUT:       'ABL / Tasas',
  AYSA_OUT:      'AySA',
  EDESUR_OUT:    'Electricidad',
  METROGAS_OUT:  'Gas',
  AFIP_OUT:      'AFIP',
  REPAIR_OUT:    'Reparaciones',
  LEGAL_OUT:     'Honorarios legales',
  INSURANCE_OUT: 'Seguro',
  BANK_FEE_OUT:  'Gastos bancarios',
}

function destinationFromDescription(d: string | null): string {
  const s = d ?? ''
  if (s.includes('ADM_GALICIA'))      return 'ADM Galicia'
  if (s.includes('ADM_FRANCES_50_9')) return 'BBVA Francés 50/9'
  if (s.includes('ADM_FRANCES_51_6')) return 'BBVA Francés 51/6'
  return 'Sin destino'
}

export async function getEmbudoForContract(
  contractId: string,
  period: string,
): Promise<LiquidacionEmbudo> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('transactions')
    .select('amount, description, transaction_types!inner(code, label)')
    .eq('contract_id', contractId)
    .eq('period', period)

  const embudo: LiquidacionEmbudo = {
    period,
    rent:            0,
    recoveries:      [],
    recoveriesTotal: 0,
    totalIn:         0,
    commission:      [],
    commissionTotal: 0,
    otherOut:        0,
    landlordPayout:  0,
  }

  const recoveryMap = new Map<string, number>()
  const commissionMap = new Map<string, number>()

  for (const tx of (data ?? []) as any[]) {
    const code = tx.transaction_types.code as string
    const amount = Number(tx.amount)
    if (code === 'RENT_IN' || code === 'OTHER_IN') {
      embudo.rent += amount
    } else if (RECOVERY_TYPES.has(code)) {
      recoveryMap.set(code, (recoveryMap.get(code) ?? 0) + amount)
    } else if (code === 'COMMISSION_OUT') {
      const dest = destinationFromDescription(tx.description)
      commissionMap.set(dest, (commissionMap.get(dest) ?? 0) + amount)
      embudo.commissionTotal += amount
    } else if (code === 'OTHER_OUT') {
      embudo.otherOut += amount
    } else if (code === 'LANDLORD_PAYOUT') {
      embudo.landlordPayout += amount
    }
  }

  embudo.recoveries = [...recoveryMap.entries()]
    .map(([typeCode, amount]) => ({ typeCode, label: RECOVERY_LABEL[typeCode] ?? typeCode, amount }))
    .sort((a, b) => b.amount - a.amount)
  embudo.recoveriesTotal = embudo.recoveries.reduce((s, r) => s + r.amount, 0)
  embudo.totalIn = embudo.rent + embudo.recoveriesTotal
  embudo.commission = [...commissionMap.entries()]
    .map(([destination, amount]) => ({ destination, amount }))
    .sort((a, b) => b.amount - a.amount)

  return embudo
}

// Periods that this specific contract has activity in
export async function getContractPeriods(contractId: string): Promise<string[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select('period')
    .eq('contract_id', contractId)
    .not('period', 'is', null)
  const seen = new Set<string>()
  for (const r of (data ?? []) as any[]) if (r.period) seen.add(r.period)
  return [...seen].sort().reverse()
}
