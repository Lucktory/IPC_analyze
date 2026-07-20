// ============================================================================
// Rent-adjustment scheduling + IPC aumento calculation — SINGLE SOURCE OF TRUTH.
//
// Replaces the 4 duplicated CADENCE_MONTHS / next-adjustment copies that used to
// live in lib/entities/queries.ts, lib/liquidacion/queries.ts, the contract
// detail page, and scripts/. Import from here instead.
//
// THE AUMENTO RULE (confirmed with Alejandro + the ARquiler calculator + live
// INDEC data, 2026-07): for a contract with cadence N months, an aumento
// effective in month M uses the COMPOUND IPC over the N months ENDING at (M-2)
// — the natural preceding window shifted ONE month back so every month is
// already published (INDEC publishes a month's IPC ~the 15th of the next month,
// so when rent is charged early in month M, month M-1 isn't out yet).
//
//   factor = índice[M-2] / índice[M-2-N]        (index-ratio == compound of the
//   newRent = currentRent × factor               window's monthly variations)
//
// Verified: trimestral July-2026, 960.000 → 1.039.989 (matches ARquiler to the
// peso). See _verify_aumento_calc.mts.
// ============================================================================

/** Cadence label → step in months between adjustments. */
export const CADENCE_MONTHS: Record<string, number> = {
  mensual: 1, bimestral: 2, trimestral: 3, cuatrimestral: 4, semestral: 6, anual: 12,
}

/** 'YYYY-MM-01' or 'YYYY-MM-DD' → 'YYYY-MM' month key. */
export function monthKey(period: string): string {
  return period.slice(0, 7)
}

/** Shift a 'YYYY-MM' month key by n months (handles year rollover, UTC-safe). */
export function shiftMonth(mk: string, n: number): string {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(Date.UTC(y, (m - 1) + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ── Scheduling ──────────────────────────────────────────────────────────────

// All date math below is UTC-based and computes each step from the ORIGINAL
// start (never cumulative setMonth), so it doesn't drift on day-29/30/31 starts
// and doesn't depend on the server timezone. The day is clamped to the target
// month's length (standard "add months" semantics).
function parseYMD(s: string): { y: number; m0: number; d: number } {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return { y, m0: m - 1, d }
}
function ymdMs(s: string): number { const p = parseYMD(s); return Date.UTC(p.y, p.m0, p.d) }
function addMonthsFrom(startDate: string, k: number): Date {
  const { y, m0, d } = parseYMD(startDate)
  const total = m0 + k
  const ty = y + Math.floor(total / 12)
  const tm = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ty, tm, Math.min(d, lastDay)))
}
/** A Date → 'YYYY-MM' month key (UTC). */
function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Next adjustment date = start + k×N months, smallest k strictly after `today`. */
export function nextAdjustmentDate(startDate: string, cadence: string, today: Date): Date | null {
  const N = CADENCE_MONTHS[cadence]
  if (!N) return null
  const t = today.getTime()
  let k = 0, safety = 4000
  let next = addMonthsFrom(startDate, 0)
  while (next.getTime() <= t && safety-- > 0) { k += N; next = addMonthsFrom(startDate, k) }
  return safety > 0 ? next : null
}

/** Next adjustment as ISO 'YYYY-MM-DD', or null for inactive/unknown-cadence. */
export function nextAdjustmentIso(startDate: string, cadence: string, status: string, today: Date): string | null {
  if (status !== 'active') return null
  const d = nextAdjustmentDate(startDate, cadence, today)
  return d ? d.toISOString().slice(0, 10) : null
}

/** Most recent scheduled adjustment (k≥1) on-or-before `asOf`. Null if none yet. */
export function lastScheduledAdjustment(startDate: string, cadence: string, asOf: Date): Date | null {
  const N = CADENCE_MONTHS[cadence]
  if (!N) return null
  const asOfMs = asOf.getTime()
  let last: Date | null = null, k = N, safety = 4000
  while (safety-- > 0) {
    const step = addMonthsFrom(startDate, k)
    if (step.getTime() <= asOfMs) { last = step; k += N } else break
  }
  return last
}

/**
 * The EARLIEST scheduled adjustment (k≥1) still unapplied and due: strictly after
 * `lastAdjustmentDate` (or after start when never adjusted) AND on-or-before
 * `asOf`. Null when nothing is pending — this makes the suggestion and the
 * AUMENTO_PENDIENTE check IDEMPOTENT (they vanish once recorded), and makes a
 * multi-window-behind contract catch up ONE window at a time (each factor then
 * compounds correctly on the running current_rent).
 */
export function firstUnappliedAdjustment(
  startDate: string, cadence: string, lastAdjustmentDate: string | null, asOf: Date,
): Date | null {
  const N = CADENCE_MONTHS[cadence]
  if (!N) return null
  const asOfMs      = asOf.getTime()
  const thresholdMs = lastAdjustmentDate ? ymdMs(lastAdjustmentDate) : ymdMs(startDate)
  let k = N, safety = 4000
  while (safety-- > 0) {
    const step = addMonthsFrom(startDate, k)
    const ms = step.getTime()
    if (ms > asOfMs) return null       // nothing due-and-unapplied
    if (ms > thresholdMs) return step   // earliest unapplied
    k += N
  }
  return null
}

/**
 * The adjustment to treat as pending as of `asOf`, branching on the applied
 * history:
 *   • last_adjustment_date SET  → catch up the earliest unapplied one after it
 *     (firstUnappliedAdjustment) — the rent was recorded up to that date.
 *   • last_adjustment_date NULL → the MOST RECENT scheduled one on-or-before asOf
 *     (lastScheduledAdjustment). Imported contracts have a null date but their
 *     current_rent is already the CURRENT value, so there is nothing to catch up
 *     from the start — only the upcoming window applies. (Walking from the start
 *     would wrongly pick a years-old window for a long-running contract.)
 * After an aumento is applied, last_adjustment_date is set, so the branch flips
 * and it stops offering the same one (idempotent).
 */
export function pendingAdjustment(
  startDate: string, cadence: string, lastAdjustmentDate: string | null, asOf: Date,
): Date | null {
  return lastAdjustmentDate
    ? firstUnappliedAdjustment(startDate, cadence, lastAdjustmentDate, asOf)
    : lastScheduledAdjustment(startDate, cadence, asOf)
}

/** True when `period` (YYYY-MM-01) is exactly k×N months after start (k≥1) —
 *  i.e. a scheduled adjustment lands in that month. */
export function periodHasAdjustment(startDate: string, cadence: string, period: string): boolean {
  const N = CADENCE_MONTHS[cadence]
  if (!N) return false
  const s = parseYMD(startDate), p = parseYMD(period)
  const months = (p.y - s.y) * 12 + (p.m0 - s.m0)
  return months > 0 && months % N === 0
}

export interface ExpectedRent {
  value:      number    // rent to show for the period
  hasAumento: boolean   // the period is an adjustment period (drives the tint)
  ipcMissing: boolean   // a needed index month isn't loaded → best-effort value
}

/**
 * The 'YYYY-MM' the contract's current_rent is anchored at (known-correct as of):
 *   • last_adjustment_date, when an aumento was applied (current_rent is that value)
 *   • else the most recent scheduled adjustment on-or-before created_at — an
 *     imported/created contract captured current_rent at that moment
 *   • else the contract start (no adjustment had occurred yet)
 */
function anchorMonthKey(
  startDate: string, cadence: string, lastAdjustmentDate: string | null, createdAt: string | null,
): string {
  if (lastAdjustmentDate) return monthKey(lastAdjustmentDate)
  if (createdAt) {
    const last = lastScheduledAdjustment(startDate, cadence, new Date(ymdMs(createdAt)))
    if (last) return ymKey(last)
  }
  return monthKey(startDate)
}

/** Public wrapper: the 'YYYY-MM' the contract's current_rent is anchored at —
 *  used by the contract page to show "de dónde salió" (since when this rent). */
export function rentAnchorMonth(
  startDate: string, cadence: string, lastAdjustmentDate: string | null, createdAt: string | null,
): string {
  return anchorMonthKey(startDate, cadence, lastAdjustmentDate, createdAt)
}

/**
 * The alquiler value to display for a viewed `period`, computed FORWARD from the
 * anchor (see anchorMonthKey):
 *
 *   value = current_rent × ∏ factor(w)   for every scheduled adjustment w with
 *   anchor < month(w) ≤ period,   factor(w) = índice[w-2] / índice[w-2-N]
 *
 * ONE function for ALL cadences (N = CADENCE_MONTHS[cadence]). It carries an
 * increase forward across the following months instead of only showing it in the
 * exact adjustment month, so the value never "reverts" the month after an
 * increase — no persistence required. `hasAumento` marks only the month an
 * increase kicks in (orange tint). `ipcMissing` flags a missing index month
 * (value is best-effort). The actual RENT_IN cobro, once recorded, overrides
 * this estimate in the grid.
 */
export function expectedRentForPeriod(args: {
  startDate:          string
  cadence:            string
  currentRent:        number
  lastAdjustmentDate: string | null
  createdAt:          string | null      // import/creation stamp — anchors imported contracts
  period:             string             // YYYY-MM-01
  indexByMonth:       Record<string, number>
}): ExpectedRent {
  const N = CADENCE_MONTHS[args.cadence]
  const hasAumento = periodHasAdjustment(args.startDate, args.cadence, args.period)
  if (!N) return { value: args.currentRent, hasAumento: false, ipcMissing: false }

  const anchorMonth = anchorMonthKey(args.startDate, args.cadence, args.lastAdjustmentDate, args.createdAt)
  const periodMonth = monthKey(args.period)

  // Compound every scheduled adjustment after the anchor, up to the viewed
  // period. Comparison is by MONTH (not exact day) so a start day ≠ 1 still
  // applies its window in the right month.
  let value = args.currentRent
  let ipcMissing = false
  let k = N, safety = 4000
  while (safety-- > 0) {
    const stepMonth = ymKey(addMonthsFrom(args.startDate, k))
    if (stepMonth > periodMonth) break                 // beyond the viewed period
    if (stepMonth > anchorMonth) {                     // not already baked into current_rent
      const win = aumentoWindow(`${stepMonth}-01`, args.cadence)
      if (win) {
        const idxEnd   = args.indexByMonth[win.numeratorMonth]
        const idxStart = args.indexByMonth[win.denominatorMonth]
        if (idxEnd == null || idxStart == null) ipcMissing = true
        else value = value * (idxEnd / idxStart)
      }
    }
    k += N
  }
  return { value: round2(value), hasAumento, ipcMissing }
}

// ── IPC aumento window + calculation ────────────────────────────────────────

export interface AumentoWindow {
  /** Month keys in the window, oldest → newest (the N monthly variations used). */
  months:           string[]
  /** Index month for the numerator: M-2 (latest, always published). */
  numeratorMonth:   string
  /** Index month for the denominator: M-2-N (the base, month before the window). */
  denominatorMonth: string
}

/**
 * The IPC window for an aumento effective in `effectivePeriod` (YYYY-MM-01) with
 * the given cadence. N months ending at M-2. factor = índice[num]/índice[den].
 */
export function aumentoWindow(effectivePeriod: string, cadence: string): AumentoWindow | null {
  const N = CADENCE_MONTHS[cadence]
  if (!N) return null
  const M = monthKey(effectivePeriod)
  const numeratorMonth   = shiftMonth(M, -2)
  const denominatorMonth = shiftMonth(M, -2 - N)
  const months: string[] = []
  for (let i = N - 1; i >= 0; i--) months.push(shiftMonth(numeratorMonth, -i))
  return { months, numeratorMonth, denominatorMonth }
}

export interface AumentoInput {
  currentRent:       number
  rentFacturadoNeto: number | null   // null = ordinary (single-part) rent
  rentNoFacturado:   number
  rentIvaRate:       number           // % (e.g. 21 for RI), 0 for monotributo
  cadence:           string
  effectivePeriod:   string           // YYYY-MM-01 the aumento takes effect
  indexByMonth:      Record<string, number>  // 'YYYY-MM' → INDEC index level
}

export interface AumentoResult {
  factor:        number
  pct:           number               // (factor − 1) × 100
  newRent:       number
  newNeto:       number | null
  newNf:         number | null
  window:        AumentoWindow
  indexStart:    number | null        // denominator index (M-2-N)
  indexEnd:      number | null        // numerator index (M-2)
  /** Months whose index is missing from indexByMonth. Non-empty ⇒ can't compute. */
  missingMonths: string[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Compute the aumento. Returns null only for an unknown cadence. When index data
 * is missing, returns a result with `missingMonths` populated and factor=1 (no
 * change) so callers can surface "IPC no cargado" instead of a wrong number.
 * Two-part (N/F) contracts scale each part by the same factor and re-derive IVA
 * — identical to the existing applyContractAumento convention.
 */
export function computeAumento(input: AumentoInput): AumentoResult | null {
  const window = aumentoWindow(input.effectivePeriod, input.cadence)
  if (!window) return null

  const indexEnd   = input.indexByMonth[window.numeratorMonth] ?? null
  const indexStart = input.indexByMonth[window.denominatorMonth] ?? null
  const missingMonths: string[] = []
  if (indexEnd == null)   missingMonths.push(window.numeratorMonth)
  if (indexStart == null) missingMonths.push(window.denominatorMonth)

  if (missingMonths.length || !indexStart) {
    return {
      factor: 1, pct: 0, newRent: input.currentRent,
      newNeto: input.rentFacturadoNeto, newNf: input.rentFacturadoNeto != null ? input.rentNoFacturado : null,
      window, indexStart, indexEnd, missingMonths,
    }
  }

  const factor = (indexEnd as number) / indexStart
  let newRent: number, newNeto: number | null = null, newNf: number | null = null
  if (input.rentFacturadoNeto != null) {
    newNeto = round2(input.rentFacturadoNeto * factor)
    newNf   = round2(input.rentNoFacturado * factor)
    newRent = round2(newNeto * (1 + input.rentIvaRate / 100) + newNf)
  } else {
    newRent = round2(input.currentRent * factor)
  }

  return { factor, pct: (factor - 1) * 100, newRent, newNeto, newNf, window, indexStart, indexEnd, missingMonths: [] }
}

// ── Pending-aumento evaluation (drives the AUMENTO_PENDIENTE validation) ──────

export interface AumentoPending {
  /** 'YYYY-MM-01' of the most recent scheduled adjustment due as of `today`. */
  effectivePeriod: string
  /** Computed new rent using currentRent as the base; null when IPC missing. */
  expectedNewRent: number | null
  pct:             number | null
  ipcMissing:      boolean
}

/**
 * The most recent DUE aumento for a contract as of `today`, or null when none is
 * due yet / cadence unknown. expectedNewRent uses `currentRent` as the pre-aumento
 * base (correct for contracts whose rent hasn't been bumped for this window yet).
 */
export function evaluatePendingAumento(args: {
  startDate:          string
  cadence:            string
  currentRent:        number
  rentFacturadoNeto:  number | null
  rentNoFacturado:    number
  rentIvaRate:        number
  lastAdjustmentDate: string | null
  today:              Date
  indexByMonth:       Record<string, number>
}): AumentoPending | null {
  const eff = pendingAdjustment(args.startDate, args.cadence, args.lastAdjustmentDate, args.today)
  if (!eff) return null
  const effIso = `${eff.getUTCFullYear()}-${String(eff.getUTCMonth() + 1).padStart(2, '0')}-01`
  const result = computeAumento({
    currentRent:       args.currentRent,
    rentFacturadoNeto: args.rentFacturadoNeto,
    rentNoFacturado:   args.rentNoFacturado,
    rentIvaRate:       args.rentIvaRate,
    cadence:           args.cadence,
    effectivePeriod:   effIso,
    indexByMonth:      args.indexByMonth,
  })
  if (!result) return null
  const ipcMissing = result.missingMonths.length > 0
  return {
    effectivePeriod: effIso,
    expectedNewRent: ipcMissing ? null : result.newRent,
    pct:             ipcMissing ? null : result.pct,
    ipcMissing,
  }
}

// ── Suggested aumento for the contract detail UI (tentative "en gris") ────────

export interface SuggestedAumento {
  effectivePeriod: string          // 'YYYY-MM-01'
  expectedNewRent: number | null
  pct:             number | null
  windowMonths:    string[]        // 'YYYY-MM' used
  indexStart:      number | null
  indexEnd:        number | null
  ipcMissing:      boolean
  missingMonths:   string[]
}

/** Pure builder — the async wrapper (lib/contract/aumento-suggest.ts) supplies
 *  the index map. Returns null when no aumento is due / cadence unknown. */
export function buildSuggestedAumento(args: {
  startDate:          string
  cadence:            string
  currentRent:        number
  rentFacturadoNeto:  number | null
  rentNoFacturado:    number
  rentIvaRate:        number
  lastAdjustmentDate: string | null
  today:              Date
  indexByMonth:       Record<string, number>
}): SuggestedAumento | null {
  const eff = pendingAdjustment(args.startDate, args.cadence, args.lastAdjustmentDate, args.today)
  if (!eff) return null
  const effIso = `${eff.getUTCFullYear()}-${String(eff.getUTCMonth() + 1).padStart(2, '0')}-01`
  const win = aumentoWindow(effIso, args.cadence)
  if (!win) return null
  const result = computeAumento({
    currentRent:       args.currentRent,
    rentFacturadoNeto: args.rentFacturadoNeto,
    rentNoFacturado:   args.rentNoFacturado,
    rentIvaRate:       args.rentIvaRate,
    cadence:           args.cadence,
    effectivePeriod:   effIso,
    indexByMonth:      args.indexByMonth,
  })
  if (!result) return null
  const ipcMissing = result.missingMonths.length > 0
  return {
    effectivePeriod: effIso,
    expectedNewRent: ipcMissing ? null : result.newRent,
    pct:             ipcMissing ? null : result.pct,
    windowMonths:    win.months,
    indexStart:      result.indexStart,
    indexEnd:        result.indexEnd,
    ipcMissing,
    missingMonths:   result.missingMonths,
  }
}
