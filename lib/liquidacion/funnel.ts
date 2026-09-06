// ============================================================================
// Liquidacion funnel — THE canonical settlement formula.
//
//   TOTAL COBRADO  ─►  ADMI (comision)  ─►  OTROS (gastos)  ─►  TRANSFERENCIA
//
//   transferencia = ingresos - admi - otros + ajustes
//
// Why this module exists (2026-09-05)
// -----------------------------------
// The formula above was implemented in four places that did not agree:
//
//   lib/liquidacion/queries.ts      ingresos - admi - otros + adjustment   OK
//   lib/liquidacion/email-actions.ts (gross - commission - otros) + ajustes OK
//   lib/liquidacion/actions.ts       gross - (commission + otros)          NO ajustes
//   components/liquidacion/ResumenView.tsx
//                            max(0, ingresos - admi - otros)               NO ajustes, clamped
//
// The consequences were visible to the user: the "Transferido al propietario"
// tile on the Resumen tab disagreed with the Grilla footer on the same page by
// the period's total ajustes, and `liquidaciones.net_to_landlord` — the durable
// money column — never equalled the amount actually emailed and transferred.
//
// Everything that needs the funnel now routes through here, so the number can
// only be wrong in one place instead of drifting in four.
//
// Layering note: `accumulateFunnel` is the per-contract classifier over raw
// PostgREST rows. lib/liquidacion/queries.ts keeps its own bulk accumulator
// (it folds every contract's transactions in a single pass over one query) but
// takes its FORMULA from here. Same rule, different data source — that is a
// separate layer, not a duplicate.
// ============================================================================

/** The three buckets every liquidacion surface splits a period's money into. */
export interface FunnelBuckets {
  /** Sum of every affects_liquidacion transaction with direction IN. */
  ingresos: number
  /** COMMISSION_OUT only — the administration's fee. */
  admi: number
  /** Every other affects_liquidacion OUT row: expensas, ABL, servicios, etc. */
  otros: number
}

/** Raw PostgREST row shape shared by the callers that classify transactions. */
export interface FunnelTxnRow {
  amount: unknown
  transaction_types: {
    code: string
    direction: string
    affects_liquidacion: boolean
  } | null
}

/** Transaction type code that lands in the `admi` bucket rather than `otros`. */
export const ADMI_TYPE_CODE = 'COMMISSION_OUT'

/**
 * Classify one period's transaction rows into the three funnel buckets.
 *
 * Rows whose type is not `affects_liquidacion` are skipped entirely — deposits
 * (DEPOSIT_IN / DEPOSIT_REFUND), internal transfers and LANDLORD_PAYOUT do not
 * belong in the funnel. LANDLORD_PAYOUT in particular is the RECORD of the
 * transfer, not an input to it; substituting it here would hide a wrong or
 * partial transfer instead of letting the validators flag it.
 */
export function accumulateFunnel(rows: readonly FunnelTxnRow[] | null | undefined): FunnelBuckets {
  const buckets: FunnelBuckets = { ingresos: 0, admi: 0, otros: 0 }
  for (const row of rows ?? []) {
    const type = row?.transaction_types
    if (!type || !type.affects_liquidacion) continue
    const amount = Number(row.amount) || 0
    if (type.direction === 'IN') buckets.ingresos += amount
    else if (type.code === ADMI_TYPE_CODE) buckets.admi += amount
    else buckets.otros += amount
  }
  return buckets
}

/**
 * Everything deducted from what was collected, before ajustes.
 * Persisted as `liquidaciones.total_deductions`.
 */
export function funnelDeductions(b: FunnelBuckets): number {
  return b.admi + b.otros
}

/**
 * THE settlement figure: what the landlord is owed for the period.
 *
 * Per Alejandro's rule this number must be identical in the planilla column,
 * the recibo, the owner email and the actual transfer — so every one of those
 * surfaces must call this function rather than restate the arithmetic.
 *
 * `adjustment` is the signed owner-transfer adjustment: the legacy manual
 * `liquidaciones.adjustment_amount` plus the CONFIRMED (cobrado) arreglo/ajuste
 * events for the period. Rojo items still "a cobrar" are deliberately excluded
 * — rojo means due, cobrado means it happened.
 *
 * Deliberately NOT clamped at zero. A negative transferencia is real and
 * meaningful: it means the period's deductions exceeded what was collected and
 * the owner owes the administration. ResumenView used to clamp with
 * `Math.max(0, ...)`, which silently hid exactly that case from the summary
 * while the Grilla footer below it showed the true (negative) total.
 */
export function funnelTransferencia(b: FunnelBuckets, adjustment = 0): number {
  return b.ingresos - b.admi - b.otros + adjustment
}
