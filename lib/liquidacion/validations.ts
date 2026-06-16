// ============================================================================
// Per-row validations for the /liquidacion planilla (Phase 7A).
//
// Goal: catch typos and inconsistencies between cells BEFORE they cause
// money to leak. Each validator is a PURE FUNCTION of the row data — no
// DB access, no side effects, no state. The aggregator runs all of them
// against a single LiquidacionGridRow and returns the issues array, which
// gets attached to the row by getLiquidacionGridForPeriod and rendered as
// a per-row badge by ValidationBadgeCell.
//
// ──────────────────────────────────────────────────────────────────────────
// TUNING
// ──────────────────────────────────────────────────────────────────────────
// Every tolerance / threshold lives in VALIDATION_TOLERANCES below. To
// retune: change one number, redeploy, done. No other file needs to
// change. Default values are starting points based on Alejandro's
// business reality — adjust as real-world flagged issues come in.
// ============================================================================

import { fmtMoney } from '@/lib/format'

export const VALIDATION_TOLERANCES = {
  /** Allowed diff (in pesos) between recorded transferencia and computed. */
  TRANSFERENCIA_PESOS:      100,

  /** Allowed diff (in percentage points) between effective and contract pct. */
  COMMISSION_PP:            0.5,

  /** Allowed diff (in pesos) between ADMI total and sum of three destinations. */
  ADMI_DESTINATIONS_PESOS:  1,

  /** Rent variance vs current_rent (fraction). Below WARN = OK,
   *  WARN ≤ x < ERROR = warning, ≥ ERROR = error. */
  RENT_VARIANCE_WARN:       0.20,
  RENT_VARIANCE_ERROR:      0.50,
} as const

export interface ValidationIssue {
  /** Stable identifier for the rule (used for filtering, telemetry). */
  code:     ValidationCode
  severity: 'error' | 'warning'
  /** Human-readable Spanish message for the encargada. */
  message:  string
  /** What the system EXPECTED the value to be. */
  expected: number | null
  /** What the row ACTUALLY has. */
  actual:   number | null
  /** Absolute difference (for sorting / reporting). */
  diff:     number
}

export type ValidationCode =
  | 'TRANSFERENCIA_IMBALANCE'
  | 'TRANSFERENCIA_NEGATIVE'
  | 'PAID_STATUS_INCONSISTENT'
  | 'BANK_DATES_OUT_OF_ORDER'
  | 'ADMI_DESTINATIONS_UNCLASSIFIED'
  | 'COMMISSION_PCT_DEVIATION'
  | 'RENT_AMOUNT_VARIANCE'

// ── Row shape the validators read. Keep it minimal — only the fields
//    actually used by the rules. Lets us evolve LiquidacionGridRow
//    without breaking validations.ts.
export interface ValidatableRow {
  ingresos:          number
  admi:              number
  otros:             number
  transferencia:     number
  adjustmentAmount:  number
  admGalicia:        number
  admFrances509:     number
  admFrances516:     number
  currentRent:       number
  pct:               number   // effective % shown in the cell (admi/ingresos*100)
  deuda:             number
  status:            'draft' | 'sent' | 'paid'
  fechaBanco:        string | null   // latest RENT_IN bank_date
  diaTransf:         string | null   // LANDLORD_PAYOUT bank_date
  /** Per-line breakdown from the Phase 6 popover. Used to derive the
   *  RENT_IN-only sum for the rent-amount check. */
  ingresosLines:     { typeCode: string; amount: number }[]
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDATORS — pure functions. Each returns null when the rule passes.
// ════════════════════════════════════════════════════════════════════════════

// 1. Transferencia balance — the most important check. The transfer to
//    the propietario must equal Ingresos − ADMI − Otros + Adjustment.
//    If it doesn't, the wrong amount was sent.
function checkTransferenciaBalance(r: ValidatableRow): ValidationIssue | null {
  if (r.transferencia <= 0) return null  // not yet transferred → not applicable
  const expected = r.ingresos - r.admi - r.otros + r.adjustmentAmount
  const diff = Math.abs(r.transferencia - expected)
  if (diff <= VALIDATION_TOLERANCES.TRANSFERENCIA_PESOS) return null
  return {
    code:     'TRANSFERENCIA_IMBALANCE',
    severity: 'error',
    message:  `Transferencia (${fmtMoney(r.transferencia)}) no balancea con Ingresos − ADMI − Otros + Ajuste (${fmtMoney(expected)}). Diferencia: ${fmtMoney(diff)}.`,
    expected,
    actual:   r.transferencia,
    diff,
  }
}

// 2. Transferencia non-negative — if the computed expected goes below
//    zero (e.g., huge negative adjustment), the math is broken.
function checkTransferenciaNonNegative(r: ValidatableRow): ValidationIssue | null {
  const expected = r.ingresos - r.admi - r.otros + r.adjustmentAmount
  if (expected >= 0) return null
  return {
    code:     'TRANSFERENCIA_NEGATIVE',
    severity: 'error',
    message:  `Transferencia esperada es negativa (${fmtMoney(expected)}). Revisá el ajuste o los descuentos.`,
    expected,
    actual:   r.transferencia,
    diff:     Math.abs(expected),
  }
}

// 3. status === 'paid' implies transferencia > 0 AND deuda === 0.
//    Marking a liquidación as paid without an actual transfer or with
//    outstanding debt is internally inconsistent.
function checkPaidStatusConsistency(r: ValidatableRow): ValidationIssue | null {
  if (r.status !== 'paid') return null
  const problems: string[] = []
  if (r.transferencia <= 0) problems.push('no hay transferencia registrada')
  if (r.deuda > 0)          problems.push(`hay deuda pendiente (${fmtMoney(r.deuda)})`)
  if (problems.length === 0) return null
  return {
    code:     'PAID_STATUS_INCONSISTENT',
    severity: 'error',
    message:  `Estado "pagada" pero ${problems.join(' y ')}. Revertí el estado o completá los datos.`,
    expected: null,
    actual:   null,
    diff:     0,
  }
}

// 4. Bank dates ordering — you can't transfer to the propietario before
//    you received the rent. Time-travel detection.
function checkBankDatesOrdering(r: ValidatableRow): ValidationIssue | null {
  if (!r.diaTransf || !r.fechaBanco) return null
  if (r.diaTransf >= r.fechaBanco) return null
  return {
    code:     'BANK_DATES_OUT_OF_ORDER',
    severity: 'warning',
    message:  `Día de transferencia (${r.diaTransf}) es ANTERIOR a la fecha del cobro (${r.fechaBanco}). Verificá el orden cronológico.`,
    expected: null,
    actual:   null,
    diff:     0,
  }
}

// 5. ADMI total vs sum of three destinations. If ADMI > destination sum,
//    there are COMMISSION_OUT rows with a description that doesn't
//    contain a recognized marker (ADM_GALICIA / ADM_FRANCES_50_9 /
//    ADM_FRANCES_51_6). The encargada can't reconcile against the bank
//    statement until every commission has a known destination.
function checkAdmiDestinationsClassification(r: ValidatableRow): ValidationIssue | null {
  if (r.admi <= 0) return null  // no commissions yet → not applicable
  const sum = r.admGalicia + r.admFrances509 + r.admFrances516
  const diff = r.admi - sum   // positive = there's an unclassified bucket
  if (diff <= VALIDATION_TOLERANCES.ADMI_DESTINATIONS_PESOS) return null
  return {
    code:     'ADMI_DESTINATIONS_UNCLASSIFIED',
    severity: 'warning',
    message:  `Hay ${fmtMoney(diff)} en ADMI sin marcador de destino (Galicia / BBVA 50/9 / BBVA 51/6). Verificá la descripción de las comisiones.`,
    expected: r.admi,
    actual:   sum,
    diff,
  }
}

// 6. Commission % deviation. If the effective commission percentage
//    differs from the contract's commission_pct by more than the
//    tolerance, money was likely under-charged or over-charged.
function checkCommissionPctDeviation(r: ValidatableRow): ValidationIssue | null {
  if (r.ingresos <= 0 || r.admi <= 0) return null  // not enough data
  // r.pct here is the EFFECTIVE pct (admi/ingresos*100). For the contract
  // pct we need the original value. We pass it as currentRent's sibling
  // — but actually it's already what r.pct is in the grid query (effective).
  // The contract pct lives elsewhere. For this validator we compare the
  // effective vs the expected from contracts.commission_pct, which the
  // caller passes via a separate path. Without it we can't run this rule
  // here — skip. (The grid query has access; it can run a richer version
  // by passing both effective and contract pct. We treat r.pct as the
  // effective and the comparison happens at the higher layer.)
  // For now: skip — this rule is implemented in the grid query's
  // validation wrapper which knows the contract pct.
  return null
}

// 7. Rent amount variance — sum of RENT_IN-only transactions vs current_rent.
//    Recuperos and expensas are excluded so we don't get false positives
//    on rows where the tenant paid rent + ABL.
function checkRentAmountVariance(r: ValidatableRow): ValidationIssue | null {
  if (r.currentRent <= 0) return null
  const rentInSum = r.ingresosLines
    .filter(l => l.typeCode === 'RENT_IN')
    .reduce((s, l) => s + l.amount, 0)
  if (rentInSum <= 0) return null  // not yet recorded
  const variance = Math.abs(rentInSum - r.currentRent) / r.currentRent
  if (variance < VALIDATION_TOLERANCES.RENT_VARIANCE_WARN) return null
  const severity: 'error' | 'warning' =
    variance >= VALIDATION_TOLERANCES.RENT_VARIANCE_ERROR ? 'error' : 'warning'
  const dir = rentInSum > r.currentRent ? 'mayor' : 'menor'
  return {
    code:     'RENT_AMOUNT_VARIANCE',
    severity,
    message:  `Alquiler cobrado (${fmtMoney(rentInSum)}) es ${(variance * 100).toFixed(0)}% ${dir} que el vigente (${fmtMoney(r.currentRent)}). Verificá que no sea un error de tipeo.`,
    expected: r.currentRent,
    actual:   rentInSum,
    diff:     Math.abs(rentInSum - r.currentRent),
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AGGREGATOR — runs every validator and returns the issues array.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Run all per-row validators against a row.
 *
 * Optional `contractPct` parameter enables the commission-deviation check
 * which compares the effective pct (admi/ingresos*100) against the
 * contract's configured commission_pct. The grid query has both values
 * and can pass them; callers that don't have the contract pct just skip
 * that one rule.
 */
export function validateRow(
  r:           ValidatableRow,
  contractPct?: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const push = (i: ValidationIssue | null) => { if (i) issues.push(i) }

  push(checkTransferenciaBalance(r))
  push(checkTransferenciaNonNegative(r))
  push(checkPaidStatusConsistency(r))
  push(checkBankDatesOrdering(r))
  push(checkAdmiDestinationsClassification(r))
  push(checkCommissionPctDeviation(r))
  push(checkRentAmountVariance(r))

  // Commission deviation check is special: it needs the contract pct
  // which isn't on the row itself. Inline it here when caller provides it.
  if (
    contractPct != null && contractPct > 0 &&
    r.ingresos > 0 && r.admi > 0
  ) {
    const effectivePct = (r.admi / r.ingresos) * 100
    const pctDiff      = Math.abs(effectivePct - contractPct)
    if (pctDiff > VALIDATION_TOLERANCES.COMMISSION_PP) {
      const expectedAdmi = (r.ingresos * contractPct) / 100
      issues.push({
        code:     'COMMISSION_PCT_DEVIATION',
        severity: 'warning',
        message:  `Comisión efectiva (${effectivePct.toFixed(2)}%) difiere del contrato (${contractPct.toFixed(2)}%) por ${pctDiff.toFixed(2)} puntos. ADMI esperado: ${fmtMoney(expectedAdmi)}.`,
        expected: expectedAdmi,
        actual:   r.admi,
        diff:     Math.abs(expectedAdmi - r.admi),
      })
    }
  }

  return issues
}

// ── Helper for the badge / summary UI: highest severity across issues.
export function highestSeverity(issues: ValidationIssue[]): 'ok' | 'warning' | 'error' {
  if (issues.some(i => i.severity === 'error'))   return 'error'
  if (issues.some(i => i.severity === 'warning')) return 'warning'
  return 'ok'
}
