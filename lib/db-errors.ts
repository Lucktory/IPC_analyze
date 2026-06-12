// ============================================================================
// Postgres error helpers — translates raw PG errors into the action-result
// shape `{ ok: false, error: string }` that all server actions return.
//
// Two codes show up in this app:
//   23503 → foreign_key_violation — fires when deleting a parent record
//           that still has children (e.g. eliminar banco with cuentas).
//   23505 → unique_violation       — fires on UNIQUE-constraint conflicts
//           (e.g. banks.name already exists).
//
// Before this module, every actions.ts file open-coded the same `as any`
// cast + regex fallback.
// ============================================================================

export const PG_CODE = {
  FK_VIOLATION:     '23503',
  UNIQUE_VIOLATION: '23505',
} as const

/**
 * True when the supabase-js error is the given Postgres code. The fallback
 * regex catches cases where the driver loses the code field — e.g. when
 * the message is just `'duplicate key value violates ...'`.
 */
export function isPgCode(err: unknown, code: string): boolean {
  const e = err as { code?: string; message?: string } | null | undefined
  if (!e) return false
  if (e.code === code) return true
  if (code === PG_CODE.FK_VIOLATION     && /foreign key/i.test(e.message ?? '')) return true
  if (code === PG_CODE.UNIQUE_VIOLATION && /duplicate key/i.test(e.message ?? '')) return true
  return false
}

export interface ActionFailure {
  ok:    false
  error: string
}

/**
 * Turn a raw supabase-js error into the standard `{ ok: false, error }`
 * shape. Pass `fkMessage` / `uniqueMessage` to override the user-facing
 * text for those specific constraint violations. Anything else falls
 * through to the driver's own error message.
 */
export function dbFailure(
  err:           unknown,
  overrides:     { fkMessage?: string; uniqueMessage?: string } = {},
): ActionFailure {
  if (overrides.fkMessage && isPgCode(err, PG_CODE.FK_VIOLATION)) {
    return { ok: false, error: overrides.fkMessage }
  }
  if (overrides.uniqueMessage && isPgCode(err, PG_CODE.UNIQUE_VIOLATION)) {
    return { ok: false, error: overrides.uniqueMessage }
  }
  const message = (err as { message?: string } | null | undefined)?.message
  return { ok: false, error: message ?? 'Error desconocido' }
}
