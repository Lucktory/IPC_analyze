// ============================================================================
// LFA code — the L/F/A (responsable) label on a contract. One normalization
// rule for every writer: trim + uppercase + whitelist. Kept in a plain module
// (not a 'use server' file) so create paths and the inline editor all share it
// and can never persist divergent casing ('a' vs 'A') or an out-of-set value.
// ============================================================================

export const ALLOWED_LFA = ['L', 'F', 'A', 'FL', 'D'] as const
export type AllowedLfa = typeof ALLOWED_LFA[number]

export function isLfa(s: string): s is AllowedLfa {
  return (ALLOWED_LFA as readonly string[]).includes(s)
}

export type NormalizeLfaResult =
  | { ok: true;  value: AllowedLfa | null }
  | { ok: false; error: string }

/** Canonicalize an LFA code: trim + uppercase, empty → null, else validate. */
export function normalizeLfa(raw: string | null | undefined): NormalizeLfaResult {
  const v = raw?.trim().toUpperCase() || null
  if (v === null) return { ok: true, value: null }
  if (!isLfa(v))  return { ok: false, error: `LFA invalido. Valores aceptados: ${ALLOWED_LFA.join(' / ')}.` }
  return { ok: true, value: v }
}
