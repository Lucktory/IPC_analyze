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
import { shiftPeriod } from '@/lib/period'
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
  /** Honorarios only: does the amount carry 21% IVA? Default false. */
  includesIva?:    boolean
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
      includes_iva:      args.includesIva ?? false,
      applies_to_period: args.appliesToPeriod,
      status:            EVENT_STATUS.PENDING,
    })
    .select('id')
    .single()
  if (error) return dbFailure(error)
  revalidate(args.contractId)
  return { ok: true, error: null, id: String((data as any).id) }
}

// ── Add honorarios in cuotas (installments) ─────────────────────────────────
// Creates N HONORARIOS events, one per consecutive month starting at
// startPeriod, split equally (last cuota absorbs the rounding residue so the
// sum equals the total). Each event is independent + editable, so an unequal
// split or an early payoff is handled later by editing/cancelling cuotas. The
// future-month cuotas surface automatically as reminders (pendientes).
export async function addHonorarioInstallments(args: {
  contractId:  string
  total:       number
  cuotas:      number
  startPeriod: string   // YYYY-MM-01
  includesIva: boolean
  description: string | null
}): Promise<EventResult> {
  const total  = Number(args.total)
  const cuotas = Math.trunc(Number(args.cuotas))
  if (!isFinite(total) || total <= 0) {
    return { ok: false, error: 'El monto de los honorarios debe ser mayor a 0.' }
  }
  if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > 12) {
    return { ok: false, error: 'Las cuotas deben ser un número entre 1 y 12.' }
  }
  if (!isValidPeriod(args.startPeriod)) {
    return { ok: false, error: 'El período inicial debe tener formato YYYY-MM-01.' }
  }

  const round2   = (n: number) => Math.round(n * 100) / 100
  const base     = round2(total / cuotas)
  const baseDesc = (args.description ?? '').trim() || 'Honorarios inmobiliaria'

  const rows: Record<string, unknown>[] = []
  let period = args.startPeriod
  for (let i = 1; i <= cuotas; i++) {
    // Last cuota = total minus the sum of the equal ones, so it reconciles.
    const amount = i === cuotas ? round2(total - base * (cuotas - 1)) : base
    rows.push({
      contract_id:       args.contractId,
      kind:              EVENT_KIND.HONORARIOS,
      description:       cuotas > 1 ? `${baseDesc} — cuota ${i}/${cuotas}` : baseDesc,
      amount_landlord:   0,
      amount_tenant:     amount,
      includes_iva:      args.includesIva,
      applies_to_period: period,
      status:            EVENT_STATUS.PENDING,
    })
    period = shiftPeriod(period, 1)
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from(EVENTS_TABLE).insert(rows)
  if (error) return dbFailure(error)
  revalidate(args.contractId)
  return { ok: true, error: null }
}

// ── Cobrar saldo restante (early payoff of honorarios cuotas) ────────────────
// The exception Alejandro described: a plan of N cuotas gets paid off early.
// Consolidates every FUTURE (pending) honorarios cuota for the contract into a
// single "saldo adelantado" honorario in the current period, and cancels those
// future cuotas — so this month reflects the full amount collected and the
// upcoming reminders disappear. Past + current cuotas are untouched.
export async function payoffHonorarioBalance(
  contractId:    string,
  currentPeriod: string,
): Promise<EventResult> {
  if (!isValidPeriod(currentPeriod)) {
    return { ok: false, error: 'Período inválido (YYYY-MM-01).' }
  }
  const supabase = await createSupabaseServer()

  const { data: future, error: fetchErr } = await supabase
    .from(EVENTS_TABLE)
    .select('id, amount_tenant, includes_iva')
    .eq('contract_id', contractId)
    .eq('kind', EVENT_KIND.HONORARIOS)
    .neq('status', EVENT_STATUS.CANCELLED)
    .gt('applies_to_period', currentPeriod)
  if (fetchErr) return dbFailure(fetchErr)

  const rows = (future ?? []) as any[]
  if (rows.length === 0) return { ok: false, error: 'No hay cuotas futuras para adelantar.' }

  const saldo       = rows.reduce((s, r) => s + Number(r.amount_tenant ?? 0), 0)
  const includesIva = rows.some(r => r.includes_iva === true)

  const { data: inserted, error: insErr } = await supabase.from(EVENTS_TABLE).insert({
    contract_id:       contractId,
    kind:              EVENT_KIND.HONORARIOS,
    description:       `Honorarios — saldo adelantado (${rows.length} cuota${rows.length > 1 ? 's' : ''})`,
    amount_landlord:   0,
    amount_tenant:     Math.round(saldo * 100) / 100,
    includes_iva:      includesIva,
    applies_to_period: currentPeriod,
    status:            EVENT_STATUS.PENDING,
  }).select('id').single()
  if (insErr) return dbFailure(insErr)

  const { error: cancelErr } = await supabase
    .from(EVENTS_TABLE)
    .update({ status: EVENT_STATUS.CANCELLED })
    .in('id', rows.map(r => r.id))
  if (cancelErr) {
    // Not a real DB transaction: the saldo was inserted but the future cuotas
    // couldn't be cancelled. Roll back the saldo so we never leave BOTH the
    // consolidated saldo AND the still-live future cuotas (which would double
    // the honorarios). Fail cleanly instead of corrupting the total.
    await supabase.from(EVENTS_TABLE).delete().eq('id', (inserted as { id: unknown }).id)
    return dbFailure(cancelErr)
  }

  revalidate(contractId)
  return { ok: true, error: null }
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
