// ============================================================================
// Shared types + constants for the Ingresos breakdown popover (Phase 6).
//
// Why this is a separate file instead of living in ingresos-line-actions.ts:
// the latter is marked 'use server' and Next.js requires EVERY export from
// a 'use server' module to be an async function. Exporting a constant like
// INGRESOS_LINE_TYPES from a server-action module is a runtime error
// (manifests as a client-side exception when the page loads).
//
// This file has no 'use server' directive so both server actions AND
// client components can import the same canonical list.
// ============================================================================

export const INGRESOS_LINE_TYPES = [
  'RENT_IN',
  'RENT_NF_IN',
  'EXPENSAS_IN',
  'LATE_FEE_IN',
  'RECUPERO_ABL_IN',
  'RECUPERO_AYSA_IN',
  'RECUPERO_METROGAS_IN',
  'RECUPERO_EDESUR_IN',
  'RECUPERO_SCPL_IN',
  'RECUPERO_COAGUA_IN',
  'RECUPERO_OTRO_IN',
  'UTILITY_REFUND_IN',
  'OTHER_IN',
] as const

export type IngresosLineType = typeof INGRESOS_LINE_TYPES[number]

export function isAllowedIngresosLineType(s: string): s is IngresosLineType {
  return (INGRESOS_LINE_TYPES as readonly string[]).includes(s)
}

// ============================================================================
// RECUPERO_SERVICES — SINGLE SOURCE OF TRUTH for the recupero/servicio labels.
//
// Every surface that shows a service label derives from THIS list so the
// wording can never drift and adding a new service is a one-line edit here:
//   • Planilla "Extras" dropdown        → uses `full`  (InlineIngresosCell)
//   • Recargos "Tipo" dropdown          → uses `short` (RecurringChargesEditor)
//   • Recargos "Etiqueta" suggestions   → uses `short` (RecurringChargesEditor)
//
// `code` must equal the transaction_types.code: it is what links a recurring
// charge RULE to its cobro TRANSACTION (see recurring-charges-bulk). The codes
// are also members of INGRESOS_LINE_TYPES above — keep the two in sync.
// ============================================================================
export interface RecuperoService {
  code:  string
  /** Compact label for tight dropdowns / name suggestions. */
  short: string
  /** Full label, mirrors transaction_types.label. */
  full:  string
}

export const RECUPERO_SERVICES: readonly RecuperoService[] = [
  { code: 'RECUPERO_ABL_IN',      short: 'ABL',             full: 'Recupero ABL' },
  { code: 'RECUPERO_METROGAS_IN', short: 'Gas',             full: 'Recupero Metrogas / Gas' },
  { code: 'RECUPERO_EDESUR_IN',   short: 'Luz',             full: 'Recupero Edesur / Luz' },
  { code: 'RECUPERO_AYSA_IN',     short: 'Agua',            full: 'Recupero AySA' },
  { code: 'RECUPERO_SCPL_IN',     short: 'SCPL (luz/agua)', full: 'Recupero SCPL (luz/agua)' },
  { code: 'RECUPERO_COAGUA_IN',   short: 'Coagua (agua)',   full: 'Recupero Coagua (agua)' },
  { code: 'RECUPERO_OTRO_IN',     short: 'Otro',            full: 'Recupero otro servicio' },
]
