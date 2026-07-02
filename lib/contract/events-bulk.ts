// ============================================================================
// Events bulk helper — per (contract, period) reminder summary for the
// planilla. One query for all contracts; each summary splits the contract's
// events into este-mes (ROJO) / pendientes (NEGRO).
//
// Alejandro's rule: turning rojo means "corresponde cobrarlo/descontarlo este
// mes", NOT that it already happened. So the este-mes adjustment effect is
// split by confirmation:
//   • cobrado  (status 'applied')  → enters the owner's receipt/transfer.
//   • a cobrar (status 'pending')  → shown as a reminder, NOT summed.
// Only what he confirms as cobrado moves money.
//
// Single source for the Observación cell's compact counts, the modal list,
// and the transferencia adjustment — so the three never disagree (the class
// of bug that bit the Deuda/Extras cells).
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import {
  EVENTS_TABLE, EVENT_COLUMNS, EVENT_STATUS, ADJUSTMENT_KINDS,
  mapEventRow, reminderBucket, ownerTransferEffect, eventPartyLabel,
  type ContractEvent,
} from './events-types'

export interface EventsSummary {
  contractId:       string
  /** Active this period (ROJO) — a cobrar + cobrado. */
  esteMes:          ContractEvent[]
  /** Future reminders (NEGRO) — carry forward automatically. */
  pendientes:       ContractEvent[]
  /** CONFIRMED (cobrado) este-mes adjustment effect → enters the receipt/transfer. */
  adjustmentEffect: number
  /** UNCONFIRMED (a cobrar) este-mes adjustment effect → shown, NOT summed. */
  esteMesACobrarTotal: number
  /** Future (NEGRO) adjustment effect → shown, NOT summed. */
  pendientesTotal:  number
}

function emptySummary(contractId: string): EventsSummary {
  return { contractId, esteMes: [], pendientes: [], adjustmentEffect: 0, esteMesACobrarTotal: 0, pendientesTotal: 0 }
}

/** An event is confirmed (cobrado/hecho) when its status is 'applied'. */
const isCobrado = (e: ContractEvent): boolean => e.status === EVENT_STATUS.APPLIED

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
        // Only adjustment-kind events move money. Split by confirmation so the
        // receipt reflects what's actually cobrado, not merely what's due.
        if (isAdjustmentKind(ev.kind)) {
          const effect = ownerTransferEffect(ev)
          if (isCobrado(ev)) summary.adjustmentEffect    += effect
          else               summary.esteMesACobrarTotal += effect
        }
        break
      case 'pendiente':
        summary.pendientes.push(ev)
        if (isAdjustmentKind(ev.kind)) summary.pendientesTotal += ownerTransferEffect(ev)
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

// ── Receipt ajustes — for the liquidación detail page + owner email ─────────

export interface AjusteLine {
  /** e.g. "Arreglo pintura (al dueño)". */
  label:  string
  /** Signed effect on the owner's transfer (negative = descuenta). */
  amount: number
}

export interface ReceiptAjustes {
  lines: AjusteLine[]
  /** Signed total = legacyAdjustment + confirmed events' effect. */
  total: number
}

/** Human label for a confirmed adjustment shown on the owner's receipt. */
function receiptLineLabel(e: ContractEvent): string {
  const desc = (e.description ?? '').trim() || 'Arreglo/Ajuste'
  return `${desc} (${eventPartyLabel(e)})`
}

/**
 * Ajuste lines for a contract+period receipt: the CONFIRMED (cobrado) este-mes
 * arreglos/ajustes as described lines, plus the legacy manual adjustment as a
 * generic line. Single source so the liquidación detail page and the owner
 * email render identical lines/totals — the neto can't diverge between them,
 * and it matches the planilla's `adjustment` (legacy + cobrado effect).
 */
export async function buildReceiptAjustes(
  contractId:       string,
  period:           string,
  legacyAdjustment: number,
): Promise<ReceiptAjustes> {
  const summary = await buildEventsSummary(contractId, period)
  const lines: AjusteLine[] = []
  for (const e of summary.esteMes) {
    if (!isCobrado(e) || !isAdjustmentKind(e.kind)) continue
    lines.push({ label: receiptLineLabel(e), amount: ownerTransferEffect(e) })
  }
  if (legacyAdjustment !== 0) lines.push({ label: 'Ajuste', amount: legacyAdjustment })
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  return { lines, total }
}
