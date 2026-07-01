// ============================================================================
// Events bulk helper — per (contract, period) reminder summary for the
// planilla. One query for all contracts; each summary splits the contract's
// events into este-mes (ROJO) / pendientes (NEGRO) and computes the owner's
// transfer adjustment from the active adjustment-kind events.
//
// Single source for the Observación cell's compact counts, the modal list,
// and the transferencia adjustment — so the three never disagree (the class
// of bug that bit the Deuda/Extras cells).
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import {
  EVENTS_TABLE, EVENT_COLUMNS, EVENT_STATUS, ADJUSTMENT_KINDS,
  mapEventRow, reminderBucket, ownerTransferEffect, displayAmount,
  type ContractEvent,
} from './events-types'

export interface EventsSummary {
  contractId:       string
  /** Active this period (ROJO) — feed the accounting. */
  esteMes:          ContractEvent[]
  /** Future reminders (NEGRO) — carry forward automatically. */
  pendientes:       ContractEvent[]
  /** Signed owner-transfer adjustment from active adjustment-kind events. */
  adjustmentEffect: number
  /** Sum of display amounts per bucket, for the compact cell. */
  esteMesTotal:     number
  pendientesTotal:  number
}

function emptySummary(contractId: string): EventsSummary {
  return { contractId, esteMes: [], pendientes: [], adjustmentEffect: 0, esteMesTotal: 0, pendientesTotal: 0 }
}

const isAdjustmentKind = (kind: string): boolean => (ADJUSTMENT_KINDS as readonly string[]).includes(kind)
const byRecentFirst = (a: ContractEvent, b: ContractEvent) =>
  (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '')

/** Build a summary for every contract id passed. Contracts with no events
 *  still get an (empty) entry so callers never handle missing keys. */
export async function buildEventsSummariesBulk(
  contractIds: string[],
  period:      string,
): Promise<Map<string, EventsSummary>> {
  const out = new Map<string, EventsSummary>()
  for (const id of contractIds) out.set(id, emptySummary(id))
  if (contractIds.length === 0) return out

  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_COLUMNS)
    .in('contract_id', contractIds)
    .neq('status', EVENT_STATUS.CANCELLED)

  for (const row of (data ?? []) as any[]) {
    const ev = mapEventRow(row)
    const summary = out.get(ev.contractId)
    if (!summary) continue
    switch (reminderBucket(ev, period)) {
      case 'este-mes':
        summary.esteMes.push(ev)
        summary.esteMesTotal += displayAmount(ev)
        if (isAdjustmentKind(ev.kind)) summary.adjustmentEffect += ownerTransferEffect(ev)
        break
      case 'pendiente':
        summary.pendientes.push(ev)
        summary.pendientesTotal += displayAmount(ev)
        break
      // 'pasado' → history; not shown for this period
    }
  }

  for (const s of out.values()) {
    s.esteMes.sort(byRecentFirst)
    s.pendientes.sort(byRecentFirst)
  }
  return out
}

/** Single-contract convenience — used by the contract detail page. */
export async function buildEventsSummary(contractId: string, period: string): Promise<EventsSummary> {
  const map = await buildEventsSummariesBulk([contractId], period)
  return map.get(contractId) ?? emptySummary(contractId)
}
