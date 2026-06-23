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

  /** Payment overdue (rent not yet collected past the due date). Days late
   *  ≥ WARN → warning, ≥ ERROR → error. Late-fee territory in Argentine
   *  rentals usually kicks in around day 1; chasing-the-tenant territory
   *  is closer to day 8. */
  PAYMENT_OVERDUE_WARN_DAYS:  1,
  PAYMENT_OVERDUE_ERROR_DAYS: 8,

  /** Allowed diff (percentage points) for junction SUM = 100 checks.
   *  Float-arithmetic slop is well under 0.5 so this tolerance only
   *  hides real-but-tiny rounding, never actual data bugs. */
  PCT_SUM_TOLERANCE:           0.5,
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
  | 'PAYMENT_OVERDUE'
  // ── Data integrity Tier 1 (Thread A2a — 2026-06-18) ──
  | 'CONTRACT_EXPIRED_BUT_ACTIVE'
  | 'CONTRACT_INVALID_DATE_RANGE'
  | 'CONTRACT_LANDLORD_JUNCTION_EMPTY'
  | 'CONTRACT_TENANT_JUNCTION_EMPTY'
  | 'LANDLORD_PCT_SUM_NOT_100'
  | 'TENANT_PCT_SUM_NOT_100'
  // ── Data integrity Tier 2 (Thread A2b — 2026-06-19) ──
  | 'ADMIN_PCT_SUM_INVALID'
  | 'CONTRACT_MISSING_COMMISSION_PCT'
  | 'CONTRACT_NEXT_ADJUSTMENT_OVERDUE'
  | 'CONTRACT_SELLADO_PENDING'
  | 'CONTRACT_DEPOSIT_STATE_INVALID'
  | 'BILLING_IVA_MISMATCH'
  // ── Recurring charges (2026-06-20) ──
  | 'RECURRING_CHARGE_NOT_RECORDED'

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
  /** Whole days from today to the contract's due date in this period.
   *  Negative = overdue. NULL when the contract isn't active. */
  daysUntilPayment:  number | null
  /** ISO due date for the period — `YYYY-MM-DD`. Used in the overdue
   *  message so the encargada sees exactly when payment was expected. */
  dueDateIso:        string | null

  // ── Thread A integrity payload ────────────────────────────────────────
  /** Contract vigencia — ISO YYYY-MM-DD. Both NOT NULL in the schema but
   *  modelled as nullable here so the validators fail closed if a
   *  malformed row sneaks in. */
  startDate:         string | null
  endDate:           string | null
  /** Today as YYYY-MM-DD. Passed in by the row builder so the validators
   *  stay pure (no `new Date()` inside the rules). */
  todayIso:          string
  /** SUM(contract_landlords.ownership_pct) and row count, computed at the
   *  row-builder layer from the same junction data the planilla already
   *  reads. */
  landlordPctSum:    number
  landlordCount:     number
  tenantPctSum:      number
  tenantCount:       number

  // ── Thread A2b — additional integrity payload (2026-06-19) ────────────
  /** SUM(contract_administrators.share_pct) and row count. Skipped when
   *  count=0 (no split defined = use default allocation). */
  adminPctSum:        number
  adminCount:         number
  /** Raw contracts.commission_pct (NULL or 0 → missing). */
  commissionPct:      number | null
  /** ISO YYYY-MM-DD of the contract's stored next_adjustment_date.
   *  When null the contract has no scheduled adjustment (e.g. FIXED indexer). */
  nextAdjustmentDate: string | null
  /** One-time sellado fields (Phase 11). */
  selladoTotal:       number | null
  selladoAppliedAt:   string | null
  /** Deposit state — when 'refunded' on an active contract the row is
   *  in an inconsistent post-close state. */
  depositStatus:      'held' | 'partially_used' | 'refunded' | null
  /** Drives the commission-IVA-vs-administrator cross-check. */
  commissionIncludesIva:    boolean
  /** tax_category of the contract's billing_administrator. NULL when
   *  billing_administrator_id is unset on the contract. */
  billingAdminTaxCategory:  'RI' | 'MONOTRIBUTO' | 'EXENTO' | null
  /** Display label for the billing administrator (name, surfaced in the
   *  IVA mismatch message). Null when admin not assigned. */
  billingAdminLabel:        string | null

  // ── Recurring charges payload (2026-06-20) ──────────────────────────
  /** Labels of typed recurring charges this contract has that DON'T have a
   *  matching transaction recorded this period. Drives the
   *  RECURRING_CHARGE_NOT_RECORDED rule. Empty array = all good. */
  recurringChargesMissingLabels: string[]
  /** Count of typed charges total (eligible for the check). Skipped when 0. */
  recurringChargesTypedCount:    number
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

// 7b. Payment overdue — rent not yet collected past the due date.
//
// Folds the Pago column's "vencido N días" state into the Check badge so
// late payments are visible from the same single indicator as every other
// issue. In Argentine rentals this is also the trigger for late-fee
// (LATE_FEE_IN, "recargo por mora") application — the encargada should
// chase the tenant AND consider whether the contract's late-fee schedule
// has kicked in.
//
// Skipped when the rent is already collected (fechaBanco set) or when the
// contract isn't active in this period (daysUntilPayment null).
function checkPaymentOverdue(r: ValidatableRow): ValidationIssue | null {
  if (r.fechaBanco)             return null  // already cobrado → not overdue
  if (r.daysUntilPayment == null) return null  // contract not active this period
  if (r.daysUntilPayment >= 0)  return null  // not yet due
  const daysLate = -r.daysUntilPayment
  if (daysLate < VALIDATION_TOLERANCES.PAYMENT_OVERDUE_WARN_DAYS) return null
  const severity: 'error' | 'warning' =
    daysLate >= VALIDATION_TOLERANCES.PAYMENT_OVERDUE_ERROR_DAYS ? 'error' : 'warning'
  const dueLabel = r.dueDateIso
    ? `${r.dueDateIso.slice(8, 10)}/${r.dueDateIso.slice(5, 7)}/${r.dueDateIso.slice(0, 4)}`
    : null
  const dueClause = dueLabel ? ` (vencía ${dueLabel})` : ''
  return {
    code:     'PAYMENT_OVERDUE',
    severity,
    message:  `Alquiler vencido hace ${daysLate} ${daysLate === 1 ? 'día' : 'días'}${dueClause}. Revisá si corresponde aplicar recargo por mora (LATE_FEE_IN).`,
    expected: null,
    actual:   null,
    diff:     daysLate,
  }
}

// 7. Rent amount variance — OVERPAYMENT only.
//
// Catches the extra-zero typo ($85.000 entered as $850.000) where the
// recorded RENT_IN is meaningfully larger than the contract's vigente
// rent. Underpayment is intentionally NOT flagged here: partial payments
// are a normal real-world case, and the Deuda column already surfaces
// them in the planilla. Flagging underpayment as an "error" produced
// false positives on every partial-collection row.
function checkRentAmountVariance(r: ValidatableRow): ValidationIssue | null {
  if (r.currentRent <= 0) return null
  const rentInSum = r.ingresosLines
    .filter(l => l.typeCode === 'RENT_IN')
    .reduce((s, l) => s + l.amount, 0)
  if (rentInSum <= 0) return null              // not yet recorded
  if (rentInSum <= r.currentRent) return null  // underpayment → Deuda handles it
  const variance = (rentInSum - r.currentRent) / r.currentRent
  if (variance < VALIDATION_TOLERANCES.RENT_VARIANCE_WARN) return null
  const severity: 'error' | 'warning' =
    variance >= VALIDATION_TOLERANCES.RENT_VARIANCE_ERROR ? 'error' : 'warning'
  return {
    code:     'RENT_AMOUNT_VARIANCE',
    severity,
    message:  `Alquiler cobrado (${fmtMoney(rentInSum)}) es ${(variance * 100).toFixed(0)}% mayor que el vigente (${fmtMoney(r.currentRent)}). Verificá que no sea un error de tipeo (¿cero extra?).`,
    expected: r.currentRent,
    actual:   rentInSum,
    diff:     rentInSum - r.currentRent,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// THREAD A — DATA INTEGRITY RULES (2026-06-18). These check the CONTRACT
// SETUP itself (dates, junction sums, orphan junctions) rather than this
// month's math. They surface "the row is broken because the data is wrong",
// which the cashflow validators couldn't say. The grid query filters
// status='active' so every contract reaching these rules is supposed to
// be a live contract — if end_date < today the row is in a weird state.
// ════════════════════════════════════════════════════════════════════════════

function isoDayDiff(later: string, earlier: string): number {
  return Math.round(
    (new Date(later).getTime() - new Date(earlier).getTime()) / 86400000,
  )
}

// 8. CONTRACT_EXPIRED_BUT_ACTIVE — end_date already past on an active row.
function checkContractExpiredButActive(r: ValidatableRow): ValidationIssue | null {
  if (!r.endDate) return null  // INVALID_DATE_RANGE handles malformed data
  if (r.endDate >= r.todayIso) return null
  const daysPast = isoDayDiff(r.todayIso, r.endDate)
  return {
    code:     'CONTRACT_EXPIRED_BUT_ACTIVE',
    severity: 'error',
    message:  `Contrato vencido hace ${daysPast} ${daysPast === 1 ? 'día' : 'días'} pero sigue en estado "activo". Renovalo o cerralo (status='ended').`,
    expected: null,
    actual:   null,
    diff:     daysPast,
  }
}

// 9. CONTRACT_INVALID_DATE_RANGE — end_date is not strictly after start_date.
function checkContractInvalidDateRange(r: ValidatableRow): ValidationIssue | null {
  if (!r.startDate || !r.endDate) return null
  if (r.endDate > r.startDate) return null
  return {
    code:     'CONTRACT_INVALID_DATE_RANGE',
    severity: 'error',
    message:  `Vigencia inválida: fin (${r.endDate}) no es posterior al inicio (${r.startDate}).`,
    expected: null,
    actual:   null,
    diff:     0,
  }
}

// 10. CONTRACT_LANDLORD_JUNCTION_EMPTY — active contract with no propietarios.
function checkLandlordJunctionEmpty(r: ValidatableRow): ValidationIssue | null {
  if (r.landlordCount > 0) return null
  return {
    code:     'CONTRACT_LANDLORD_JUNCTION_EMPTY',
    severity: 'error',
    message:  'Contrato sin propietarios cargados — agregá al menos uno desde el contrato.',
    expected: 1,
    actual:   0,
    diff:     1,
  }
}

// 11. CONTRACT_TENANT_JUNCTION_EMPTY — active contract with no inquilinos.
function checkTenantJunctionEmpty(r: ValidatableRow): ValidationIssue | null {
  if (r.tenantCount > 0) return null
  return {
    code:     'CONTRACT_TENANT_JUNCTION_EMPTY',
    severity: 'error',
    message:  'Contrato sin inquilinos cargados — agregá al menos uno desde el contrato.',
    expected: 1,
    actual:   0,
    diff:     1,
  }
}

// 12. LANDLORD_PCT_SUM_NOT_100 — junction sum diverges from 100%.
//     Skipped when junction is empty (covered by LANDLORD_JUNCTION_EMPTY).
function checkLandlordPctSum(r: ValidatableRow): ValidationIssue | null {
  if (r.landlordCount === 0) return null
  const diff = Math.abs(r.landlordPctSum - 100)
  if (diff <= VALIDATION_TOLERANCES.PCT_SUM_TOLERANCE) return null
  return {
    code:     'LANDLORD_PCT_SUM_NOT_100',
    severity: 'warning',
    message:  `Suma de % de propietarios = ${r.landlordPctSum.toFixed(2)}%, debería ser 100%. Diferencia: ${diff.toFixed(2)} pp.`,
    expected: 100,
    actual:   r.landlordPctSum,
    diff,
  }
}

// 13. TENANT_PCT_SUM_NOT_100 — same shape for inquilinos.
function checkTenantPctSum(r: ValidatableRow): ValidationIssue | null {
  if (r.tenantCount === 0) return null
  const diff = Math.abs(r.tenantPctSum - 100)
  if (diff <= VALIDATION_TOLERANCES.PCT_SUM_TOLERANCE) return null
  return {
    code:     'TENANT_PCT_SUM_NOT_100',
    severity: 'warning',
    message:  `Suma de % de inquilinos = ${r.tenantPctSum.toFixed(2)}%, debería ser 100%. Diferencia: ${diff.toFixed(2)} pp.`,
    expected: 100,
    actual:   r.tenantPctSum,
    diff,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// THREAD A2b — TIER 2 INTEGRITY (2026-06-19). Round out the data-hygiene
// coverage with rules that catch silently-default config (missing
// commission %), un-applied one-time fees (sellado), out-of-state
// lifecycle markers (deposit refunded on active), and config / billing
// inconsistency (RI mismatch). All warnings except DEPOSIT (= error)
// because depositing-refunded-on-active is a real lifecycle bug.
// ════════════════════════════════════════════════════════════════════════════

// 14. ADMIN_PCT_SUM_INVALID — contract_administrators sum != 100 (when split exists).
//     Skipped when adminCount === 0 (no split = use the default allocation).
function checkAdminPctSum(r: ValidatableRow): ValidationIssue | null {
  if (r.adminCount === 0) return null
  const diff = Math.abs(r.adminPctSum - 100)
  if (diff <= VALIDATION_TOLERANCES.PCT_SUM_TOLERANCE) return null
  return {
    code:     'ADMIN_PCT_SUM_INVALID',
    severity: 'warning',
    message:  `Suma de % entre administradores = ${r.adminPctSum.toFixed(2)}%, debería ser 100% cuando hay un split definido. Diferencia: ${diff.toFixed(2)} pp.`,
    expected: 100,
    actual:   r.adminPctSum,
    diff,
  }
}

// 15. CONTRACT_MISSING_COMMISSION_PCT — commission_pct null or 0.
//     The deviation validator silently skips when commission_pct is 0;
//     surface it explicitly so the encargada cargue el valor real.
function checkContractMissingCommissionPct(r: ValidatableRow): ValidationIssue | null {
  if (r.commissionPct != null && r.commissionPct > 0) return null
  return {
    code:     'CONTRACT_MISSING_COMMISSION_PCT',
    severity: 'warning',
    message:  `Contrato sin % de comisión cargado (${r.commissionPct == null ? 'NULL' : r.commissionPct}). El chequeo de comisión efectiva queda inactivo hasta que lo cargues.`,
    expected: null,
    actual:   r.commissionPct,
    diff:     0,
  }
}

// 16. CONTRACT_NEXT_ADJUSTMENT_OVERDUE — scheduled aumento date already
//     past while the contract is still running. Uses the STORED
//     next_adjustment_date (not the computed-from-cadence value) — that's
//     the date the encargada or the IPC automation maintains.
function checkContractNextAdjustmentOverdue(r: ValidatableRow): ValidationIssue | null {
  if (!r.nextAdjustmentDate) return null            // no scheduled adjustment (FIXED indexer, etc.)
  if (!r.endDate) return null                       // can't reason without end_date
  if (r.nextAdjustmentDate >= r.todayIso) return null  // not overdue
  if (r.endDate < r.todayIso) return null           // contract already over → EXPIRED_BUT_ACTIVE handles it
  const daysPast = isoDayDiff(r.todayIso, r.nextAdjustmentDate)
  return {
    code:     'CONTRACT_NEXT_ADJUSTMENT_OVERDUE',
    severity: 'warning',
    message:  `Aumento programado para ${r.nextAdjustmentDate} vencido hace ${daysPast} ${daysPast === 1 ? 'día' : 'días'}. Aplicalo y actualizá la fecha del próximo ajuste.`,
    expected: null,
    actual:   null,
    diff:     daysPast,
  }
}

const SELLADO_GRACE_DAYS = 35

// 17. CONTRACT_SELLADO_PENDING — one-time sellado not yet applied past grace.
//     Fires when sellado_total > 0 AND sellado_applied_at is NULL AND today
//     is at least 35 days past start_date (Alejandro's "applies to month 1"
//     window plus a buffer).
function checkContractSelladoPending(r: ValidatableRow): ValidationIssue | null {
  if (r.selladoTotal == null || r.selladoTotal <= 0) return null
  if (r.selladoAppliedAt != null) return null
  if (!r.startDate) return null
  const daysSinceStart = isoDayDiff(r.todayIso, r.startDate)
  if (daysSinceStart < SELLADO_GRACE_DAYS) return null
  return {
    code:     'CONTRACT_SELLADO_PENDING',
    severity: 'warning',
    message:  `Sellado de ${r.selladoTotal} sin aplicar después de ${daysSinceStart} días desde inicio. Aplicalo en la próxima liquidación.`,
    expected: r.selladoTotal,
    actual:   null,
    diff:     daysSinceStart,
  }
}

// 18. CONTRACT_DEPOSIT_STATE_INVALID — deposit refunded on an active contract.
//     The grid filters status='active', so reaching this rule with
//     deposit_status='refunded' is a true lifecycle inconsistency.
function checkContractDepositStateInvalid(r: ValidatableRow): ValidationIssue | null {
  if (r.depositStatus !== 'refunded') return null
  return {
    code:     'CONTRACT_DEPOSIT_STATE_INVALID',
    severity: 'error',
    message:  'El depósito figura como devuelto pero el contrato sigue activo. Revertí el estado del depósito o cerrá el contrato (status="ended").',
    expected: null,
    actual:   null,
    diff:     0,
  }
}

// 19. BILLING_IVA_MISMATCH — contract says it includes IVA but the billing
//     administrator isn't RI. Either the contract flag is wrong or the
//     wrong partner is assigned as invoicer.
function checkBillingIvaMismatch(r: ValidatableRow): ValidationIssue | null {
  if (!r.commissionIncludesIva) return null
  if (r.billingAdminTaxCategory === 'RI') return null
  const admin = r.billingAdminLabel
    ? `el administrador "${r.billingAdminLabel}" (${r.billingAdminTaxCategory ?? 'sin categoría'})`
    : 'el administrador asignado (no asignado)'
  return {
    code:     'BILLING_IVA_MISMATCH',
    severity: 'warning',
    message:  `Contrato marcado con IVA incluido pero ${admin} no es RI. Desactivá el flag o asigná un administrador RI como facturador.`,
    expected: null,
    actual:   null,
    diff:     0,
  }
}

// 20. RECURRING_CHARGE_NOT_RECORDED — typed recurring charge has no
//     matching transaction this period. Mirrors the red status dot on the
//     planilla's Recargos cell. Warning severity because the bill may not
//     have arrived yet (e.g., ABL due day 20). Per Alejandro 2026-06-20.
function checkRecurringChargeNotRecorded(r: ValidatableRow): ValidationIssue | null {
  if (r.recurringChargesTypedCount === 0) return null
  if (r.recurringChargesMissingLabels.length === 0) return null
  const labels = r.recurringChargesMissingLabels.join(', ')
  const count  = r.recurringChargesMissingLabels.length
  return {
    code:     'RECURRING_CHARGE_NOT_RECORDED',
    severity: 'warning',
    message:  `Recargo${count === 1 ? '' : 's'} ${labels} sin registrar este período. Revisá si ya entró el cobro y cargalo en Movs.`,
    expected: r.recurringChargesTypedCount,
    actual:   r.recurringChargesTypedCount - count,
    diff:     count,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AGGREGATOR — runs every validator and returns the issues array.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Run all per-row validators against a row.
 *
 * `contractPct` enables the commission-deviation check: it compares the
 * recorded ADMI against `ingresos × pct × (1 + IVA)`, where the IVA factor
 * is 1.21 when the contract is invoiced by an RI administrator and 1
 * otherwise. Without `commissionIncludesIva` the check assumes no IVA
 * (matches Monotributo contracts and any caller that doesn't pass the flag).
 */
export function validateRow(
  r:                     ValidatableRow,
  contractPct?:          number,
  commissionIncludesIva: boolean = false,
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
  push(checkPaymentOverdue(r))
  // ── Thread A2a — data integrity Tier 1 ──
  push(checkContractExpiredButActive(r))
  push(checkContractInvalidDateRange(r))
  push(checkLandlordJunctionEmpty(r))
  push(checkTenantJunctionEmpty(r))
  push(checkLandlordPctSum(r))
  push(checkTenantPctSum(r))
  // ── Thread A2b — data integrity Tier 2 ──
  push(checkAdminPctSum(r))
  push(checkContractMissingCommissionPct(r))
  push(checkContractNextAdjustmentOverdue(r))
  push(checkContractSelladoPending(r))
  push(checkContractDepositStateInvalid(r))
  push(checkBillingIvaMismatch(r))
  // ── Recurring charges (2026-06-20) ──
  push(checkRecurringChargeNotRecorded(r))

  // Commission deviation check is special: it needs the contract pct
  // which isn't on the row itself. Inline it here when caller provides it.
  if (
    contractPct != null && contractPct > 0 &&
    r.ingresos > 0 && r.admi > 0
  ) {
    const ivaFactor    = commissionIncludesIva ? 1.21 : 1
    const expectedAdmi = (r.ingresos * contractPct / 100) * ivaFactor
    // Effective pct is computed against the IVA-inclusive expectation so
    // an RI contract booked correctly shows 0 deviation, not the ~21%
    // surplus you'd get if we ignored IVA.
    const effectivePct = (r.admi / r.ingresos / ivaFactor) * 100
    const pctDiff      = Math.abs(effectivePct - contractPct)
    if (pctDiff > VALIDATION_TOLERANCES.COMMISSION_PP) {
      const ivaSuffix = commissionIncludesIva ? ' (incluye IVA 21%)' : ''
      issues.push({
        code:     'COMMISSION_PCT_DEVIATION',
        severity: 'warning',
        message:  `Comisión efectiva (${effectivePct.toFixed(2)}%) difiere del contrato (${contractPct.toFixed(2)}%${ivaSuffix}) por ${pctDiff.toFixed(2)} puntos. ADMI esperado: ${fmtMoney(expectedAdmi)}.`,
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
