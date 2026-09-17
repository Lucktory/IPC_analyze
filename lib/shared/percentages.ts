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
 * Valida el porcentaje de UN co-propietario de contrato. Devuelve el mensaje de
 * error, o null si esta bien.
 *
 * EL 0% ES VALIDO, Y ES LA PIEZA QUE FALTABA (2026-09-17)
 *
 * El porcentaje decide cuanta plata le toca; estar en el contrato decide si
 * recibe el mail. Son dos cosas distintas, y sin el 0 no habia forma de separar
 * la segunda de la primera: la unica manera de decir "a esta persona no le
 * transfieras nada" era sacarla del contrato, y sacarla tambien la dejaba sin
 * mail.
 *
 * Los casos reales que Alejandro paso el 2026-09-17:
 *   • Andrade Berta 100 / Silvia Bautista 0 — la plata va entera a Berta, pero
 *     la hija recibe copia del mail.
 *   • Simoes Adrian 100 / Juan 0 — mientras se acomoda la sucesion cobra
 *     Adrian, y los dos hermanos reciben el mail.
 *
 * Los porcentajes tienen que seguir sumando 100 (isPctSum100), asi que 100 + 0
 * pasa y nada mas se afloja.
 *
 * Una sola definicion para los dos caminos que cargan propietarios -- el alta
 * del contrato y la edicion desde la planilla -- que antes repetian la condicion
 * cada uno por su lado.
 */
export function ownershipPctError(pct: unknown): string | null {
  const n = typeof pct === 'string' ? Number(pct) : (pct as number)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return 'Cada propietario debe tener un porcentaje entre 0 y 100. Poné 0 si no le corresponde plata pero igual tiene que recibir el mail.'
  }
  return null
}

/**
 * Split 100% equally across N rows, putting the rounding residue on the FIRST
 * (primary) row so the set sums to exactly 100 and every row stays in (0, 100].
 * Single source of truth for equal co-ownership / co-tenancy splits (app writers
 * and the import script) so none of them land on sum≠100.
 *   equalSplit(1) → [100]   equalSplit(2) → [50, 50]   equalSplit(3) → [33.34, 33.33, 33.33]
 */
export function equalSplit(n: number): number[] {
  if (n <= 0) return []
  const base   = +(100 / n).toFixed(2)
  const shares = Array<number>(n).fill(base)
  shares[0] = +(100 - base * (n - 1)).toFixed(2)
  return shares
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
