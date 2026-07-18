// ============================================================================
// getSuggestedAumento — async wrapper over buildSuggestedAumento that loads the
// INDEC index map. Used by the contract detail page to show the tentative
// ("en gris") IPC aumento. Returns null once the aumento is already applied
// (lastAdjustmentDate gates it, so the panel can't double-apply). Threads the
// real N/F parts so the preview equals the value applyIpcAumento persists.
// ============================================================================

import { getIpcIndexMap } from '@/lib/ipc/queries'
import { buildSuggestedAumento, type SuggestedAumento } from './aumento'

export async function getSuggestedAumento(args: {
  startDate:          string | null
  cadence:            string | null
  currentRent:        number
  rentFacturadoNeto:  number | null
  rentNoFacturado:    number
  rentIvaRate:        number
  lastAdjustmentDate: string | null
}): Promise<SuggestedAumento | null> {
  if (!args.startDate || !args.cadence) return null
  const indexByMonth = await getIpcIndexMap()
  return buildSuggestedAumento({
    startDate:          args.startDate,
    cadence:            args.cadence,
    currentRent:        args.currentRent,
    rentFacturadoNeto:  args.rentFacturadoNeto,
    rentNoFacturado:    args.rentNoFacturado,
    rentIvaRate:        args.rentIvaRate,
    lastAdjustmentDate: args.lastAdjustmentDate,
    today:              new Date(),
    indexByMonth,
  })
}
