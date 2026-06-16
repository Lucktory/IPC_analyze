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
  'EXPENSAS_IN',
  'LATE_FEE_IN',
  'RECUPERO_ABL_IN',
  'RECUPERO_AYSA_IN',
  'RECUPERO_METROGAS_IN',
  'RECUPERO_EDESUR_IN',
  'RECUPERO_OTRO_IN',
  'UTILITY_REFUND_IN',
  'OTHER_IN',
] as const

export type IngresosLineType = typeof INGRESOS_LINE_TYPES[number]

export function isAllowedIngresosLineType(s: string): s is IngresosLineType {
  return (INGRESOS_LINE_TYPES as readonly string[]).includes(s)
}
