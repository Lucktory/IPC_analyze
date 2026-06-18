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
import { validateRow, type ValidationIssue } from './validations'
import { type ContractExpiryRowStatus } from './thresholds'

export type { ValidationIssue, ContractExpiryRowStatus }

// ── Phase 9B: planilla footer totals — sums across every visible row,
//    rendered as a sticky <tfoot> at the bottom of the grid so Alejandro
//    can see "this month I earned X in admin, transferred Y, took in Z."
//
//    Pure function — fails closed: any error in summing returns zeroes
//    so a single bad row never breaks the footer.
export interface LiquidacionGridTotals {
  expensas:      number
  deuda:         number
  ingresos:      number
  /** Phase 9C: sum of RENT_IN across all rows. */
  alquiler:      number
  /** Phase 9C: sum of (non-RENT_IN IN + adjustment_amount) across all rows. */
  extras:        number
  transferencia: number
  otros:         number
  admi:          number
  /** IVA portion embedded inside `admi` for contracts where
   *  commission_includes_iva = true. Sum across the period.
   *  Rows with no IVA on commission contribute 0. */
  iva:           number
  admGalicia:    number
  admFrances509: number
  admFrances516: number
}

const ZERO_TOTALS: LiquidacionGridTotals = {
  expensas: 0, deuda: 0, ingresos: 0, alquiler: 0, extras: 0,
  transferencia: 0, otros: 0,
  admi: 0, iva: 0, admGalicia: 0, admFrances509: 0, admFrances516: 0,
}

export function sumGridTotals(rows: LiquidacionGridRow[]): LiquidacionGridTotals {
  try {
    const t: LiquidacionGridTotals = { ...ZERO_TOTALS }
    for (const r of rows) {
      t.expensas      += Number(r.expensas      ?? 0) || 0
      t.deuda         += Number(r.deuda         ?? 0) || 0
      t.ingresos      += Number(r.ingresos      ?? 0) || 0
      t.alquiler      += Number(r.alquilerSum   ?? 0) || 0
      t.extras        += Number(r.extrasSum     ?? 0) || 0
      t.transferencia += Number(r.transferencia ?? 0) || 0
      t.otros         += Number(r.otros         ?? 0) || 0
      t.admi          += Number(r.admi          ?? 0) || 0
      t.iva           += Number(r.iva           ?? 0) || 0
      t.admGalicia    += Number(r.admGalicia    ?? 0) || 0
      t.admFrances509 += Number(r.admFrances509 ?? 0) || 0
      t.admFrances516 += Number(r.admFrances516 ?? 0) || 0
    }
    return t
  } catch {
    return { ...ZERO_TOTALS }
  }
}

// ── Contract-end row tint (revised 2026-06-17 — month-aligned) ────────────
//    Pure function — fails closed: any error returns 'normal' so a single
//    bad row can never crash the grid.
//
//    The status is based on calendar-month distance between end_date and
//    the period being viewed, NOT days-until. Alejandro scans the planilla
//    by month, so the tint should flip exactly when a month boundary is
//    crossed.
function computeExpiryRowStatus(
  endDate:     string | null,
  periodStart: Date,     // first-of-month for the period the user is viewing
): { status: ContractExpiryRowStatus; daysUntil: number | null } {
  try {
    if (!endDate) return { status: 'normal', daysUntil: null }
    const end = new Date(endDate)
    if (isNaN(end.getTime())) return { status: 'normal', daysUntil: null }

    // Day count is kept for tooltips, not for tier classification.
    const daysUntil = Math.ceil(
      (end.getTime() - periodStart.getTime()) / 86400000,
    )

    // Compare months absolutely (year * 12 + month) so a December → January
    // boundary works correctly.
    const periodMonthIdx = periodStart.getFullYear() * 12 + periodStart.getMonth()
    const endMonthIdx    = end.getFullYear()         * 12 + end.getMonth()
    const monthsAhead    = endMonthIdx - periodMonthIdx

    if (monthsAhead < 0)   return { status: 'expired',    daysUntil }
    if (monthsAhead === 0) return { status: 'this_month', daysUntil }
    if (monthsAhead === 1) return { status: 'next_month', daysUntil }
    return { status: 'normal', daysUntil }
  } catch {
    return { status: 'normal', daysUntil: null }
  }
}

// Does this period contain a rent-adjustment date for the contract?
// Used to drive the persistent light-blue tint on the Alquiler cell.
// Pure function — fails closed.
function periodHasAumentoApplied(
  startDate:   string | null,
  cadence:     string | null,
  periodStart: Date,
): boolean {
  try {
    if (!startDate || !cadence) return false
    const months = CADENCE_MONTHS[cadence]
    if (!months) return false
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
    // Walk forward from start_date in cadence-month steps. Return true the
    // moment any non-initial step lands inside [periodStart, periodEnd).
    const candidate = new Date(startDate)
    if (isNaN(candidate.getTime())) return false
    const initialStamp = candidate.getTime()
    let safety = 1000
    while (candidate < periodEnd && safety-- > 0) {
      if (candidate.getTime() !== initialStamp && candidate >= periodStart && candidate < periodEnd) {
        return true
      }
      candidate.setMonth(candidate.getMonth() + months)
    }
    return false
  } catch {
    return false
  }
}

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
  /** Primary landlord NAME (highest ownership_pct) — kept for any legacy
   *  caller that still reads a single string. New cells should prefer the
   *  `landlordsList` array below. */
  propietario:   string
  /** Primary landlord email — null if not on file. Used by the per-row
   *  "Liquidar y enviar mail" button to prefill the recipient. */
  propietarioEmail: string | null
  /** Primary tenant NAME — same legacy contract as `propietario`. */
  inquilino:     string
  // ── Phase 11 — full co-owner / co-tenant lists, sorted by % desc. ──
  /** Every landlord on this contract with their ownership %. Empty when
   *  the junction is missing (orphan contract — see `isOrphan` below). */
  landlordsList: { id: string; name: string; ownershipPct: number }[]
  /** Every tenant on this contract with their share %. */
  tenantsList:   { id: string; name: string; sharePct: number }[]
  /** TRUE when the contract is active but lacks a complete junction set
   *  (no co-owner rows or no co-tenant rows). The grid surfaces these
   *  with a yellow warning tint so the encargada can fix the data instead
   *  of the contract disappearing silently. */
  isOrphan:      boolean
  /** Human-readable reason when `isOrphan === true`. */
  orphanReason:  string | null
  contrato:      string | null   // contracts.contract_number

  // ── Period info ──
  periodo:       string          // period date
  expensas:      number | null   // contracts.expensas (monthly)

  // ── Cobro side (light gray until fechaBanco set, then dark gray) ──
  fechaBanco:    string | null   // max(RENT_IN.bank_date)
  ingresos:      number          // sum IN affects_liquidacion (alquilerSum + extrasSum_recuperos_only)
  deuda:         number          // current_rent - ingresos (positive = owed)

  // ── Phase 9C: Ingresos column split into Alquiler + Extras ──────────────
  //   Alejandro: "figura a simple vista cuál es el alquiler. Y al lado
  //               los extras que pueden ser positivos o negativos."
  //
  //   alquilerSum: RENT_IN transactions only — the "what is the rent"
  //                number that's visible at a glance.
  //   extrasSum:   sum of (non-RENT_IN affects_liquidacion IN) + the
  //                signed adjustment_amount from liquidaciones. Can be
  //                positive (recuperos paid by tenant) OR negative (when
  //                a discount sits in adjustment_amount).
  alquilerSum:   number
  extrasSum:     number

  // ── Transfer side (light gray until diaTransf set, then dark gray) ──
  diaTransf:     string | null   // max(LANDLORD_PAYOUT.bank_date)
  transferencia: number          // computed: ingresos - admi - otros + adjustment
  otros:         number          // sum OUT (≠ COMMISSION_OUT) affects_liquidacion

  // ── Commission breakdown (3 destinations stay SEPARATE per Alejandro's spec) ──
  pct:           number          // effective % = admi / ingresos × 100
  admi:          number          // sum COMMISSION_OUT (already includes IVA when applicable)
  /** True when the contract is invoiced by an RI administrator AND the
   *  commission line includes IVA (contracts.commission_includes_iva).
   *  Drives the IVA column and the validation's expected-ADMI calc. */
  commissionIncludesIva: boolean
  /** IVA portion embedded inside `admi`: `admi × 0.21 / 1.21` when
   *  commissionIncludesIva is true, else 0. Derived so the encargada sees
   *  what slice of ADMI is IVA without re-doing the arithmetic. */
  iva:           number
  admGalicia:    number
  admFrances509: number
  admFrances516: number

  // ── Movimientos — drives the Movs. cell + editable modal.
  //    Count and signed totals across EVERY transaction the contract has
  //    in the period (including non-affects_liquidacion entries like
  //    deposits). The cell shows net = totalIn - totalOut; the modal
  //    shows the per-row breakdown.
  movimientosCount:    number
  movimientosTotalIn:  number
  movimientosTotalOut: number

  // ── Phase 10 — Contract adjustment cadence (mensual / bimestral / …) ──
  //   Alejandro: he asked for a column showing the cadence so he can
  //   answer "every how often is the rent adjusted for this contract?"
  //   The string is the raw DB value (lowercase), the display label is
  //   resolved in the grid via CADENCE_SHORT / CADENCE_FULL from
  //   lib/liquidacion/thresholds.ts.
  cadence:               string | null

  // ── Per-row payment countdown (replaces the redundant Período column) ──
  //   The cell shows "en N días" / "hoy" / "vencido N días" / "✓ cobrado"
  //   based on these three values. Computed against today + the contract's
  //   payment_day for the current period.
  /** Day of the month rent is due (contracts.payment_day, 1–31). */
  paymentDay:            number
  /** ISO date (YYYY-MM-DD) of the due date IN the current period, clamped
   *  to the last day of the month if payment_day exceeds it. NULL when the
   *  contract isn't active in this period yet, or has already ended. */
  dueDateIso:            string | null
  /** Whole days from today to the due date. Positive = future, 0 = today,
   *  negative = past. NULL when dueDateIso is null. */
  daysUntilPayment:      number | null

  // ── Highlight flags ──
  /** True when the contract's nextAdjustmentDate is within 30 days. Drives
   *  the light-orange background on the INGRESOS cell. */
  hasUpcomingAdjustment: boolean
  daysUntilAdjustment:   number | null
  /** ISO date (YYYY-MM-DD) of the next adjustment, or null when there's no
   *  cadence configured. Used in the cadence cell tooltip. */
  nextAdjustmentDateIso: string | null

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

  // ── Per-row breakdown of what makes up INGRESOS (Phase 6 — dynamic
  //    cells per Alejandro: "el inquilino tiene que depositar el
  //    alquiler, el ABL y el gas"). One entry per transaction that
  //    contributes to ingresos (RENT_IN + every other affects_liquidacion
  //    IN type: EXPENSAS_IN, LATE_FEE_IN, RECUPERO_*_IN, OTHER_IN). The
  //    Ingresos cell renders the sum as before AND opens a popover that
  //    edits each line individually.
  ingresosLines:     IngresosLine[]

  // ── Per-row validation issues (Phase 7A). Empty array = all checks
  //    passed → green ✓ in the Check column. Non-empty → yellow / red
  //    badge with click-to-popover details.
  validationIssues:  ValidationIssue[]

  // ── Contract-end visual tier (revised 2026-06-17). Drives the color of
  //    the entire ROW (was the Contrato cell only in Phase 9A):
  //      'normal'     → no tint
  //      'next_month' → light yellow (end_date is next calendar month)
  //      'this_month' → soft orange (end_date is this calendar month)
  //      'expired'    → red tint (end_date already past)
  expiryRowStatus:      ContractExpiryRowStatus
  /** Days from period start to end_date. Positive = future, negative = past,
   *  null = no end date. Kept for tooltips, NOT for tier classification. */
  daysUntilContractEnd: number | null
  /** True when this period contains a rent-adjustment date. Drives the
   *  persistent light-blue tint on the Alquiler cell that survives the
   *  cobrado transition (= proof the cobro arrived WITH the increase). */
  periodHasAumento:     boolean
}

export interface IngresosLine {
  /** The underlying transaction id — used to update / delete the line. */
  transactionId: string
  typeCode:      string   // e.g. 'RENT_IN', 'RECUPERO_ABL_IN'
  typeLabel:     string   // e.g. 'Alquiler cobrado', 'Recupero ABL'
  amount:        number
  description:   string | null
  bankDate:      string | null
}

// ── Validation issues for the row (Phase 7A — discrepancy verification).
//    Populated by validateRow() in lib/liquidacion/validations.ts.
//    Empty array means all checks passed; otherwise the badge in the
//    "Check" column lights up yellow/red depending on highest severity. */

// ── In-UI diagnostic — surfaces what's actually in the DB when the grid
//    returns 0 rows. The encargada sees the counts inline instead of
//    needing access to Vercel runtime logs.
// ────────────────────────────────────────────────────────────────────────────
export interface GridDiagnostic {
  contractsTotal:     number
  contractsActive:    number
  contractsByStatus:  Record<string, number>
  noLandlordJunction: number  // active contracts with zero contract_landlords rows
  noTenantJunction:   number  // active contracts with zero contract_tenants rows
  lastFiveCreated:    { id: string; status: string; created_at: string }[]
  /** When getLiquidacionGridForPeriod returns 0 rows despite contracts
   *  existing, we run a "trial build" of the first contract row using the
   *  same code path and capture whatever throws. Surfaced inline so the
   *  encargada can see the real cause without checking Vercel logs. */
  rowBuildError:      string | null
  rowBuildErrorContract: string | null
  /** Diagnostic for the grid's actual SELECT statement — confirms whether
   *  the heavy nested-join query reaches the same rows the lightweight
   *  diagnostic select sees, OR if Supabase is returning a different
   *  number (or an error) for the same active contracts. */
  gridSelectRowCount: number | null
  gridSelectError:    string | null
  gridSelectFirstContract: string | null
  /** Same exact query the grid runs, but only on the FIRST returned row.
   *  Lets us see what shape the join actually delivered (do contract_landlords
   *  / contract_tenants come back with data? does landlords(id, name, email)
   *  return all three?). */
  gridSelectFirstSample: any
}

export async function getGridDiagnostic(period: string): Promise<GridDiagnostic> {
  const empty: GridDiagnostic = {
    contractsTotal: 0, contractsActive: 0, contractsByStatus: {},
    noLandlordJunction: 0, noTenantJunction: 0, lastFiveCreated: [],
    rowBuildError: null, rowBuildErrorContract: null,
    gridSelectRowCount: null, gridSelectError: null,
    gridSelectFirstContract: null, gridSelectFirstSample: null,
  }
  try {
    const supabase = await createSupabaseServer()
    const [allRes, junctionsRes] = await Promise.all([
      supabase
        .from('contracts')
        .select('id, status, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('contracts')
        .select(`
          id, status,
          contract_landlords(landlord_id),
          contract_tenants(tenant_id)
        `)
        .eq('status', 'active'),
    ])

    const all = (allRes.data ?? []) as { id: string; status: string; created_at: string }[]
    const byStatus: Record<string, number> = {}
    for (const c of all) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1

    let noL = 0
    let noT = 0
    for (const c of (junctionsRes.data ?? []) as any[]) {
      if (!c.contract_landlords || c.contract_landlords.length === 0) noL++
      if (!c.contract_tenants   || c.contract_tenants.length   === 0) noT++
    }

    // Trial-build: re-run the grid query and try to build ONE row. If it
    // throws we capture the error message + contract id. This is the smoking
    // gun when the grid is empty despite 99 active contracts being on disk.
    let rowBuildError: string | null = null
    let rowBuildErrorContract: string | null = null
    try {
      const peek = await getLiquidacionGridForPeriodRaw(period, { trial: true })
      if (peek.firstError) {
        rowBuildError = peek.firstError
        rowBuildErrorContract = peek.firstErrorContract
      }
    } catch (err) {
      rowBuildError = err instanceof Error ? err.message : String(err)
    }

    // ── Run the EXACT SAME query the grid runs and see what it returns.
    //    This is the smoking-gun probe: if the diagnostic above sees 99
    //    contracts but this nested-join query returns 0 or an error,
    //    we know the join is broken (permissions, schema mismatch, etc.).
    let gridSelectRowCount: number | null = null
    let gridSelectError: string | null = null
    let gridSelectFirstContract: string | null = null
    let gridSelectFirstSample: any = null
    try {
      const probeRes = await supabase
        .from('contracts')
        .select(`
          id, status, contract_number, lfa_code, expensas, current_rent,
          cadence, start_date, end_date, created_at, updated_at,
          commission_pct, commission_includes_iva,
          contract_tenants(is_primary, share_pct, tenants(id, name)),
          contract_landlords(ownership_pct, landlords(id, name, email))
        `)
        .eq('status', 'active')
      if (probeRes.error) {
        gridSelectError = probeRes.error.message
      }
      const rows = (probeRes.data ?? []) as any[]
      gridSelectRowCount = rows.length
      if (rows.length > 0) {
        const first = rows[0]
        gridSelectFirstContract = first?.id ?? null
        // Strip nested arrays to just the keys + lengths so the panel can
        // show what came back without an unbounded blob.
        gridSelectFirstSample = {
          id: first.id,
          status: first.status,
          current_rent: first.current_rent,
          cadence: first.cadence,
          contract_landlords_count: (first.contract_landlords ?? []).length,
          contract_tenants_count:   (first.contract_tenants   ?? []).length,
          first_landlord:           first.contract_landlords?.[0] ?? null,
          first_tenant:             first.contract_tenants?.[0]   ?? null,
        }
      }
    } catch (err) {
      gridSelectError = err instanceof Error ? err.message : String(err)
    }

    return {
      contractsTotal:     all.length,
      contractsActive:    byStatus['active'] ?? 0,
      contractsByStatus:  byStatus,
      noLandlordJunction: noL,
      noTenantJunction:   noT,
      lastFiveCreated:    all.slice(0, 5),
      rowBuildError,
      rowBuildErrorContract,
      gridSelectRowCount,
      gridSelectError,
      gridSelectFirstContract,
      gridSelectFirstSample,
    }
  } catch (err) {
    console.error('[getGridDiagnostic] failed:', err)
    return empty
  }
}

// Trial helper used only by the diagnostic. Returns the first
// error message + contract id encountered during row construction so
// the empty-state panel can surface it directly.
async function getLiquidacionGridForPeriodRaw(
  period: string,
  opts:   { trial: true },
): Promise<{ firstError: string | null; firstErrorContract: string | null }> {
  try {
    const rows = await getLiquidacionGridForPeriod(period)
    if (rows.length > 0) return { firstError: null, firstErrorContract: null }
    // If we got 0 rows on a period that should have data, we already
    // logged per-contract errors via console.error inside the row loop.
    // Re-running with a single-row probe surfaces the FIRST error here.
    return await probeFirstRowError(period)
  } catch (err) {
    return {
      firstError: err instanceof Error ? err.message : String(err),
      firstErrorContract: null,
    }
  }
}

// Single-contract probe: fetches one active contract, rebuilds its row
// using the same query shape, and returns the first error encountered.
async function probeFirstRowError(
  period: string,
): Promise<{ firstError: string | null; firstErrorContract: string | null }> {
  try {
    const supabase = await createSupabaseServer()
    const { data: contracts } = await supabase
      .from('contracts')
      .select(`
        id, status, contract_number, lfa_code, expensas, current_rent,
        cadence, start_date, end_date, payment_day,
        created_at, updated_at, commission_pct, commission_includes_iva,
        contract_tenants(is_primary, share_pct, tenants(id, name)),
        contract_landlords(ownership_pct, landlords(id, name, email))
      `)
      .eq('status', 'active')
      .limit(1)
    if (!contracts || contracts.length === 0) {
      return { firstError: null, firstErrorContract: null }
    }
    const c: any = contracts[0]
    // Touch every field path the row builder touches.
    try {
      const landlords = (c.contract_landlords ?? []) as any[]
      void landlords.map(l => ({ id: l.landlords?.id, name: l.landlords?.name, pct: Number(l.ownership_pct ?? 0) }))
      const tenants = (c.contract_tenants ?? []) as any[]
      void tenants.map(t => ({ id: t.tenants?.id, name: t.tenants?.name, pct: Number(t.share_pct ?? 100) }))
      void Number(c.current_rent ?? 0)
      void (c.start_date && c.cadence ? new Date(c.start_date).getTime() : null)
      return { firstError: null, firstErrorContract: c.id }
    } catch (err) {
      return {
        firstError: err instanceof Error ? err.message : String(err),
        firstErrorContract: c.id,
      }
    }
  } catch (err) {
    return {
      firstError: err instanceof Error ? err.message : String(err),
      firstErrorContract: null,
    }
  }
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
        cadence, start_date, end_date, payment_day,
        created_at, updated_at, commission_pct, commission_includes_iva,
        contract_tenants(is_primary, share_pct, tenants(id, name)),
        contract_landlords(ownership_pct, landlords(id, name, email))
      `)
      .eq('status', 'active'),
    supabase
      .from('transactions')
      .select(`
        id, amount, contract_id, bank_date, description,
        transaction_types!inner(code, label, direction, affects_liquidacion)
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
    /** Per-line breakdown for the Ingresos cell popover (Phase 6). One entry
     *  per affects_liquidacion IN transaction (RENT_IN + recuperos + others). */
    ingresosLines: IngresosLine[]
    // ── Movimientos cell — every transaction the contract has for the period
    //    regardless of affects_liquidacion. Drives the Movs. column on the
    //    planilla and the editable modal.
    movCount:    number
    movTotalIn:  number
    movTotalOut: number
  }
  const blank = (): Agg => ({
    ingresos: 0, admi: 0, otros: 0, payout: 0, galicia: 0, frances509: 0, frances516: 0,
    fechaBanco: null, diaTransf: null,
    ingresosLines: [],
    movCount: 0, movTotalIn: 0, movTotalOut: 0,
  })
  const agg = new Map<string, Agg>()

  for (const t of (txnsRes.data ?? []) as any[]) {
    if (!t.contract_id) continue
    const entry = agg.get(t.contract_id) ?? blank()
    // Defensive: if the inner join with transaction_types returned no row
    // (orphan transaction whose type was deleted, or a Supabase quirk),
    // skip rather than crash the whole planilla. Without this guard,
    // `typ.code` throws "Cannot read properties of null" — exactly the
    // generic server-side exception users see on Vercel.
    const typ = t.transaction_types
    if (!typ || typeof typ.code !== 'string') continue
    const amt = Number(t.amount)
    if (!isFinite(amt)) continue

    // Movimientos counters: every transaction on the contract+period counts
    // here, including those that don't affect_liquidacion (deposits etc.).
    // Direction comes straight from the transaction_types lookup.
    entry.movCount += 1
    if (typ.direction === 'IN')      entry.movTotalIn  += amt
    else if (typ.direction === 'OUT') entry.movTotalOut += amt

    if (typ.code === 'RENT_IN') {
      if (typ.affects_liquidacion) entry.ingresos += amt
      if (t.bank_date && (!entry.fechaBanco || t.bank_date > entry.fechaBanco)) {
        entry.fechaBanco = t.bank_date
      }
      // RENT_IN is always part of the Ingresos breakdown.
      entry.ingresosLines.push({
        transactionId: t.id, typeCode: typ.code, typeLabel: typ.label,
        amount: amt, description: t.description ?? null, bankDate: t.bank_date,
      })
    } else if (typ.affects_liquidacion && typ.direction === 'IN') {
      entry.ingresos += amt
      // Every IN that contributes to ingresos (EXPENSAS_IN, RECUPERO_*_IN,
      // LATE_FEE_IN, UTILITY_REFUND_IN, OTHER_IN, ...) gets its own line
      // in the breakdown so the encargada can see what was deposited.
      entry.ingresosLines.push({
        transactionId: t.id, typeCode: typ.code, typeLabel: typ.label,
        amount: amt, description: t.description ?? null, bankDate: t.bank_date,
      })
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
  // Diagnostic counters: surfaced via console so the cause of an empty
  // planilla can be inspected in Vercel runtime logs without DB access.
  let cnt_fetched          = 0
  let cnt_no_landlord_link = 0
  let cnt_no_tenant_link   = 0
  let cnt_threw            = 0
  // Capture the first error so the page-level safe() wrapper can surface
  // it in the red diagnostic banner when every contract row threw.
  let firstError: Error | null = null
  let firstErrorContract: string | null = null
  for (const c of (contractsRes.data ?? []) as any[]) {
    cnt_fetched++
    try {
    // Phase 11: never silently DROP a contract. If the junction is missing,
    // build a "phantom row" (with empty name fields) and flag it as orphan
    // so the encargada can click into the detail page and fix the data.
    // Previously rows with empty junctions disappeared from the planilla.
    const landlordsRaw = (c.contract_landlords ?? []) as any[]
    const tenantsRaw   = (c.contract_tenants   ?? []) as any[]
    const orphanReasons: string[] = []
    if (landlordsRaw.length === 0) {
      orphanReasons.push('contrato sin propietarios cargados')
      cnt_no_landlord_link++
    }
    if (tenantsRaw.length === 0) {
      orphanReasons.push('contrato sin inquilinos cargados')
      cnt_no_tenant_link++
    }
    const isOrphan = orphanReasons.length > 0
    const orphanReason = isOrphan ? orphanReasons.join(' · ') : null

    // Build the full lists (sorted by share desc). Used by the new
    // multi-name cells. Empty arrays when the junction is missing.
    const landlordsList = landlordsRaw
      .map((cl: any) => ({
        id:           cl.landlords?.id ?? '',
        name:         cl.landlords?.name ?? '',
        ownershipPct: Number(cl.ownership_pct ?? 0),
      }))
      .filter(l => l.id && l.name)
      .sort((a, b) => b.ownershipPct - a.ownershipPct)
    const tenantsList = tenantsRaw
      .map((ct: any) => ({
        id:        ct.tenants?.id ?? '',
        name:      ct.tenants?.name ?? '',
        sharePct:  Number(ct.share_pct ?? 100),
      }))
      .filter(t => t.id && t.name)
      .sort((a, b) => b.sharePct - a.sharePct)

    // Primary derivation falls back to a synthetic blank when the junction
    // is empty — we still emit the row so the user can see + fix it.
    const primary = landlordsList[0]
      ? { landlords: { id: landlordsList[0].id, name: landlordsList[0].name, email: null } }
      : null
    const tenant  = tenantsRaw.find((ct: any) => ct.is_primary) ?? tenantsRaw[0] ?? null

    const a = agg.get(c.id) ?? blank()
    const currentRent = Number(c.current_rent ?? 0)
    const deuda       = Math.max(0, currentRent - a.ingresos)

    // Aumento próximo: reuse same function the Pendientes bell uses
    const nextAdj    = c.start_date && c.cadence ? nextAdjustmentDate(c.start_date, c.cadence, today) : null
    const msUntilAdj = nextAdj ? nextAdj.getTime() - today.getTime() : null
    const daysUntilAdjustment = msUntilAdj != null ? Math.ceil(msUntilAdj / 86400000) : null
    const hasUpcomingAdjustment = daysUntilAdjustment != null && daysUntilAdjustment >= 0 && daysUntilAdjustment <= 30
    // ISO date for the cadence cell tooltip. Format YYYY-MM-DD.
    const nextAdjustmentDateIso = nextAdj
      ? `${nextAdj.getFullYear()}-${String(nextAdj.getMonth() + 1).padStart(2, '0')}-${String(nextAdj.getDate()).padStart(2, '0')}`
      : null

    // ── Payment countdown ────────────────────────────────────────────────
    // Each contract has its own payment_day (1-31). The due date for the
    // current period is YYYY-MM-payment_day, clamped to the last day of
    // the month so payment_day=31 in February becomes Feb 28/29.
    // Skipped (null) for contracts whose start_date is after this period
    // or whose end_date is before it.
    const paymentDay = (() => {
      const raw = Number(c.payment_day ?? 0)
      if (!Number.isFinite(raw) || raw < 1 || raw > 31) return 5  // safe default
      return Math.floor(raw)
    })()
    const periodActive = (() => {
      const periodStart = new Date(period)              // first of period month
      const periodMonthEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0)
      if (c.start_date && new Date(c.start_date) > periodMonthEnd) return false
      if (c.end_date   && new Date(c.end_date)   < periodStart)    return false
      return true
    })()
    let dueDateIso:       string | null = null
    let daysUntilPayment: number | null = null
    if (periodActive) {
      const [py, pm] = period.split('-').map(Number)
      // Clamp day to last day of the month.
      const lastDay  = new Date(py, pm, 0).getDate()
      const day      = Math.min(paymentDay, lastDay)
      const due      = new Date(py, pm - 1, day)
      dueDateIso     = `${py}-${String(pm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      // Use UTC-style day difference so DST doesn't bias the count.
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const dueMid   = new Date(due.getFullYear(),   due.getMonth(),   due.getDate())
      daysUntilPayment = Math.round((dueMid.getTime() - todayMid.getTime()) / 86400000)
    }

    // When the junction is missing we look for ANY liquidación on this
    // contract regardless of landlord_id — better than nothing.
    const liq = primary
      ? liqByKey.get(`${c.id}|${primary.landlords.id}`)
      : Array.from(liqByKey.values()).find((l: any) => l.contract_id === c.id)
    const adjustment = Number(liq?.adjustment_amount ?? 0)

    // Transferencia (computed) = ingresos - admi - otros + adjustment (signed)
    // Use the actual LANDLORD_PAYOUT if it exists, else fall back to computed.
    const transferencia = a.payout > 0 ? a.payout : Math.max(0, a.ingresos - a.admi - a.otros + adjustment)

    const pct = a.ingresos > 0 ? (a.admi / a.ingresos) * 100 : 0

    // IVA portion embedded inside the recorded ADMI. When the contract is
    // billed by an RI administrator (commission_includes_iva=true), the
    // COMMISSION_OUT amount the encargada records is the full +21% IVA
    // figure (matches the receipts: "ADM 9% + IVA = $100.188"). We split it
    // back out so the planilla shows what slice of ADMI is tax. For
    // Monotributo contracts the flag is false → IVA stays 0.
    const commissionIncludesIva = c.commission_includes_iva === true
    const iva = commissionIncludesIva ? a.admi * 0.21 / 1.21 : 0

    rows.push({
      contractId:           c.id,
      landlordId:           primary?.landlords.id ?? '',
      hasMultipleLandlords: landlordsList.length > 1,
      observacion:   liq?.notes ?? null,
      lfa:           c.lfa_code ?? null,
      propietario:   primary?.landlords.name ?? '(sin propietario)',
      propietarioEmail: primary?.landlords.email ?? null,
      inquilino:     tenant?.tenants?.name ?? '(sin inquilino)',
      landlordsList,
      tenantsList,
      isOrphan,
      orphanReason,
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
      commissionIncludesIva,
      iva,
      admGalicia:    a.galicia,
      admFrances509: a.frances509,
      admFrances516: a.frances516,
      movimientosCount:    a.movCount,
      movimientosTotalIn:  a.movTotalIn,
      movimientosTotalOut: a.movTotalOut,
      cadence:               c.cadence ?? null,
      paymentDay,
      dueDateIso,
      daysUntilPayment,
      hasUpcomingAdjustment,
      daysUntilAdjustment,
      nextAdjustmentDateIso,
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
      // Sorted: rent first, then by amount desc — most relevant lines
      // visible first when the popover opens.
      ingresosLines: a.ingresosLines.sort((x, y) => {
        if (x.typeCode === 'RENT_IN' && y.typeCode !== 'RENT_IN') return -1
        if (x.typeCode !== 'RENT_IN' && y.typeCode === 'RENT_IN') return 1
        return y.amount - x.amount
      }),
      // Phase 9C: pre-compute the Alquiler / Extras split so the grid
      // doesn't need to filter ingresosLines twice per render.
      //   Alquiler = sum of RENT_IN lines only.
      //   Extras   = sum of non-RENT_IN IN lines + signed adjustment.
      //              Can be POSITIVE (tenant paid recuperos) or NEGATIVE
      //              (the adjustment_amount discount dominates).
      ...((): { alquilerSum: number; extrasSum: number } => {
        try {
          let alquiler = 0
          let extrasRecuperos = 0
          for (const line of a.ingresosLines) {
            if (line.typeCode === 'RENT_IN') alquiler       += line.amount
            else                              extrasRecuperos += line.amount
          }
          return { alquilerSum: alquiler, extrasSum: extrasRecuperos + adjustment }
        } catch {
          return { alquilerSum: 0, extrasSum: 0 }
        }
      })(),
      // Contract-end row tint (revised 2026-06-17 — month-aligned, full row).
      // Plus the "this period has an aumento applied" flag for the
      // persistent blue tint on Alquiler. Both bundled here.
      ...(() => {
        const periodStart = new Date(period)
        const tier        = computeExpiryRowStatus(c.end_date ?? null, periodStart)
        const hasAumento  = periodHasAumentoApplied(c.start_date ?? null, c.cadence ?? null, periodStart)
        return {
          expiryRowStatus:      tier.status,
          daysUntilContractEnd: tier.daysUntil,
          periodHasAumento:     hasAumento,
        }
      })(),
      // Phase 7A validations: pure-function checks over the row data.
      // The contract's commission_pct is passed so the commission
      // deviation check has the expected % to compare against.
      validationIssues: validateRow(
        {
          ingresos:         a.ingresos,
          admi:             a.admi,
          otros:            a.otros,
          transferencia,
          adjustmentAmount: adjustment,
          admGalicia:       a.galicia,
          admFrances509:    a.frances509,
          admFrances516:    a.frances516,
          currentRent,
          pct,
          deuda,
          status:           (liq?.status ?? 'draft') as LiquidacionStatus,
          fechaBanco:       a.fechaBanco,
          diaTransf:        a.diaTransf,
          ingresosLines:    a.ingresosLines,
          daysUntilPayment,
          dueDateIso,
        },
        c.commission_pct != null ? Number(c.commission_pct) : undefined,
        commissionIncludesIva,
      ),
    })
    } catch (err) {
      // A single malformed contract row must NOT kill the whole grid query.
      // Log + skip. The planilla simply omits this contract for the period;
      // the encargada can still work on every other contract.
      cnt_threw++
      if (firstError == null) {
        firstError = err instanceof Error ? err : new Error(String(err))
        firstErrorContract = c?.id ?? null
      }
      try {
        const cid = c?.id ?? '(no id)'
        console.error(`[getLiquidacionGridForPeriod] row failed for contract ${cid}:`, err)
      } catch { /* ignore logging failure */ }
      continue
    }
  }

  // ── Diagnostic summary ───────────────────────────────────────────────────
  // Helps debug "table empty" reports without DB access. Search Vercel
  // runtime logs for "[GRID_DIAGNOSTIC]".
  try {
    console.log(
      `[GRID_DIAGNOSTIC] period=${period} fetched=${cnt_fetched} ` +
      `emitted=${rows.length} threw=${cnt_threw} ` +
      `no_landlord_junction=${cnt_no_landlord_link} ` +
      `no_tenant_junction=${cnt_no_tenant_link}`,
    )
  } catch { /* ignore logging failure */ }

  // Loud failure when EVERY contract threw and the table would otherwise be
  // empty for a non-DB reason. Throwing lets the page's safe() wrapper put
  // the error message in the red diagnostic banner instead of hiding the
  // bug behind a generic "no contracts" screen.
  if (cnt_fetched > 0 && rows.length === 0 && firstError) {
    const tail = firstErrorContract ? ` (primer contrato fallido: ${firstErrorContract})` : ''
    throw new Error(`Todas las filas fallaron al construirse — ${firstError.message}${tail}`)
  }

  // Default sort: alphabetical by propietario (Alejandro's explicit ask
  // — "que sea por orden alfabético de los propietarios"). The
  // recently-edited row is highlighted in yellow on the grid instead of
  // floating to the top. Orphan rows sink to the bottom so they don't
  // distract the daily scan.
  return rows.sort((a, b) => {
    if (a.isOrphan !== b.isOrphan) return a.isOrphan ? 1 : -1
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
        contract_tenants(is_primary, share_pct, tenants(id, name)),
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
        contract_tenants(is_primary, share_pct, tenants(id, name)),
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
