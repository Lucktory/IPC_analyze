// ============================================================================
// IPC index reads — the monthly INDEC index LEVEL stored in cpi_values.
// Keyed by 'YYYY-MM' for the aumento calculation (lib/contract/aumento.ts).
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface IpcCoverage {
  months:  string[]   // 'YYYY-MM' present, oldest→newest
  latest:  string | null
  count:   number
}

/**
 * Map of 'YYYY-MM' → INDEC index level from cpi_values. Pass `months` to filter.
 * Only rows with a non-null index_value are returned (a row can exist with just
 * variation_pct from a legacy import).
 */
export async function getIpcIndexMap(months?: string[]): Promise<Record<string, number>> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.from('cpi_values').select('month, index_value').order('month')

  const map: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    if (r.index_value == null) continue
    map[String(r.month).slice(0, 7)] = Number(r.index_value)
  }
  if (months && months.length) {
    const filtered: Record<string, number> = {}
    for (const m of months) if (map[m] != null) filtered[m] = map[m]
    return filtered
  }
  return map
}

/** What months of index data we currently have — for the "Actualizar IPC" panel. */
export async function getIpcCoverage(): Promise<IpcCoverage> {
  const map = await getIpcIndexMap()
  const months = Object.keys(map).sort()
  return { months, latest: months[months.length - 1] ?? null, count: months.length }
}
