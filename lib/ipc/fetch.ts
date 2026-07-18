// ============================================================================
// INDEC IPC fetch — pulls the "IPC Nacional Nivel General" INDEX LEVEL (base
// dic-2016) from the datos.gob.ar Series de Tiempo API. We store the index
// LEVEL (full precision) rather than the rounded monthly %, so the aumento
// matches the ARquiler calculator to the peso (see lib/contract/aumento.ts).
//
// This is the same series ARquiler uses internally. BCRA idVariable 27
// ("Inflación mensual") is an alternative but rounds to 1 decimal (~$130 off),
// so it's only a cross-check, not the source of truth.
// ============================================================================

/** INDEC IPC Nacional Nivel General, base dic-2016, monthly index. */
export const INDEC_IPC_SERIES = '148.3_INIVELNAL_DICI_M_26'

export interface IpcPoint {
  month:      string   // 'YYYY-MM-01'
  indexValue: number   // INDEC index level, full precision
}

/**
 * Fetch the INDEC IPC index level series between two months (inclusive).
 * `startDate` / `endDate` are 'YYYY-MM'. Returns points oldest-first.
 * Throws on network / non-200 so the caller can fall back to manual entry.
 */
export async function fetchIndecIpc(startDate = '2023-01', endDate?: string): Promise<IpcPoint[]> {
  const params = new URLSearchParams({ ids: INDEC_IPC_SERIES, format: 'json', start_date: startDate, limit: '1000' })
  if (endDate) params.set('end_date', endDate)
  const url = `https://apis.datos.gob.ar/series/api/series/?${params.toString()}`

  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`datos.gob.ar (INDEC) devolvió ${res.status}. Serie ${INDEC_IPC_SERIES}.`)
  const json = (await res.json()) as { data?: [string, number][] }
  return (json.data ?? [])
    .filter(([, v]) => v != null)
    .map(([date, value]) => ({ month: date.slice(0, 10), indexValue: Number(value) }))
}
