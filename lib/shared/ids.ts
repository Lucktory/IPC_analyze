// ============================================================================
// Local UI ids — used to key dynamic rows (landlord rows, tenant rows, etc.)
// in client components. These never travel to the server.
// ============================================================================

/**
 * Random ~6-char id suitable for React `key` on dynamic rows.
 *
 * Not for database use. Not cryptographically secure. Just unique enough
 * to keep React's reconciler happy across add / remove operations.
 */
export function makeRowId(prefix = 'row'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}
