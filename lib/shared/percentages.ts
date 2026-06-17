// ============================================================================
// Percentage helpers — single source of truth for "sums must equal 100"
// validation across server actions and client modals.
//
// Used by:
//   • createContractFromGrid (server)        — landlord ownership + tenant share
//   • updatePropertyOwners (server)          — property co-ownership
//   • updateContractTenants (server)         — contract co-tenancy
//   • NewContractModal (client)              — live sum display
//   • EditPropertyForm (client)              — live sum display
//
// Never duplicate PCT_SUM_EPSILON or its check anywhere. Always import from
// `@/lib/shared`.
// ============================================================================

/**
 * Tolerance for "sum of N percentages equals 100".
 *
 * Picked so that 33.33 + 33.33 + 33.34 = 100.00 passes (a common case
 * for three-way splits) while still catching real input errors.
 */
export const PCT_SUM_EPSILON = 0.05

/**
 * Sum of a list of percentage values. Wraps reduce with a safe Number
 * coercion so `'33.33'` strings work too — the modal stores `pct` as a
 * string while the user types it.
 */
export function pctSum(values: ReadonlyArray<number | string | null | undefined>): number {
  let total = 0
  for (const v of values) {
    const n = typeof v === 'string' ? Number(v) : (v ?? 0)
    if (Number.isFinite(n)) total += n
  }
  return total
}

/**
 * True if the values sum to 100 within tolerance. Use for both the
 * client-side live indicator (green pill) and the server-side guard
 * before INSERTing junction rows.
 */
export function isPctSum100(values: ReadonlyArray<number | string | null | undefined>): boolean {
  return Math.abs(pctSum(values) - 100) <= PCT_SUM_EPSILON
}

/**
 * True if every value is a valid per-row percentage (number in (0, 100]).
 * Use alongside isPctSum100 — both must pass.
 */
export function arePctRowsValid(values: ReadonlyArray<number | string | null | undefined>): boolean {
  for (const v of values) {
    const n = typeof v === 'string' ? Number(v) : v
    if (!Number.isFinite(n as number)) return false
    if ((n as number) <= 0 || (n as number) > 100) return false
  }
  return true
}
