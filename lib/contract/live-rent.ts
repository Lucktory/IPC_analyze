// ============================================================================
// Live rent — the rent that ACTUALLY applies for a period, shared by every
// surface that shows "Alquiler vigente" (planilla, dashboard, contract/tenant/
// property lists + details). ONE definition so they can never disagree.
//
// It carries current_rent forward by any IPC increase since the anchor (see
// expectedRentForPeriod in lib/contract/aumento.ts). current_rent is the stored
// ANCHOR value; the live value = anchor x compound IPC up to the viewed period.
// The old code read raw current_rent everywhere, so a contract due for an
// increase showed the OLD number in the lists while the planilla showed the new
// one. Route every read through buildLiveRentMap and they agree.
// ============================================================================

import { getIpcIndexMap } from '@/lib/ipc/queries'
import { expectedRentForPeriod } from '@/lib/contract/aumento'
import { getCurrentPeriod } from '@/lib/period'

export interface LiveRentInput {
  id:                 string
  currentRent:        number
  cadence:            string | null
  startDate:          string | null
  lastAdjustmentDate: string | null
  createdAt:          string | null
}

/**
 * contractId -> the rent that applies in `period` (current_rent carried forward
 * by IPC increases since the anchor). Falls back to current_rent when
 * cadence/start is missing or the IPC isn't loaded. ONE IPC fetch per batch.
 */
export async function buildLiveRentMap(
  contracts: LiveRentInput[],
  period?: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (contracts.length === 0) return out
  const p = period ?? getCurrentPeriod()
  const indexByMonth = await getIpcIndexMap()
  for (const c of contracts) {
    out.set(
      c.id,
      c.cadence && c.startDate
        ? expectedRentForPeriod({
            startDate:          c.startDate,
            cadence:            c.cadence,
            currentRent:        c.currentRent,
            lastAdjustmentDate: c.lastAdjustmentDate,
            createdAt:          c.createdAt,
            period:             p,
            indexByMonth,
          }).value
        : c.currentRent,
    )
  }
  return out
}

/** Single-contract convenience — the live rent for one contract in `period`. */
export async function getLiveRent(input: LiveRentInput, period?: string): Promise<number> {
  const map = await buildLiveRentMap([input], period)
  return map.get(input.id) ?? input.currentRent
}
