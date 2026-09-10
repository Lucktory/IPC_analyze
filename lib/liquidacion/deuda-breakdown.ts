// ============================================================================
// Deuda breakdown — per-contract debt computation with carryover + intereses.
//
// Surfaces both per-row on the planilla (via the inline cell + popover) and
// as an embedded section on /contratos/[id], so the data shape and the
// presentational component (DeudaBreakdownPanel) live globally.
//
// Per Alejandro 2026-06-18: he wants the Deuda cell to expand into a sub-
// solapa showing what makes up the debt — this period's unpaid rent +
// arrastrado + (optional) intereses por mora.
//
// Assumptions (explicit so future-me can revisit):
//   • Carryover scans the last 12 prior periods (CARRYOVER_PERIODS), bounded
//     three ways: the contract's start_date, its own first recorded month
//     (anything earlier predates the import), and whether the month was
//     loaded AT ALL across the book. That last one matters: a month nobody
//     has loaded yet looks exactly like a month nobody paid, and treating it
//     as debt invents it for every contract simultaneously.
//   • Historical rent comes from the `adjustments` table: a past month is
//     valued at the rent in force THEN, not at today's. (Until 2026-09-10 this
//     used current_rent for every prior period, which over-stated the debt of
//     any contract that had since had an increase.)
//   • Intereses = totalDebt × rate% × (daysOverdue / 30). Monthly
//     proportional. Compound / daily formulas land in a follow-up if
//     Alejandro tells us his actual convention.
//   • Display only — does NOT auto-create LATE_FEE_IN. The encargada
//     decides whether to charge inside the popover (toggle) and records
//     it manually via the Movs. modal.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { periodLabel, getArgentinaToday } from '@/lib/period'
import { getLiveRent } from '@/lib/contract/live-rent'

// 12 months back. Alejandro, 2026-09-10: "Si debe 12 meses... de alguna manera
// lo tengo que saber. Pensa que esta es la herramienta donde yo voy a depositar
// mi confianza." Was 3, which silently hid anything older than a quarter.
export const CARRYOVER_PERIODS = 12

/** PostgREST returns at most ~1000 rows per request. 12 periods x ~100
 *  contracts x several transactions each blows past that, and the failure is
 *  SILENT truncation — which here would UNDER-report debt, the exact opposite
 *  of what this feature is for. So the window fetch pages explicitly. */
const PAGE_SIZE = 1000
const DAYS_PER_MONTH = 30

export interface DeudaCarryoverEntry {
  /** YYYY-MM-DD start-of-month of the prior period. */
  period:        string
  periodLabel:   string
  expectedRent:  number
  cobrado:       number
  /** max(0, expectedRent - cobrado). */
  deuda:         number
}

export interface DeudaBreakdown {
  contractId:          string
  period:              string
  expectedRent:        number
  cobradoThisPeriod:   number
  deudaCurrent:        number
  carryover:           DeudaCarryoverEntry[]
  deudaCarryover:      number
  /** Days past the contract's payment_day for THIS period. 0 when not overdue. */
  daysOverdue:         number
  lateInterestEnabled: boolean
  lateInterestRate:    number
  /** Computed estimate when applied — `(deuda × rate × daysOverdue / 30)`. */
  interesesEstimado:   number
}

/** Enumerate prior period start-of-month strings, N months back from `period`. */
export function priorPeriods(period: string, n: number): string[] {
  const [y, m] = period.split('-')
  let year  = Number(y)
  let month = Number(m)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    month--
    if (month <= 0) { month = 12; year-- }
    out.push(`${year}-${String(month).padStart(2, '0')}-01`)
  }
  return out
}

/** Monthly proportional interest. Returns 0 for any non-positive input. */
export function computeIntereses(totalDebt: number, ratePct: number, daysOverdue: number): number {
  if (!isFinite(totalDebt) || totalDebt <= 0) return 0
  if (!isFinite(ratePct)   || ratePct   <= 0) return 0
  if (!isFinite(daysOverdue) || daysOverdue <= 0) return 0
  return Math.round(totalDebt * (ratePct / 100) * (daysOverdue / DAYS_PER_MONTH))
}

/** Days from today to the contract's due day for the given period, clamped to
 *  the last day of the month. Returns 0 when not yet due, positive when overdue. */
export function daysOverdueForPeriod(period: string, paymentDay: number): number {
  const [yStr, mStr] = period.split('-')
  const year  = Number(yStr)
  const month = Number(mStr)
  if (!isFinite(year) || !isFinite(month)) return 0
  const lastDay = new Date(year, month, 0).getDate()
  const day     = Math.min(Math.max(1, paymentDay), lastDay)
  const due     = new Date(year, month - 1, day)
  const today   = getArgentinaToday()
  const todayM  = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff    = Math.floor((todayM.getTime() - due.getTime()) / 86400000)
  return Math.max(0, diff)
}

/** Bulk-build breakdowns for many contracts in one Supabase round-trip. */
export async function buildDeudaBreakdownsBulk(
  contracts: Array<{
    id:                    string
    currentRent:           number
    /** Rent that actually applies THIS period (current_rent adjusted by an
     *  unapplied aumento) — the same value the planilla Alquiler cell shows.
     *  Falls back to currentRent when the caller doesn't compute it. */
    expectedRentCurrentPeriod?: number
    paymentDay:            number
    startDate:             string | null
    lateInterestEnabled:   boolean
    lateInterestRate:      number
  }>,
  period: string,
): Promise<Map<string, DeudaBreakdown>> {
  const supabase = await createSupabaseServer()
  const out = new Map<string, DeudaBreakdown>()
  if (contracts.length === 0) return out

  const priors = priorPeriods(period, CARRYOVER_PERIODS)
  const allPeriods = [period, ...priors]
  const contractIds = contracts.map(c => c.id)

  // Fetch every transaction in the window (all types) so we can tell which
  // (contract, period) pairs were actually LOADED. RENT_IN + RENT_NF_IN feed
  // the cobrado sum; the presence of ANY transaction marks the period as
  // tracked, so we don't invent debt for months that were never imported.
  const txns: any[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('contract_id, amount, period, transaction_types!inner(code)')
      .in('contract_id', contractIds)
      .in('period', allPeriods)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      // Loud on purpose. Swallowing this used to mean "no debt" — a wrong
      // answer that looks exactly like a right one.
      console.error('[buildDeudaBreakdownsBulk] transactions fetch failed:', error.message)
      break
    }
    txns.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  const cobradoByKey = new Map<string, number>()   // RENT_IN + RENT_NF_IN only
  // Earliest period this contract has ANY transaction for. Everything before
  // it predates the import and must not be counted as debt; everything from it
  // onward is a month the office actually worked, so a month with no rent row
  // there is genuinely unpaid — which is precisely what Alejandro asked to see.
  // (The previous rule skipped any period with no transactions at all, so a
  // month where the tenant simply paid nothing was invisible.)
  const firstTrackedPeriod = new Map<string, string>()
  for (const t of txns) {
    const key   = `${t.contract_id}|${t.period}`
    const prev  = firstTrackedPeriod.get(t.contract_id)
    if (!prev || t.period < prev) firstTrackedPeriod.set(t.contract_id, t.period)
    const ttRaw = t.transaction_types
    const code  = Array.isArray(ttRaw) ? ttRaw[0]?.code : ttRaw?.code
    if (code === 'RENT_IN' || code === 'RENT_NF_IN') {
      cobradoByKey.set(key, (cobradoByKey.get(key) ?? 0) + Number(t.amount))
    }
  }

  // Meses efectivamente CARGADOS, mirando el libro entero (no este contrato).
  //
  // Alejandro, 2026-09-11: "Va a figurar deuda en todos los contratos? Voy a
  // tener que liquidar Junio, Julio y Agosto?" — y tenia razon en preocuparse.
  //
  // "El mes se trabajo y el inquilino no pago" y "el mes todavia no se cargo"
  // se ven IGUAL en los datos: en los dos casos no hay fila de alquiler. Si se
  // asume impago, un mes sin cargar inventa deuda en los ~100 contratos a la
  // vez, y la unica forma de sacarsela de encima seria liquidar meses enteros
  // al pedo.
  //
  // Lo que distingue los dos casos es si el mes se cargo EN GENERAL: si en
  // todo el libro no hay un solo alquiler cobrado en julio, julio no se
  // trabajo y no cuenta para nadie. Si julio si esta cargado y a un contrato
  // le falta el alquiler, ese contrato realmente no pago — que es lo que hay
  // que mostrar.
  const loadedPeriods = new Set<string>()
  if (priors.length) {
    const { data: rentRows, error: rentErr } = await supabase
      .from('transactions')
      .select('period, transaction_types!inner(code)')
      .in('period', priors)
      .in('transaction_types.code', ['RENT_IN', 'RENT_NF_IN'])
      .limit(PAGE_SIZE)
    if (rentErr) console.error('[buildDeudaBreakdownsBulk] loaded-periods probe failed:', rentErr.message)
    for (const r of (rentRows ?? []) as any[]) loadedPeriods.add(r.period)
  }

  // Rent history — Alejandro, 2026-09-10: "El valor del mes viejo queda viejo".
  // Prior months must be valued at the rent in force THEN, not today's. The
  // `adjustments` table records every increase (old_rent → new_rent), so the
  // rent during a past period is the `old_rent` of the FIRST increase applied
  // at or after that period started. No increase after it → today's rent.
  //
  // Caveat, deliberate: persistAumento stamps `applied_at` with the click date,
  // not the effective date, so an increase clicked mid-month lands on that
  // month. Where that is ambiguous this resolves to the OLDER (lower) rent,
  // which under-states rather than over-states what a tenant owes.
  const adjustmentsByContract = new Map<string, Array<{ appliedAt: string; oldRent: number }>>()
  const { data: adjs, error: adjErr } = await supabase
    .from('adjustments')
    .select('contract_id, applied_at, old_rent')
    .in('contract_id', contractIds)
    .order('applied_at', { ascending: true })
  if (adjErr) console.error('[buildDeudaBreakdownsBulk] adjustments fetch failed:', adjErr.message)
  for (const a of (adjs ?? []) as any[]) {
    const list = adjustmentsByContract.get(a.contract_id) ?? []
    list.push({ appliedAt: String(a.applied_at), oldRent: Number(a.old_rent ?? 0) })
    adjustmentsByContract.set(a.contract_id, list)
  }
  const rentInForce = (contractId: string, p: string, fallback: number): number => {
    const list = adjustmentsByContract.get(contractId)
    if (!list?.length) return fallback
    const next = list.find(a => a.appliedAt >= p)   // ascending → first one at/after p
    return next ? next.oldRent : fallback
  }

  for (const c of contracts) {
    // Current period is measured against the rent that applies THIS period
    // (same value the Alquiler cell shows), so an unpaid aumento shows the right
    // debt and a cobro at the new value clears it. Prior periods are measured
    // against the rent in force in each of those months (see rentInForce).
    const expectedCurrent   = c.expectedRentCurrentPeriod ?? c.currentRent
    const cobradoThisPeriod = cobradoByKey.get(`${c.id}|${period}`) ?? 0
    const deudaCurrent = Math.max(0, expectedCurrent - cobradoThisPeriod)

    const carryover: DeudaCarryoverEntry[] = []
    const floor = firstTrackedPeriod.get(c.id)
    for (const p of priors) {
      if (c.startDate && p < c.startDate) continue
      // Before the contract's first recorded month = never imported, not
      // unpaid. Counting those invented huge phantom debt (a contract loaded
      // only from May showed Mar/Apr fully unpaid). From that month onward a
      // period with no rent row IS a genuinely unpaid month and counts.
      if (!floor || p < floor) continue
      // Mes no cargado en el libro → no es deuda de nadie, es un mes que
      // todavia no se trabajo. Sin esto, subir la ventana a 12 meses le
      // inventaba deuda a todos los contratos a la vez.
      if (!loadedPeriods.has(p)) continue
      const cobrado      = cobradoByKey.get(`${c.id}|${p}`) ?? 0
      const expectedThen = rentInForce(c.id, p, c.currentRent)
      const deuda        = Math.max(0, expectedThen - cobrado)
      carryover.push({
        period:       p,
        periodLabel:  periodLabel(p),
        expectedRent: expectedThen,
        cobrado,
        deuda,
      })
    }
    const deudaCarryover = carryover.reduce((s, e) => s + e.deuda, 0)

    const daysOverdue       = daysOverdueForPeriod(period, c.paymentDay)
    const totalDebt         = deudaCurrent + deudaCarryover
    const interesesEstimado = computeIntereses(totalDebt, c.lateInterestRate, daysOverdue)

    out.set(c.id, {
      contractId:          c.id,
      period,
      expectedRent:        expectedCurrent,
      cobradoThisPeriod,
      deudaCurrent,
      carryover,
      deudaCarryover,
      daysOverdue,
      lateInterestEnabled: c.lateInterestEnabled,
      lateInterestRate:    c.lateInterestRate,
      interesesEstimado,
    })
  }
  return out
}

/** Single-contract breakdown — used by the contract detail page. */
export async function getDeudaBreakdown(
  contractId: string,
  period:     string,
): Promise<DeudaBreakdown | null> {
  const supabase = await createSupabaseServer()
  const { data: c } = await supabase
    .from('contracts')
    .select('id, current_rent, payment_day, start_date, cadence, last_adjustment_date, created_at, late_interest_enabled, late_interest_rate')
    .eq('id', contractId)
    .maybeSingle()
  if (!c) return null

  // Current-period expected = the LIVE rent (current_rent carried forward by
  // IPC), the same value the planilla + contract page show.
  const expectedRentCurrentPeriod = await getLiveRent({
    id:                 (c as any).id,
    currentRent:        Number((c as any).current_rent ?? 0),
    cadence:            (c as any).cadence ?? null,
    startDate:          (c as any).start_date ?? null,
    lastAdjustmentDate: (c as any).last_adjustment_date ?? null,
    createdAt:          (c as any).created_at ?? null,
  }, period)

  const map = await buildDeudaBreakdownsBulk(
    [{
      id:                  (c as any).id,
      currentRent:         Number((c as any).current_rent ?? 0),
      expectedRentCurrentPeriod,
      paymentDay:          Number((c as any).payment_day ?? 5),
      startDate:           (c as any).start_date ?? null,
      lateInterestEnabled: (c as any).late_interest_enabled === true,
      lateInterestRate:    Number((c as any).late_interest_rate ?? 0),
    }],
    period,
  )
  return map.get((c as any).id) ?? null
}
