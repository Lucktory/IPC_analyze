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
import { classifyDestination } from '@/lib/reconciliation/queries'

// ── Cadence helpers — mirrors the function in lib/pending/queries.ts so
// the orange-highlight rule (aumento ≤30d) uses the SAME logic as the
// Pendientes bell. Don't divergent — refactor to a shared module if a third
// caller appears.
const CADENCE_MONTHS: Record<string, number> = {
  mensual: 1, bimestral: 2, trimestral: 3, cuatrimestral: 4, semestral: 6, anual: 12,
}
function nextAdjustmentDate(startDate: string, cadence: string, today: Date): Date | null {
  const months = CADENCE_MONTHS[cadence]
  if (!months) return null
  const next = new Date(startDate)
  let safety = 1000
  while (next <= today && safety-- > 0) next.setMonth(next.getMonth() + months)
  return safety > 0 ? next : null
}

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

// ============================================================================
// 19-column grid row — Alejandro's wide spreadsheet view. Mirrors the
// exact column structure in scripts/import-from-sheet.ts (his current Excel).
// ============================================================================
export interface LiquidacionGridRow {
  /** For row navigation. */
  contractId:           string
  landlordId:           string
  hasMultipleLandlords: boolean

  // ── Identity columns (left side, sticky) ──
  observacion:   string | null   // liquidaciones.notes
  lfa:           string | null   // contracts.lfa_code
  propietario:   string          // primary landlord name
  inquilino:     string          // primary tenant name
  contrato:      string | null   // contracts.contract_number

  // ── Period info ──
  periodo:       string          // period date
  expensas:      number | null   // contracts.expensas (monthly)

  // ── Cobro side (light gray until fechaBanco set, then dark gray) ──
  fechaBanco:    string | null   // max(RENT_IN.bank_date)
  ingresos:      number          // sum IN affects_liquidacion
  deuda:         number          // current_rent - ingresos (positive = owed)

  // ── Transfer side (light gray until diaTransf set, then dark gray) ──
  diaTransf:     string | null   // max(LANDLORD_PAYOUT.bank_date)
  transferencia: number          // computed: ingresos - admi - otros + adjustment
  otros:         number          // sum OUT (≠ COMMISSION_OUT) affects_liquidacion

  // ── Commission breakdown (3 destinations stay SEPARATE per Alejandro's spec) ──
  pct:           number          // effective % = admi / ingresos × 100
  admi:          number          // sum COMMISSION_OUT
  admGalicia:    number
  admFrances509: number
  admFrances516: number

  // ── Highlight flags ──
  /** True when the contract's nextAdjustmentDate is within 30 days. Drives
   *  the light-orange background on the INGRESOS cell. */
  hasUpcomingAdjustment: boolean
  daysUntilAdjustment:   number | null

  // ── Liquidación record state (gray/green/blue badge) ──
  status:            LiquidacionStatus
  adjustmentAmount:  number   // signed manual adjustment from observaciones
  liquidacionId:     string | null
  sentAt:            string | null
  paidAt:            string | null

  // ── Current contract rent (used to compute DEUDA) ──
  currentRent:       number

  // ── Vigencia (for the CONTRATO column in the 19-col layout) ──
  startDate:         string | null
  endDate:           string | null

  // ── Recently-edited marker — true when contracts.updated_at is within
  //    the last 5 minutes. Drives a yellow tint on the row so the
  //    encargada can find what she just touched without having the table
  //    re-sort under her feet. Default sort stays alphabetical by
  //    propietario (Alejandro's explicit ask).
  wasRecentlyEdited: boolean
}

// ── Rich grid query — returns all 19 columns per row ───────────────────────
export async function getLiquidacionGridForPeriod(period: string): Promise<LiquidacionGridRow[]> {
  const supabase = await createSupabaseServer()
  const today = new Date()

  const [contractsRes, txnsRes, liqsRes] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, status, contract_number, lfa_code, expensas, current_rent,
        cadence, start_date, end_date, created_at, updated_at,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(id, name))
      `)
      .eq('status', 'active'),
    supabase
      .from('transactions')
      .select(`
        amount, contract_id, bank_date, description,
        transaction_types!inner(code, direction, affects_liquidacion)
      `)
      .eq('period', period),
    supabase
      .from('liquidaciones')
      .select('id, contract_id, landlord_id, status, sent_at, paid_at, notes, adjustment_amount')
      .eq('period', period),
  ])

  // ── Aggregate transactions per contract ──
  interface Agg {
    ingresos:    number
    admi:        number
    otros:       number
    payout:      number
    galicia:     number
    frances509:  number
    frances516:  number
    fechaBanco:  string | null   // latest RENT_IN bank_date
    diaTransf:   string | null   // latest LANDLORD_PAYOUT bank_date
  }
  const blank = (): Agg => ({
    ingresos: 0, admi: 0, otros: 0, payout: 0, galicia: 0, frances509: 0, frances516: 0,
    fechaBanco: null, diaTransf: null,
  })
  const agg = new Map<string, Agg>()

  for (const t of (txnsRes.data ?? []) as any[]) {
    if (!t.contract_id) continue
    const entry = agg.get(t.contract_id) ?? blank()
    const typ = t.transaction_types
    const amt = Number(t.amount)

    if (typ.code === 'RENT_IN') {
      if (typ.affects_liquidacion) entry.ingresos += amt
      if (t.bank_date && (!entry.fechaBanco || t.bank_date > entry.fechaBanco)) {
        entry.fechaBanco = t.bank_date
      }
    } else if (typ.affects_liquidacion && typ.direction === 'IN') {
      entry.ingresos += amt
    } else if (typ.code === 'COMMISSION_OUT') {
      entry.admi += amt
      const dest = classifyDestination(t.description ?? null)
      if      (dest === 'ADM_GALICIA')      entry.galicia    += amt
      else if (dest === 'ADM_FRANCES_50_9') entry.frances509 += amt
      else if (dest === 'ADM_FRANCES_51_6') entry.frances516 += amt
    } else if (typ.code === 'LANDLORD_PAYOUT') {
      entry.payout += amt
      if (t.bank_date && (!entry.diaTransf || t.bank_date > entry.diaTransf)) {
        entry.diaTransf = t.bank_date
      }
    } else if (typ.affects_liquidacion && typ.direction === 'OUT') {
      entry.otros += amt
    }
    agg.set(t.contract_id, entry)
  }

  // Index persisted liquidación rows by (contract|landlord)
  const liqByKey = new Map<string, any>()
  for (const l of (liqsRes.data ?? []) as any[]) {
    liqByKey.set(`${l.contract_id}|${l.landlord_id}`, l)
  }

  const rows: LiquidacionGridRow[] = []
  for (const c of (contractsRes.data ?? []) as any[]) {
    const landlords = (c.contract_landlords ?? []) as any[]
    if (landlords.length === 0) continue
    const primary = [...landlords].sort(
      (a, b) => Number(b.ownership_pct ?? 0) - Number(a.ownership_pct ?? 0),
    )[0]
    if (!primary?.landlords) continue

    const tenant = (c.contract_tenants ?? []).find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]

    const a = agg.get(c.id) ?? blank()
    const currentRent = Number(c.current_rent ?? 0)
    const deuda       = Math.max(0, currentRent - a.ingresos)

    // Aumento próximo: reuse same function the Pendientes bell uses
    const nextAdj    = c.start_date && c.cadence ? nextAdjustmentDate(c.start_date, c.cadence, today) : null
    const msUntilAdj = nextAdj ? nextAdj.getTime() - today.getTime() : null
    const daysUntilAdjustment = msUntilAdj != null ? Math.ceil(msUntilAdj / 86400000) : null
    const hasUpcomingAdjustment = daysUntilAdjustment != null && daysUntilAdjustment >= 0 && daysUntilAdjustment <= 30

    const liq        = liqByKey.get(`${c.id}|${primary.landlords.id}`)
    const adjustment = Number(liq?.adjustment_amount ?? 0)

    // Transferencia (computed) = ingresos - admi - otros + adjustment (signed)
    // Use the actual LANDLORD_PAYOUT if it exists, else fall back to computed.
    const transferencia = a.payout > 0 ? a.payout : Math.max(0, a.ingresos - a.admi - a.otros + adjustment)

    const pct = a.ingresos > 0 ? (a.admi / a.ingresos) * 100 : 0

    rows.push({
      contractId:           c.id,
      landlordId:           primary.landlords.id,
      hasMultipleLandlords: landlords.length > 1,
      observacion:   liq?.notes ?? null,
      lfa:           c.lfa_code ?? null,
      propietario:   primary.landlords.name ?? '(sin propietario)',
      inquilino:     tenant?.tenants?.name ?? '(sin inquilino)',
      contrato:      c.contract_number ?? null,
      periodo:       period,
      expensas:      c.expensas != null ? Number(c.expensas) : null,
      fechaBanco:    a.fechaBanco,
      ingresos:      a.ingresos,
      deuda,
      diaTransf:     a.diaTransf,
      transferencia,
      otros:         a.otros,
      pct,
      admi:          a.admi,
      admGalicia:    a.galicia,
      admFrances509: a.frances509,
      admFrances516: a.frances516,
      hasUpcomingAdjustment,
      daysUntilAdjustment,
      status:        (liq?.status ?? 'draft') as LiquidacionStatus,
      adjustmentAmount: adjustment,
      liquidacionId: liq?.id ?? null,
      sentAt:        liq?.sent_at ?? null,
      paidAt:        liq?.paid_at ?? null,
      currentRent,
      startDate:     c.start_date ?? null,
      endDate:       c.end_date   ?? null,
      wasRecentlyEdited: (() => {
        // True if the contract's updated_at (or created_at as fallback)
        // is within the last 5 minutes — used to tint the row yellow on
        // the planilla so the encargada can see what she just touched
        // WITHOUT the sort order shifting underneath her.
        const stamp = c.updated_at ?? c.created_at
        if (!stamp) return false
        const ageMs = today.getTime() - new Date(stamp).getTime()
        return ageMs >= 0 && ageMs < 5 * 60 * 1000
      })(),
    })
  }

  // Default sort: alphabetical by propietario (Alejandro's explicit ask
  // — "que sea por orden alfabético de los propietarios"). The
  // recently-edited row is highlighted in yellow on the grid instead of
  // floating to the top.
  return rows.sort((a, b) => {
    const cmp = a.propietario.localeCompare(b.propietario, 'es-AR', { sensitivity: 'base' })
    if (cmp !== 0) return cmp
    return a.inquilino.localeCompare(b.inquilino, 'es-AR', { sensitivity: 'base' })
  })
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
