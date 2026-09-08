// ============================================================================
// contract_events — shared types + pure helpers for the Observaciones
// "reminders" engine.
//
// One row per reminder in contract_events. The planilla renders a contract's
// events for a period split into pendientes (NEGRO) and este-mes (ROJO), and
// the active (rojo) arreglos feed the owner's transfer adjustment.
//
// Everything here is pure + framework-free so the server bulk helper and the
// client cells share one source of truth. Kinds/statuses/parties live here
// once — no scattered string literals across the codebase.
//
// Step 1 uses ARREGLO / AJUSTE. DEPOSITO / HONORARIOS are defined now but only
// wired in Step 2 (installments) so the vocabulary is stable from the start.
// ============================================================================

import { COMMISSION_IVA_RATE } from '@/lib/liquidacion/thresholds'

/** contract_events.kind values the app reads/writes. */
export const EVENT_KIND = {
  ARREGLO:    'arreglo',     // repair / deduction, imputed to owner or tenant
  AJUSTE:     'ajuste',      // generic manual +/- on the owner's transfer
  DEPOSITO:   'deposito',    // security deposit (Step 2) → owner's rendición
  HONORARIOS: 'honorarios',  // agency fee (Step 2) → agency monthly tally
} as const
export type EventKind = (typeof EVENT_KIND)[keyof typeof EVENT_KIND]

/** Kinds that feed the owner's transfer adjustment (Step 1). */
export const ADJUSTMENT_KINDS: readonly EventKind[] = [EVENT_KIND.ARREGLO, EVENT_KIND.AJUSTE]

/** contract_events.status — mirrors the DB check constraint. */
export const EVENT_STATUS = {
  PENDING:   'pending',
  APPLIED:   'applied',
  CANCELLED: 'cancelled',
} as const
export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS]

/** Who an arreglo is charged to. Stored implicitly via amount_landlord /
 *  amount_tenant; the UI exposes it as a single toggle. */
export const EVENT_PARTY = {
  LANDLORD: 'landlord',
  TENANT:   'tenant',
} as const
export type EventParty = (typeof EVENT_PARTY)[keyof typeof EVENT_PARTY]

/** App-facing shape of a contract_events row (camelCase, numbers coerced). */
export interface ContractEvent {
  id:              string
  contractId:      string
  kind:            EventKind
  description:     string | null
  amountLandlord:  number
  amountTenant:    number
  /** 'YYYY-MM-01' — the period this event is active (rojo). null = legacy/now. */
  appliesToPeriod: string | null
  status:          EventStatus
  occurredAt:      string | null
  /** Honorarios only: true = 21% IVA is ADDED ON TOP of the stored amount.
   *
   *  `amountTenant` holds the NET figure. The Observaciones modal collects it
   *  that way explicitly — the input is labelled "Monto (neto)" with the title
   *  "Monto total de los honorarios (neto, sin IVA)" — and previews net * 1.21
   *  beside it. Use `honorarioGross()` below; never restate the arithmetic.
   *
   *  NOTE (corrected 2026-09-06): this comment previously read "the amount
   *  carries 21% IVA ... derived portion = amount * 0.21 / 1.21", i.e. the
   *  commission convention, where the stored figure is gross and the tax is
   *  extracted back out. That is the opposite of what the writer and the UI
   *  actually do, and following it would understate every con-IVA honorario by
   *  a factor of 1.21. Ignored for arreglos/ajustes. */
  includesIva:     boolean
}

/** contract_events table name + the column list every query selects. Kept
 *  here (not in the 'use server' actions file) so the bulk helper can reuse
 *  them — a 'use server' module may only export async functions. */
export const EVENTS_TABLE = 'contract_events'
export const EVENT_COLUMNS =
  'id, contract_id, kind, description, amount_landlord, amount_tenant, includes_iva, applies_to_period, status, occurred_at'

/** DB row (snake_case) → app ContractEvent. id is a bigserial, surfaced as a
 *  string to avoid precision loss. */
export function mapEventRow(r: any): ContractEvent {
  return {
    id:              String(r.id),
    contractId:      r.contract_id,
    kind:            r.kind as EventKind,
    description:     r.description ?? null,
    amountLandlord:  Number(r.amount_landlord ?? 0),
    amountTenant:    Number(r.amount_tenant ?? 0),
    appliesToPeriod: r.applies_to_period ?? null,
    status:          (r.status ?? EVENT_STATUS.PENDING) as EventStatus,
    occurredAt:      r.occurred_at ?? null,
    includesIva:     r.includes_iva === true,
  }
}

/** Display bucket of an event relative to the period being viewed. */
export type ReminderBucket = 'este-mes' | 'pendiente' | 'pasado'

/** Where a reminder sits for a given view period:
 *   • este-mes  (ROJO)  — activates this period → feeds the accounting
 *   • pendiente (NEGRO) — activates a LATER period → carry-forward reminder
 *   • pasado            — activated in an earlier period (history)
 *  Cancelled events are filtered by the caller before this runs. Periods are
 *  'YYYY-MM-01' strings, so lexical comparison is chronological. */
export function reminderBucket(event: ContractEvent, viewPeriod: string): ReminderBucket {
  const p = event.appliesToPeriod
  if (!p || p === viewPeriod) return 'este-mes'   // null = legacy → treat as current
  return p > viewPeriod ? 'pendiente' : 'pasado'
}

/** Signed effect of an ACTIVE (rojo) arreglo/ajuste on the OWNER's transfer —
 *  what gets added into `Ingresos − ADMI − Otros + ajuste`.
 *
 *  Convention, kept in this single function so it flips in one place if the
 *  office confirms otherwise: charged to the owner REDUCES the transfer;
 *  charged to the tenant INCREASES it (the tenant reimburses through the
 *  liquidación). */
export function ownerTransferEffect(event: ContractEvent): number {
  return transferEffectOf(event.amountLandlord, event.amountTenant)
}

/** Same sign rule as `ownerTransferEffect`, from raw amounts — used by the
 *  editable modal row where the event object doesn't exist yet. Keeping both
 *  on this one function means the convention flips in a single place. */
export function transferEffectOf(amountLandlord: number, amountTenant: number): number {
  return amountTenant - amountLandlord
}

/** Signed magnitude an item shows in its row (positive = suma, negative =
 *  descuenta, from the owner's side). Used for the cell/modal display only. */
export function displayAmount(event: ContractEvent): number {
  return ownerTransferEffect(event)
}

/**
 * What an honorario is actually worth: the stored NET plus IVA when the
 * operator marked it "Con IVA 21%".
 *
 * THE canonical honorarios amount. Every surface that totals honorarios must
 * call this — the planilla column and its footer, the Resumen tab's "Ingresos
 * de la inmobiliaria", and the Panel trend.
 *
 * Added 2026-09-06. All three of those consumers previously summed
 * `amount_tenant` raw and ignored `includes_iva` entirely (two of them did not
 * even SELECT the column), so the operator was shown a con-IVA figure when she
 * created the honorario and every later total reported the net — understating
 * agency income by 21% on the IVA-bearing subset. It also meant the Resumen
 * added an IVA-INCLUSIVE commission to an IVA-EXCLUSIVE honorarios figure.
 *
 * The rate comes from COMMISSION_IVA_RATE rather than a literal so the two IVA
 * surfaces can never drift; the Observaciones modal used to hardcode 1.21 here,
 * which was a sixth copy of the rate.
 */
export function honorarioGross(amountTenant: number, includesIva: boolean): number {
  const net = Number(amountTenant) || 0
  return includesIva ? net * (1 + COMMISSION_IVA_RATE) : net
}

/** Who an event is charged to, in words — for receipt/email lines. Derived from
 *  the amounts (the party isn't a stored column). */
export function eventPartyLabel(event: ContractEvent): string {
  return event.amountTenant > 0 && event.amountLandlord === 0 ? 'al inquilino' : 'al dueño'
}
