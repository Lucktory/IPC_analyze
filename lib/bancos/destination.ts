// ============================================================================
// Bank destination — SINGLE SOURCE OF TRUTH for the COMMISSION_OUT bank tag.
//
// The three Pampa bank accounts have no destination column; each commission
// row encodes its account as a text marker on the description
// (ADM_GALICIA / ADM_FRANCES_50_9 / ADM_FRANCES_51_6). This module owns the
// marker set, the priority order, the classifier, the strip regex, and the
// write format. Every reader (bancos, reconciliation, dashboard, conciliacion,
// movimientos, contract, liquidacion) and both writers (setCommission,
// upsertCellTransaction) import from here — so adding a 4th account is a
// one-line change instead of a hunt across ~9 files (miss one and that bank's
// commissions silently fall into OTHER on some surfaces and not others).
// ============================================================================

export type CommissionDest = 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6'
export type DestinationCode = CommissionDest | 'OTHER'

/** Marker codes in priority order — first match wins. Add a bank here ONCE. */
export const COMMISSION_DESTINATIONS: readonly CommissionDest[] = [
  'ADM_GALICIA',
  'ADM_FRANCES_50_9',
  'ADM_FRANCES_51_6',
]

/** Strips a trailing " · ADM_…" / " - ADM_…" marker from a description. */
export const COMMISSION_MARKER_RE = /\s*[·-]\s*ADM_(GALICIA|FRANCES_50_9|FRANCES_51_6)\b/g

/** description → code, with OTHER when no marker is present (reader/aggregator side). */
export function classifyDestination(description: string | null): DestinationCode {
  const d = description ?? ''
  for (const code of COMMISSION_DESTINATIONS) if (d.includes(code)) return code
  return 'OTHER'
}

/** description → code or undefined when unmarked (WRITER side: "no marker" means
 *  unclassified, not a bucket). */
export function deriveCommissionDest(description: string | null): CommissionDest | undefined {
  const code = classifyDestination(description)
  return code === 'OTHER' ? undefined : code
}

/** The canonical marker suffix appended to a commission description. */
export function buildCommissionMarker(dest: CommissionDest): string {
  return ` · ${dest}`
}

/** Short bank labels (Galicia / BBVA 50-9 / BBVA 51-6). */
export const DESTINATION_SHORT_LABEL: Record<CommissionDest, string> = {
  ADM_GALICIA:      'Galicia',
  ADM_FRANCES_50_9: 'BBVA 50-9',
  ADM_FRANCES_51_6: 'BBVA 51-6',
}

/** description → short bank label, or null when unmarked. */
export function bankShortFromDescription(description: string | null): string | null {
  const code = classifyDestination(description)
  return code === 'OTHER' ? null : DESTINATION_SHORT_LABEL[code]
}
