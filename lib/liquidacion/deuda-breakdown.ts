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
// V1 assumptions (explicit so future-me can revisit):
//   • Carryover scans the last 3 prior periods (CARRYOVER_PERIODS).
//   • Historical rent assumed = contracts.current_rent for every prior
//     period. Walking the adjustments table is more accurate but heavier;
//     the popover footnote flags the assumption to the encargada.
//   • Intereses = totalDebt × rate% × (daysOverdue / 30). Monthly
//     proportional. Compound / daily formulas land in a follow-up if
//     Alejandro tells us his actual convention.
//   • Display only — does NOT auto-create LATE_FEE_IN. The encargada
//     decides whether to charge inside the popover (toggle) and records
//     it manually via the Movs. modal.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { periodLabel, getArgentinaToday } from '@/lib/period'

export const CARRYOVER_PERIODS = 3
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

  const { data: txns } = await supabase
    .from('transactions')
    .select('contract_id, amount, period, transaction_types!inner(code)')
    .in('contract_id', contractIds)
    .in('period', allPeriods)
    .eq('transaction_types.code', 'RENT_IN')

  // Bucket: (contractId|period) → sum
  const cobradoByKey = new Map<string, number>()
  for (const t of (txns ?? []) as any[]) {
    const key = `${t.contract_id}|${t.period}`
    cobradoByKey.set(key, (cobradoByKey.get(key) ?? 0) + Number(t.amount))
  }

  for (const c of contracts) {
    const cobradoThisPeriod = cobradoByKey.get(`${c.id}|${period}`) ?? 0
    const deudaCurrent = Math.max(0, c.currentRent - cobradoThisPeriod)

    const carryover: DeudaCarryoverEntry[] = []
    for (const p of priors) {
      if (c.startDate && p < c.startDate) continue
      const cobrado = cobradoByKey.get(`${c.id}|${p}`) ?? 0
      const deuda   = Math.max(0, c.currentRent - cobrado)
      carryover.push({
        period:       p,
        periodLabel:  periodLabel(p),
        expectedRent: c.currentRent,
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
      expectedRent:        c.currentRent,
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
    .select('id, current_rent, payment_day, start_date, late_interest_enabled, late_interest_rate')
    .eq('id', contractId)
    .maybeSingle()
  if (!c) return null

  const map = await buildDeudaBreakdownsBulk(
    [{
      id:                  (c as any).id,
      currentRent:         Number((c as any).current_rent ?? 0),
      paymentDay:          Number((c as any).payment_day ?? 5),
      startDate:           (c as any).start_date ?? null,
      lateInterestEnabled: (c as any).late_interest_enabled === true,
      lateInterestRate:    Number((c as any).late_interest_rate ?? 0),
    }],
    period,
  )
  return map.get((c as any).id) ?? null
}
