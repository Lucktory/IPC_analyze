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

// The app serves an Argentine agency but runs on UTC infra (Vercel). A bare
// `new Date()` is UTC, so late in the day it's already "tomorrow" — and on the
// last day of the month, "next month". That rolled the planilla to an empty
// next period while it was still the current month in Argentina. Compute the
// calendar date in ART so "current period" matches the office's clock.
const AR_TZ = 'America/Argentina/Buenos_Aires'

/** Current calendar date in Argentina (UTC-3), as a Date whose
 *  getFullYear/getMonth/getDate return the ART values (midnight-anchored). */
export function getArgentinaToday(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return new Date(get('year'), get('month') - 1, get('day'))
}

export function getCurrentPeriod(): string {
  const today = getArgentinaToday()
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
 * Whole months from period `a` to period `b` (both 'YYYY-MM-01').
 * Positive when `b` is after `a`. monthsBetween('2026-01-01','2026-03-01') === 2.
 */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

/** Shift a 'YYYY-MM-01' period by `months` (may be negative). Handles year
 *  rollover. shiftPeriod('2026-12-01', 1) === '2027-01-01'. */
export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, (m - 1) + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Last `n` periods including the current one, ordered oldest → newest.
 * Used by the dashboard trend widgets.
 */
export function getRecentPeriods(n: number): string[] {
  const out: string[] = []
  const today = getArgentinaToday()
  // Walk back from current month
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    out.push(`${year}-${month}-01`)
  }
  return out
}
