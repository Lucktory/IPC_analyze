'use server'

// ============================================================================
// contract_events CRUD — the write/read path for the Observaciones reminders
// engine (arreglos / ajustes now; depósito / honorarios in Step 2).
//
// Mirrors the recurring-charges actions: per-field validation, standard
// { ok, error } result, revalidates the planilla + the contract page. Deletes
// are soft (status='cancelled') so the audit row survives — Alejandro's sheet
// keeps history, so the app should too.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import {
  EVENT_KIND, EVENT_STATUS, EVENTS_TABLE, EVENT_COLUMNS, mapEventRow,
  type EventKind, type EventStatus, type ContractEvent,
} from './events-types'

interface EventResult { ok: boolean; error: string | null; id?: string }

const isValidKind   = (k: string): k is EventKind => (Object.values(EVENT_KIND) as string[]).includes(k)
const isValidStatus = (s: string): s is EventStatus => (Object.values(EVENT_STATUS) as string[]).includes(s)
const isValidPeriod = (p: string): boolean => /^\d{4}-\d{2}-01$/.test(p)

function revalidate(contractId: string) {
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
}

// ── List ──────────────────────────────────────────────────────────────────
/** All non-cancelled events for a contract, ordered by their active period. */
export async function listContractEvents(contractId: string): Promise<ContractEvent[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_COLUMNS)
    .eq('contract_id', contractId)
    .neq('status', EVENT_STATUS.CANCELLED)
    .order('applies_to_period', { ascending: true, nullsFirst: false })
    .order('occurred_at', { ascending: false })
  return ((data ?? []) as any[]).map(mapEventRow)
}

// ── Add ───────────────────────────────────────────────────────────────────
export interface AddEventArgs {
  contractId:      string
  kind:            EventKind
  description:     string | null
  amountLandlord:  number
  amountTenant:    number
  /** 'YYYY-MM-01' — the period it activates (rojo). null = this period. */
  appliesToPeriod: string | null
}

export async function addContractEvent(args: AddEventArgs): Promise<EventResult> {
  if (!isValidKind(args.kind)) return { ok: false, error: `Tipo de evento inválido: ${args.kind}.` }

  const amountLandlord = Number(args.amountLandlord) || 0
  const amountTenant   = Number(args.amountTenant)   || 0
  if (amountLandlord < 0 || amountTenant < 0) {
    return { ok: false, error: 'Los montos no pueden ser negativos (el signo lo da a quién se imputa).' }
  }
  const description = (args.description ?? '').trim() || null
  if (!description && amountLandlord === 0 && amountTenant === 0) {
    return { ok: false, error: 'Cargá una descripción o un monto.' }
  }
  if (args.appliesToPeriod && !isValidPeriod(args.appliesToPeriod)) {
    return { ok: false, error: 'El período debe tener formato YYYY-MM-01.' }
  }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .insert({
      contract_id:       args.contractId,
      kind:              args.kind,
      description,
      amount_landlord:   amountLandlord,
      amount_tenant:     amountTenant,
      applies_to_period: args.appliesToPeriod,
      status:            EVENT_STATUS.PENDING,
    })
    .select('id')
    .single()
  if (error) return dbFailure(error)
  revalidate(args.contractId)
  return { ok: true, error: null, id: String((data as any).id) }
}

// ── Update ────────────────────────────────────────────────────────────────
export type EventPatch = Partial<{
  description:     string | null
  amountLandlord:  number
  amountTenant:    number
  appliesToPeriod: string | null
  status:          EventStatus
}>

export async function updateContractEvent(id: string, patch: EventPatch): Promise<EventResult> {
  const updates: Record<string, unknown> = {}

  if ('description' in patch) updates.description = (patch.description ?? '').trim() || null
  if ('amountLandlord' in patch) {
    const v = Number(patch.amountLandlord)
    if (!isFinite(v) || v < 0) return { ok: false, error: 'Monto (propietario) inválido.' }
    updates.amount_landlord = v
  }
  if ('amountTenant' in patch) {
    const v = Number(patch.amountTenant)
    if (!isFinite(v) || v < 0) return { ok: false, error: 'Monto (inquilino) inválido.' }
    updates.amount_tenant = v
  }
  if ('appliesToPeriod' in patch) {
    const p = patch.appliesToPeriod
    if (p && !isValidPeriod(p)) return { ok: false, error: 'El período debe tener formato YYYY-MM-01.' }
    updates.applies_to_period = p ?? null
  }
  if ('status' in patch) {
    if (!patch.status || !isValidStatus(patch.status)) return { ok: false, error: 'Estado inválido.' }
    updates.status = patch.status
  }
  if (Object.keys(updates).length === 0) return { ok: true, error: null }

  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from(EVENTS_TABLE).select('contract_id').eq('id', id).maybeSingle()
  const contractId = (existing as any)?.contract_id as string | null

  const { error } = await supabase.from(EVENTS_TABLE).update(updates).eq('id', id)
  if (error) return dbFailure(error)
  if (contractId) revalidate(contractId)
  return { ok: true, error: null }
}

// ── Cancel (soft delete) ────────────────────────────────────────────────────
export async function cancelContractEvent(id: string): Promise<EventResult> {
  return updateContractEvent(id, { status: EVENT_STATUS.CANCELLED })
}
