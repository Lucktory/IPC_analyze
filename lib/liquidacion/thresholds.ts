// ============================================================================
// Tunable thresholds for the /liquidacion planilla (Phase 9A → 9C).
//
// Anything user-tunable lives here. Change a number, redeploy, done. No
// code elsewhere needs to move. Each export is a single number or grouped
// numeric object — easy to diff in PRs, easy to grep for callers.
// ============================================================================

// ── Contract-end visual alert — WHOLE-ROW TINT (revised 2026-06-17) ─────────
//
// Alejandro's revised spec (voice 2026-06-17): the whole row should be
// tinted based on the calendar position of end_date vs the current period
// (NOT days-based). Replaces the Phase 9A per-cell blue tier system —
// blue is now reserved for the aumento marker below.
//
//   • end_date already past → row tinted red (past due — most urgent)
//   • end_date in the CURRENT month → soft orange (this is the expiry month)
//   • end_date in the NEXT month → soft yellow (renewal conversation starts)
//   • otherwise → no tint
//
// Why month-aligned (not days-based): Alejandro thinks in calendar
// months and wants the tint to flip exactly when a new month starts.
// "Last month yellow, this month orange" — a 30-day threshold would
// drift across the month boundary and not match how he scans.
//
// Memory rule applied: every tint class lives in this file, never hex
// codes hardcoded in components (see ui_planilla_color_conventions.md).
export const CONTRACT_EXPIRY_ROW_CLASSES = {
  normal:     '',
  next_month: 'bg-yellow-100',     // soft yellow — vencimiento el mes que viene
  this_month: 'bg-orange-200',     // soft orange — vencimiento este mes
  expired:    'bg-red-100',        // past due — already expired
} as const

export type ContractExpiryRowStatus =
  | 'normal'
  | 'next_month'
  | 'this_month'
  | 'expired'

// ── Aumento marker on the Alquiler cell (revised 2026-06-17) ───────────────
//
// Alejandro's spec: when this period contains a rent-adjustment date,
// the Alquiler cell gets a persistent light-blue background tint. It
// stays even AFTER the cobro is registered — that's the visual proof
// that the cobro came in WITH the increase. Replaces the old soft-orange
// "aumento próximo" tint that fired only on the 30-day countdown.
//
// Text color of the cell already encodes "cobrado vs pending" (dark
// ink vs light slate). This tint is independent of that.
export const ALQUILER_AUMENTO_CELL_CLASS = 'bg-info/15'

// ── Phase 10 — Cadence column display labels ────────────────────────────────
//
// Alejandro (2026-06-17): "falta una columna donde te avisa… los aumentos
// son trimestrales y bimestrales." Adds the contract's adjustment cadence
// as a visible column on the planilla so the encargada can answer
// "every how often is rent adjusted?" without opening the contract.
//
// Short codes (≤4 chars) so the column stays narrow. Full label is shown
// in the tooltip together with the next adjustment date.
export const CADENCE_SHORT: Record<string, string> = {
  mensual:       'Mens',
  bimestral:     'Bim',
  trimestral:    'Trim',
  cuatrimestral: 'Cuat',
  semestral:     'Sem',
  anual:         'An',
}

export const CADENCE_FULL: Record<string, string> = {
  mensual:       'Mensual',
  bimestral:     'Bimestral',
  trimestral:    'Trimestral',
  cuatrimestral: 'Cuatrimestral',
  semestral:     'Semestral',
  anual:         'Anual',
}
