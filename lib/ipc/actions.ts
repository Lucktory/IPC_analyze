'use server'

// ============================================================================
// IPC refresh — fetch the INDEC index series and upsert it into cpi_values.
// Manual trigger (button); the one-month desfase in the aumento rule means the
// data we need is always already published, so no scheduling is required.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { fetchIndecIpc } from './fetch'

export interface RefreshIpcResult {
  ok:    boolean
  error: string | null
  count?: number
  latest?: string | null
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Pull the INDEC IPC index level (from 2023-01) and upsert each month into
 * cpi_values (index_value = level, variation_pct = derived m/m change). Idempotent.
 */
export async function refreshIpc(): Promise<RefreshIpcResult> {
  try {
    const points = await fetchIndecIpc('2023-01')
    if (!points.length) return { ok: false, error: 'No se recibieron datos del INDEC.' }

    const rows = points.map((p, i) => {
      const prev = i > 0 ? points[i - 1].indexValue : null
      const variation = prev ? ((p.indexValue - prev) / prev) * 100 : 0
      return { month: p.month, index_value: p.indexValue, variation_pct: round3(variation), source: 'INDEC' }
    })

    const supabase = await createSupabaseServer()
    const { error } = await supabase.from('cpi_values').upsert(rows, { onConflict: 'month' })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/liquidacion')
    return { ok: true, error: null, count: rows.length, latest: rows[rows.length - 1]?.month ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al traer el IPC.' }
  }
}
