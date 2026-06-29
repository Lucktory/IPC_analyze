// ============================================================================
// Tunable thresholds for the /liquidacion planilla (Phase 9A → 9C).
//
// Anything user-tunable lives here. Change a number, redeploy, done. No
// code elsewhere needs to move. Each export is a single number or grouped
// numeric object — easy to diff in PRs, easy to grep for callers.
// ============================================================================

// ── Contract-end visual alert — WHOLE-ROW TINT (revised 2026-06-18) ─────────
//
// Alejandro's spec (voice 2026-06-18): blue palette for the two-month
// runway, swapping out the earlier yellow/orange. The change frees orange
// for the aumento cell marker below, so the planilla has one color per
// concept instead of fighting over the orange slot.
//
//   • end_date in the NEXT month     → celeste (sky-100) — first warning
//   • end_date in the CURRENT month  → azul más oscuro (sky-300/70) — vencimiento
//   • end_date already past          → red (red-100) — past due
//   • otherwise                       → no tint
//
// Why month-aligned (not days-based): Alejandro thinks in calendar
// months and wants the tint to flip exactly when a new month starts.
// A 30-day threshold would drift across the month boundary and not
// match how he scans.
//
// Memory rule applied: every tint class lives in this file, never hex
// codes hardcoded in components (see ui_planilla_color_conventions.md).
export const CONTRACT_EXPIRY_ROW_CLASSES = {
  normal:     '',
  next_month: 'bg-sky-200',        // celeste — primer aviso (vencimiento el mes que viene)
  this_month: 'bg-sky-400/70',     // azul más oscuro — vencimiento este mes
  expired:    'bg-red-200',        // past due — already expired
} as const

export type ContractExpiryRowStatus =
  | 'normal'
  | 'next_month'
  | 'this_month'
  | 'expired'

// ── Aumento marker on the Alquiler cell (revised 2026-06-18) ───────────────
//
// Alejandro's spec (voice 2026-06-18): light orange tint on the Alquiler
// cell when this period contains a rent-adjustment date. The tint stays
// even AFTER the cobro is registered — that's the visual proof the cobro
// came in WITH the increase. Switched from blue (bg-info/15) to orange
// after the 2026-06-18 redesign moved expiry tints to the blue palette;
// keeping orange single-purpose (= aumento) makes the planilla scannable.
//
// Text color of the cell already encodes "cobrado vs pending" (dark
// ink vs light slate). This tint is independent of that.
export const ALQUILER_AUMENTO_CELL_CLASS = 'bg-orange-300/70'

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

// ── IVA on the administration commission ────────────────────────────────────
//
// When a contract is invoiced by a Responsable Inscripto administrator
// (contracts.commission_includes_iva = true), the recorded COMMISSION_OUT is
// the commission + 21% IVA — Alejandro's "ADM 9% + IVA". Monotributo invoicers
// add no IVA. Single source for the rate: the commission generator, the
// COMMISSION_PCT_DEVIATION check, and the IVA-column split all read it here,
// so they can never drift apart.
export const COMMISSION_IVA_RATE = 0.21
