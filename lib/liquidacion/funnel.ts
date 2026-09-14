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
  /**
   * Subtotal de DEPOSIT_IN, YA CONTADO adentro de `ingresos`.
   *
   * El deposito en garantia se le transfiere al propietario como cualquier otro
   * cobro — Alejandro, 2026-09-14: "se lo mandamos al propietario, previa
   * deduccion de la administracion" — asi que pertenece a `ingresos` siempre.
   * Lo que cambia segun el acuerdo con cada dueño es si la comision lo alcanza
   * o no, y eso lo resuelve commissionBaseOf() restando este subtotal.
   *
   * Se guarda como subconjunto de `ingresos` a proposito: asi la resta nunca
   * puede dejar una base negativa por este motivo.
   */
  depositoIn: number
}

/** Lo unico que necesita la formula de transferencia. El deposito no entra:
 *  se transfiere igual, lo cobre o no la comision. */
type TransferBuckets = Pick<FunnelBuckets, 'ingresos' | 'admi' | 'otros'>

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

/** The RECORD of the transfer to the owner — never an input to the funnel. */
export const PAYOUT_TYPE_CODE = 'LANDLORD_PAYOUT'

/** Deposito en garantia cobrado al inquilino. */
export const DEPOSIT_TYPE_CODE = 'DEPOSIT_IN'

export type FunnelBucket = 'ingresos' | 'admi' | 'otros'

/**
 * THE classification rule: which bucket (if any) a transaction type falls in.
 *
 * Extracted 2026-09-15 because the rule was written out twice — here and in the
 * bulk fold in lib/liquidacion/queries.ts — and the two copies did not say the
 * same thing. `accumulateFunnel` skipped every row whose type is not
 * `affects_liquidacion` before looking at anything else; the bulk fold added
 * COMMISSION_OUT to `admi` WITHOUT that guard. They agree today only because
 * COMMISSION_OUT happens to be flagged true in the catalogue. Flip that flag and
 * the planilla and the commission writer would silently disagree about the fee —
 * exactly the drift the canonical funnel exists to prevent.
 *
 * The two accumulators cannot become one function: this one takes a 3-field row
 * and returns 3 numbers, while the bulk fold produces 13 values per contract
 * from rows carrying id / description / bank_date / label, folded across every
 * contract in a single pass. Different data, different output — a separate
 * layer, not a duplicate. What they share is the DECISION, and now it lives
 * here alone.
 *
 * LANDLORD_PAYOUT is excluded BY CODE rather than only by affects_liquidacion.
 * It is the record of the transfer, not an input to it, so folding it into
 * `otros` would hide a wrong or partial transfer instead of letting the
 * validators flag it. Keying on the code means a catalogue edit cannot cause
 * that silently.
 */
export function funnelBucketOf(
  type: FunnelTxnRow['transaction_types'],
): FunnelBucket | null {
  if (!type) return null
  if (type.code === PAYOUT_TYPE_CODE) return null
  if (!type.affects_liquidacion) return null
  if (type.direction === 'IN') return 'ingresos'
  if (type.code === ADMI_TYPE_CODE) return 'admi'
  return 'otros'
}

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
  const buckets: FunnelBuckets = { ingresos: 0, admi: 0, otros: 0, depositoIn: 0 }
  for (const row of rows ?? []) {
    const bucket = funnelBucketOf(row?.transaction_types)
    if (!bucket) continue
    const amount = Number(row.amount) || 0
    buckets[bucket] += amount
    // Subtotal del deposito, SIEMPRE adentro de ingresos (ver FunnelBuckets).
    if (bucket === 'ingresos' && row.transaction_types?.code === DEPOSIT_TYPE_CODE) {
      buckets.depositoIn += amount
    }
  }
  return buckets
}

/**
 * La base sobre la que se cobra la administracion.
 *
 * Alejandro, 2026-09-14: el deposito en garantia se le transfiere al
 * propietario previa deduccion de la administracion — o sea que por defecto la
 * comision SI lo alcanza — pero "hay algun caso que nos pelea para que no le
 * cobremos". Esa concesion es por contrato (contracts.commission_on_deposit).
 *
 * La regla se aplica ACA y no adentro del acumulador a proposito: el acumulador
 * clasifica y no sabe nada de los acuerdos de cada dueño. Asi la politica queda
 * en un solo lugar y el mismo balde sirve para todos los contratos.
 *
 * `onDeposit = true` devuelve exactamente `ingresos`, o sea el comportamiento
 * historico. Mientras no exista ninguna fila DEPOSIT_IN, `depositoIn` es 0 y
 * las dos ramas dan lo mismo.
 */
export function commissionBaseOf(
  b: Pick<FunnelBuckets, 'ingresos' | 'depositoIn'>,
  onDeposit: boolean,
): number {
  return onDeposit ? b.ingresos : b.ingresos - b.depositoIn
}

/**
 * Everything deducted from what was collected, before ajustes.
 * Persisted as `liquidaciones.total_deductions`.
 */
export function funnelDeductions(b: TransferBuckets): number {
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
export function funnelTransferencia(b: TransferBuckets, adjustment = 0): number {
  return b.ingresos - b.admi - b.otros + adjustment
}
