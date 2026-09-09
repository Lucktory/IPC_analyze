// ============================================================================
// Locale-aware formatters. All of these target es-AR (Argentine Spanish).
//
// Defined here so every page renders money / dates / time the same way.
// Before this module existed, the same `toLocaleString('es-AR', ...)` calls
// were duplicated across ~15 files with subtle differences (some pages
// rounded to the integer peso, /bancos showed two decimals, dates used
// different month formats). All inconsistencies fold into one place now.
// ============================================================================

/**
 * Format a peso amount.
 *
 * @param n         Amount in pesos. `null` / `undefined` renders the empty string.
 * @param decimals  Decimal places to show. Defaults to 0 — pesos are
 *                  almost always shown as integers in this UI. Bancos
 *                  uses 2 (fees), so it passes `2` explicitly.
 */
export function fmtMoney(n: number | null | undefined, decimals = 0): string {
  if (n == null) return ''
  const rounded = decimals === 0 ? Math.round(n) : n
  return '$' + rounded.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Signed peso amount with the sign ALWAYS before the `$`: "+$7", "-$10", "$0".
 *
 * `fmtMoney(-10)` renders "$-10" (the minus lands after the symbol), so any
 * call site that also wanted a leading "+" for positives ended up mixing
 * "+$7" with "$-10". This formats the magnitude and prepends the sign so a
 * column of gains/losses reads consistently. Zero shows no sign.
 */
export function fmtSignedMoney(n: number | null | undefined, decimals = 0): string {
  if (n == null) return ''
  const rounded = decimals === 0 ? Math.round(n) : n
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : ''
  return sign + fmtMoney(Math.abs(rounded), decimals)
}

/** "HH:MM" — used for the "Guardado HH:MM" form footer. */
export function fmtTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/** "DD/MM/YYYY HH:MM" — full timestamp, e.g. for audit captions. */
export function fmtDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** "DD/MM/YYYY" — short numeric date. */
export function fmtDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/** "14 de junio de 2026" — long-form date for contract detail pages. */
export function fmtDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ── Added 2026-09-09 ────────────────────────────────────────────────────────
// Three formats that existed only as copies scattered across pages and
// components. The header above claims this module is where formatting lives;
// these are the pieces that were missing, which is why call sites hand-rolled
// them instead.

/**
 * "1.234" — a COUNT, not money. No currency symbol.
 *
 * Used for every KPI tile that shows a number of contracts / tenants /
 * properties. Distinct from fmtMoney on purpose: prefixing those with "$"
 * would be wrong. Previously defined in components/charts/theme.ts, which
 * re-exports this one now so the chart components keep their import.
 */
export function fmtInt(n: number | null | undefined): string {
  if (n == null || !isFinite(Number(n))) return '0'
  return Math.round(Number(n)).toLocaleString('es-AR')
}

/**
 * "05/06" — day and month only, for dense grid columns. Em dash when absent.
 *
 * NOTE: parses with `new Date(s)`, preserving the exact behaviour of the two
 * identical copies this replaces (DestinosView / MovimientosView). That means a
 * date-only string is read as UTC midnight and can render one day early in a
 * runtime behind UTC. Left as-is deliberately — changing it would shift dates
 * currently on screen, which is a separate decision from removing the
 * duplication.
 */
export function fmtDayMonth(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

/**
 * "1.234,56" — an INDEX level (INDEC IPC), up to 2 decimals, no symbol.
 * Em dash when absent. Replaces identical helpers in AplicarAumentoControl
 * and IpcRefreshControl.
 */
export function fmtIndex(n: number | null | undefined): string {
  if (n == null || !isFinite(Number(n))) return '—'
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}
