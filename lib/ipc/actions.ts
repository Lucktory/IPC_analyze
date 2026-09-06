'use server'

// ============================================================================
// IPC refresh + status.
//   refreshIpc()   — fetch the INDEC index series and upsert into cpi_values;
//                    returns the recent months so the UI can show what changed.
//   getIpcStatus() — latest loaded month + last fetch time + whether an auto
//                    refresh is due (from the 15th, once last month is missing).
// The one-month desfase means the data we need is always already published.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/current-user'
import { fetchIndecIpc } from './fetch'
import { getArgentinaToday } from '@/lib/period'
import { shiftMonth } from '@/lib/contract/aumento'

export interface IpcMonthRow { month: string; variationPct: number; indexValue: number }

export interface RefreshIpcResult {
  ok:      boolean
  error:   string | null
  count?:  number
  latest?: string | null          // 'YYYY-MM' of the newest month loaded
  months?: IpcMonthRow[]           // most recent months (for the modal)
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Pull the INDEC IPC index level (from 2023-01) and upsert into cpi_values. */
export async function refreshIpc(): Promise<RefreshIpcResult> {
  // requireUser, NOT requireSuperAdmin: IpcRefreshControl lives in the TopBar
  // (components/shell/TopBar.tsx) and both this and getIpcStatus fire from its
  // useEffect for EVERY logged-in user. A super-admin gate here would silently
  // kill the daily IPC auto-refresh for the encargadas.
  const me = await requireUser()
  if (!me) return { ok: false, error: 'No autorizado.' }
  try {
    const points = await fetchIndecIpc('2023-01')
    if (!points.length) return { ok: false, error: 'El INDEC no devolvió datos.' }

    const rows = points.map((p, i) => {
      const prev = i > 0 ? points[i - 1].indexValue : null
      const variation = prev ? ((p.indexValue - prev) / prev) * 100 : 0
      return { month: p.month, index_value: p.indexValue, variation_pct: round3(variation), source: 'INDEC' }
    })

    const supabase = await createSupabaseServer()
    const { error } = await supabase.from('cpi_values').upsert(rows, { onConflict: 'month' })
    if (error) return { ok: false, error: error.message }

    revalidatePath('/liquidacion')
    revalidatePath('/diagnostico')
    const recent: IpcMonthRow[] = rows.slice(-8).map(r => ({
      month: String(r.month).slice(0, 7), variationPct: r.variation_pct, indexValue: r.index_value,
    }))
    return { ok: true, error: null, count: rows.length, latest: recent[recent.length - 1]?.month ?? null, months: recent }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo conectar con el INDEC.' }
  }
}

export interface IpcStatus {
  latestMonth:   string | null    // 'YYYY-MM'
  lastFetchedAt: string | null    // ISO
  needsRefresh:  boolean          // day ≥ 15 AND last month not loaded yet
  todayKey:      string           // 'YYYY-MM-DD' (ART) — per-day auto-refresh guard
}

export async function getIpcStatus(): Promise<IpcStatus> {
  // IpcStatus carries no `ok` field, so an unauthorized caller gets a neutral
  // status instead of an error. needsRefresh MUST be false here: the TopBar
  // control auto-calls refreshIpc() when it sees true, and returning true to an
  // unauthenticated caller would invite a pointless refresh loop.
  const me = await requireUser()
  if (!me) {
    return { latestMonth: null, lastFetchedAt: null, needsRefresh: false, todayKey: '' }
  }
  const supabase = await createSupabaseServer()
  const [latestRes, fetchedRes] = await Promise.all([
    supabase.from('cpi_values').select('month').order('month', { ascending: false }).limit(1),
    supabase.from('cpi_values').select('fetched_at').not('index_value', 'is', null).order('fetched_at', { ascending: false }).limit(1),
  ])
  const latestMonth   = (latestRes.data?.[0] as any)?.month ? String((latestRes.data![0] as any).month).slice(0, 7) : null
  const lastFetchedAt = (fetchedRes.data?.[0] as any)?.fetched_at ?? null

  const today = getArgentinaToday()
  const day   = today.getDate()
  const y = today.getFullYear(), m = today.getMonth() + 1
  const curMonth  = `${y}-${String(m).padStart(2, '0')}`
  const prevMonth = shiftMonth(curMonth, -1)
  // From the 15th, INDEC has published last month — if we don't have it, refresh.
  const needsRefresh = day >= 15 && (latestMonth == null || latestMonth < prevMonth)

  return { latestMonth, lastFetchedAt, needsRefresh, todayKey: `${curMonth}-${String(day).padStart(2, '0')}` }
}
