// ============================================================================
// Period — single source of truth for "what month are we auditing right now".
//
// Every list page, dashboard query, and detail page used to hardcode
// '2026-05-01' or '2026-06-01' independently, so different pages disagreed
// on what "the current period" meant. This file fixes that: one call,
// derived from today's date, used everywhere.
//
// Format: 'YYYY-MM-01' (first-of-month, ISO date string).
// ============================================================================

export function getCurrentPeriod(): string {
  const today = new Date()
  const year  = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

const MONTHS_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** "Mayo 2026" from "2026-05-01" */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTHS_FULL[+m - 1]} ${y}`
}

/** "May 2026" from "2026-05-01" — for compact pill rows */
export function periodShort(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTHS_SHORT[+m - 1]} ${y}`
}

/** Convenience: current period's full label, e.g. "Junio 2026" */
export function getCurrentPeriodLabel(): string {
  return periodLabel(getCurrentPeriod())
}

/** "Jun" / "Ene" — three-letter month, no year. For tight axis labels. */
export function periodAxisLabel(period: string): string {
  const [, m] = period.split('-')
  return MONTHS_SHORT[+m - 1].toLowerCase()
}

/**
 * Last `n` periods including the current one, ordered oldest → newest.
 * Used by the dashboard trend widgets.
 */
export function getRecentPeriods(n: number): string[] {
  const out: string[] = []
  const today = new Date()
  // Walk back from current month
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    out.push(`${year}-${month}-01`)
  }
  return out
}
