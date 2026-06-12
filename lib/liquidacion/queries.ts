// ============================================================================
// Liquidación queries — Alejandro's per-contract view of the embudo:
//
//    TOTAL COBRADO ──►  COMISIÓN ADMIN (%)  ──►  NETO AL PROPIETARIO
//                       OTROS DESCUENTOS  ──►
//
// Per Alejandro's confirmed requirements (2026-06-08):
//   • One consolidated line per (contract, period) — recuperos (CAMUZZI, ABL,
//     TASA, EXPENSAS) are aggregated into TOTAL COBRADO, NOT shown as
//     separate rows.
//   • Commission % is computed against TOTAL COBRADO (not just RENT_IN).
//   • Status workflow: draft → sent → paid.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export type LiquidacionStatus = 'draft' | 'sent' | 'paid'

export interface LiquidacionRow {
  contractId:          string
  /** Primary landlord (highest ownership_pct) — co-owned contracts pick one. */
  landlordId:          string
  tenantName:          string
  landlordName:        string

  /** Sum of IN transactions for the contract+period where affects_liquidacion=true. */
  totalCobrado:        number
  /** Sum of COMMISSION_OUT for the contract+period. */
  comisionAdmin:       number
  /** Sum of OUT transactions ≠ COMMISSION_OUT where affects_liquidacion=true. */
  otrosDescuentos:     number
  /** totalCobrado - comisionAdmin - otrosDescuentos. */
  netoAlPropietario:   number
  /** Effective rate: comisionAdmin / totalCobrado × 100. */
  comisionPct:         number

  /** True when the contract has co-owners — UI can flag this. */
  hasMultipleLandlords: boolean

  /** Persisted state from the `liquidaciones` table, if a row exists yet. */
  liquidacionId:       string | null
  status:              LiquidacionStatus
  sentAt:              string | null
  paidAt:              string | null
}

export interface LiquidacionDetailLine {
  transactionId: string
  direction:     'IN' | 'OUT'
  typeCode:      string
  typeLabel:     string
  amount:        number
  bankDate:      string | null
  description:   string | null
  /** True for the lines that contributed to the embudo. */
  affectsLiquidacion: boolean
}

export interface LiquidacionDetail extends Omit<LiquidacionRow, never> {
  period:          string
  notes:           string | null
  lines:           LiquidacionDetailLine[]
  administrationId: string
}

// ── List query — one row per active contract for the period ────────────────
export async function getLiquidacionesForPeriod(period: string): Promise<LiquidacionRow[]> {
  const supabase = await createSupabaseServer()

  const [contractsRes, txnsRes, liqsRes] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, status,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(id, name))
      `)
      .eq('status', 'active'),
    supabase
      .from('transactions')
      .select(`
        amount, contract_id,
        transaction_types!inner(code, direction, affects_liquidacion)
      `)
      .eq('period', period),
    supabase
      .from('liquidaciones')
      .select('id, contract_id, landlord_id, status, sent_at, paid_at')
      .eq('period', period),
  ])

  // Aggregate transactions per contract
  const agg = new Map<string, { gross: number; commission: number; otros: number }>()
  for (const t of (txnsRes.data ?? []) as any[]) {
    if (!t.contract_id) continue
    const typ = t.transaction_types
    if (!typ.affects_liquidacion) continue

    const entry = agg.get(t.contract_id) ?? { gross: 0, commission: 0, otros: 0 }
    if (typ.direction === 'IN') {
      entry.gross += Number(t.amount)
    } else if (typ.direction === 'OUT') {
      if (typ.code === 'COMMISSION_OUT') entry.commission += Number(t.amount)
      else                                entry.otros      += Number(t.amount)
    }
    agg.set(t.contract_id, entry)
  }

  // Index persisted liquidaciones by (contract_id|landlord_id)
  const liqByKey = new Map<string, any>()
  for (const l of (liqsRes.data ?? []) as any[]) {
    liqByKey.set(`${l.contract_id}|${l.landlord_id}`, l)
  }

  const rows: LiquidacionRow[] = []
  for (const c of (contractsRes.data ?? []) as any[]) {
    const landlords = (c.contract_landlords ?? []) as any[]
    if (landlords.length === 0) continue

    // Primary landlord = highest ownership_pct (deterministic tie-break: first match)
    const primary = [...landlords].sort(
      (a, b) => Number(b.ownership_pct ?? 0) - Number(a.ownership_pct ?? 0),
    )[0]
    if (!primary?.landlords) continue

    const tenant = (c.contract_tenants ?? []).find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]

    const a = agg.get(c.id) ?? { gross: 0, commission: 0, otros: 0 }
    const totalCobrado      = a.gross
    const comisionAdmin     = a.commission
    const otrosDescuentos   = a.otros
    const netoAlPropietario = totalCobrado - comisionAdmin - otrosDescuentos
    const comisionPct       = totalCobrado > 0 ? (comisionAdmin / totalCobrado) * 100 : 0

    const liq = liqByKey.get(`${c.id}|${primary.landlords.id}`)
    rows.push({
      contractId:           c.id,
      landlordId:           primary.landlords.id,
      tenantName:           tenant?.tenants?.name ?? '(sin inquilino)',
      landlordName:         primary.landlords.name ?? '(sin propietario)',
      totalCobrado, comisionAdmin, otrosDescuentos, netoAlPropietario, comisionPct,
      hasMultipleLandlords: landlords.length > 1,
      liquidacionId:        liq?.id ?? null,
      status:               (liq?.status ?? 'draft') as LiquidacionStatus,
      sentAt:               liq?.sent_at ?? null,
      paidAt:               liq?.paid_at ?? null,
    })
  }

  return rows.sort((a, b) => b.totalCobrado - a.totalCobrado)
}

// ── Detail query — embudo + per-transaction breakdown ──────────────────────
export async function getLiquidacionDetail(
  contractId: string,
  period:     string,
): Promise<LiquidacionDetail | null> {
  const supabase = await createSupabaseServer()

  const [contractRes, txnsRes] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, administration_id,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(id, name))
      `)
      .eq('id', contractId)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select(`
        id, amount, bank_date, description,
        transaction_types!inner(code, label, direction, affects_liquidacion)
      `)
      .eq('contract_id', contractId)
      .eq('period', period)
      .order('bank_date', { ascending: true, nullsFirst: false }),
  ])

  if (!contractRes.data) return null
  const c = contractRes.data as any

  const landlords = (c.contract_landlords ?? []) as any[]
  if (landlords.length === 0) return null

  const primary = [...landlords].sort(
    (a, b) => Number(b.ownership_pct ?? 0) - Number(a.ownership_pct ?? 0),
  )[0]
  if (!primary?.landlords) return null

  const tenant = (c.contract_tenants ?? []).find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]

  let totalCobrado = 0, comisionAdmin = 0, otrosDescuentos = 0
  const lines: LiquidacionDetailLine[] = []
  for (const t of (txnsRes.data ?? []) as any[]) {
    const typ = t.transaction_types
    const affects = !!typ.affects_liquidacion
    if (affects) {
      if (typ.direction === 'IN') totalCobrado += Number(t.amount)
      else if (typ.code === 'COMMISSION_OUT') comisionAdmin += Number(t.amount)
      else                                    otrosDescuentos += Number(t.amount)
    }
    lines.push({
      transactionId:      t.id,
      direction:          typ.direction,
      typeCode:           typ.code,
      typeLabel:          typ.label,
      amount:             Number(t.amount),
      bankDate:           t.bank_date,
      description:        t.description,
      affectsLiquidacion: affects,
    })
  }
  const netoAlPropietario = totalCobrado - comisionAdmin - otrosDescuentos
  const comisionPct       = totalCobrado > 0 ? (comisionAdmin / totalCobrado) * 100 : 0

  // Persisted state
  const { data: liq } = await supabase
    .from('liquidaciones')
    .select('id, status, sent_at, paid_at, notes')
    .eq('contract_id', contractId)
    .eq('landlord_id', primary.landlords.id)
    .eq('period', period)
    .maybeSingle()

  return {
    contractId:           c.id,
    landlordId:           primary.landlords.id,
    administrationId:     c.administration_id,
    period,
    tenantName:           tenant?.tenants?.name ?? '(sin inquilino)',
    landlordName:         primary.landlords.name ?? '(sin propietario)',
    totalCobrado, comisionAdmin, otrosDescuentos, netoAlPropietario, comisionPct,
    hasMultipleLandlords: landlords.length > 1,
    liquidacionId:        (liq as any)?.id ?? null,
    status:               ((liq as any)?.status ?? 'draft') as LiquidacionStatus,
    sentAt:               (liq as any)?.sent_at ?? null,
    paidAt:               (liq as any)?.paid_at ?? null,
    notes:                (liq as any)?.notes ?? null,
    lines,
  }
}
