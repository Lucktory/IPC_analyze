'use server'

// ============================================================================
// Inline contract-field updates — fired by the in-cell editors on the
// /liquidacion planilla. One action per single field, each returns the
// standard { ok, error } shape.
//
// Why field-by-field instead of a generic "update contract" action: the
// planilla edits one column at a time. Generic patches would force the
// caller to assemble a partial payload and the server to whitelist keys.
// Per-field is simpler, validated, and crystal clear about intent.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'

export interface InlineResult {
  ok:    boolean
  error: string | null
}

const ALLOWED_LFA = ['L', 'F', 'A', 'FL', 'D'] as const
type AllowedLfa = typeof ALLOWED_LFA[number]

function isLfa(s: string): s is AllowedLfa {
  return (ALLOWED_LFA as readonly string[]).includes(s)
}

function revalidate(contractId: string) {
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
}

// ── LFA code ────────────────────────────────────────────────────────────────
export async function updateContractLfa(contractId: string, lfa: string | null): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const value = lfa?.trim().toUpperCase() ?? null
  if (value !== null && !isLfa(value)) {
    return { ok: false, error: `LFA inválido. Valores aceptados: ${ALLOWED_LFA.join(' / ')}.` }
  }
  const { error } = await supabase.from('contracts').update({ lfa_code: value }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Expensas (monthly charge — separate from rent) ──────────────────────────
export async function updateContractExpensas(contractId: string, expensas: number): Promise<InlineResult> {
  if (!isFinite(expensas) || expensas < 0) {
    return { ok: false, error: 'Las expensas deben ser un número ≥ 0.' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('contracts').update({ expensas }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Commission % (Pampa's cut on total cobrado) ─────────────────────────────
export async function updateContractCommissionPct(contractId: string, pct: number): Promise<InlineResult> {
  if (!isFinite(pct) || pct < 0 || pct > 100) {
    return { ok: false, error: 'La comisión debe estar entre 0 y 100.' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('contracts').update({ commission_pct: pct }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Commission includes IVA (drives the IVA column on the planilla) ─────────
// True when the invoicing administrator is RI (adds 21% IVA on the commission
// invoice); false for Monotributo. Per-contract flag because Alejandro picks
// the invoicer per contract depending on what the landlord prefers.
export async function updateContractCommissionIncludesIva(
  contractId: string,
  includesIva: boolean,
): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('contracts')
    .update({ commission_includes_iva: includesIva })
    .eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// (The 2026-06-19 updateContractAblSurcharge action was removed on
// 2026-06-20 along with the contracts.includes_abl / abl_amount columns.
// Recurring charges now live in `contract_recurring_charges` with N rows
// per contract — see lib/contract/recurring-charges.ts for the CRUD.)

// ── Vigencia (start_date / end_date) ────────────────────────────────────────
export async function updateContractVigencia(
  contractId: string,
  startDate:  string | null,
  endDate:    string | null,
): Promise<InlineResult> {
  if (startDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: 'Fecha de inicio inválida.' }
  }
  if (endDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: 'Fecha de fin inválida.' }
  }
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    return { ok: false, error: 'La fecha de fin debe ser posterior al inicio.' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('contracts')
    .update({ start_date: startDate, end_date: endDate })
    .eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ============================================================================
// Per-cell transaction upsert.
//
// The encargada types a value into a money cell (Ingresos / Otros / one of
// the three ADM destinations). The system needs to either create a new
// transaction or update the existing one for that (contract, period, type).
//
// Idempotent: matches the existing transaction by (contract_id, period,
// transaction_type_id [+ description marker for destination]) and updates
// the amount in place. Otherwise inserts a fresh row.
// ============================================================================

export type DestinationCode = 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6' | null

export async function upsertCellTransaction(
  contractId:  string,
  period:      string,           // YYYY-MM-01
  typeCode:    string,           // 'RENT_IN' | 'OTHER_OUT' | 'COMMISSION_OUT' | 'LANDLORD_PAYOUT'
  amount:      number,
  bankDate:    string | null,
  description: string | null,
  destination: DestinationCode = null,
): Promise<InlineResult> {
  // Diagnostic log — surfaces every inline money-cell write in Vercel
  // runtime logs prefixed [CELL_TX] so a "didn't save" report can be
  // matched to a specific call.
  try {
    console.log(
      `[CELL_TX] upsertCellTransaction contract=${contractId} period=${period} ` +
      `type=${typeCode}${destination ? ` dest=${destination}` : ''} amount=${amount}`,
    )
  } catch { /* ignore */ }
  if (!isFinite(amount) || amount < 0) {
    return { ok: false, error: 'El monto debe ser un número ≥ 0.' }
  }
  if (bankDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(bankDate)) {
    return { ok: false, error: 'Fecha bancaria inválida.' }
  }

  const supabase = await createSupabaseServer()

  // Resolve transaction_type_id and administration_id.
  const [{ data: typeRow, error: typeErr }, { data: contract, error: contractErr }] = await Promise.all([
    supabase.from('transaction_types').select('id').eq('code', typeCode).maybeSingle(),
    supabase.from('contracts').select('administration_id').eq('id', contractId).maybeSingle(),
  ])
  if (typeErr) return dbFailure(typeErr)
  if (contractErr) return dbFailure(contractErr)
  if (!typeRow)  return { ok: false, error: `Tipo de transacción ${typeCode} no encontrado.` }
  if (!contract) return { ok: false, error: 'Contrato no encontrado.' }
  const typeId          = (typeRow  as any).id as string
  const administrationId = (contract as any).administration_id as string

  // Build the description for INSERT (only used when creating a new row).
  // For COMMISSION_OUT we append a destination marker (ADM_GALICIA / ...)
  // unless the caller's label already contains it — avoids the
  // double-suffix bug "Comisión → ADM_GALICIA · ADM_GALICIA" that came
  // from EditableTransactionCell sometimes passing a label that already
  // included the destination code.
  const baseDescription = (description ?? '').trim()
  let insertDescription: string | null = baseDescription || null
  if (destination) {
    insertDescription = baseDescription.includes(destination)
      ? (baseDescription || destination)
      : (baseDescription ? `${baseDescription} · ${destination}` : destination)
  }

  // Find existing transaction for (contract, period, type [+ destination marker]).
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id, description')
    .eq('contract_id', contractId)
    .eq('period', period)
    .eq('transaction_type_id', typeId)
  if (findErr) return dbFailure(findErr)

  // For COMMISSION_OUT, match by destination marker; for others, the most
  // recent row for (contract, period, type) is "the" one we keep updated.
  let target: { id: string } | null = null
  if ((existing ?? []).length > 0) {
    if (destination) {
      target = ((existing ?? []) as any[]).find(t => (t.description ?? '').includes(destination)) ?? null
    } else {
      target = (existing as any[])[0] ?? null
    }
  }

  // If amount == 0 and a row exists, delete it (clean state).
  if (amount === 0 && target) {
    const { error: delErr } = await supabase.from('transactions').delete().eq('id', target.id)
    if (delErr) return dbFailure(delErr)
    revalidate(contractId)
    return { ok: true, error: null }
  }

  if (target) {
    // UPDATE — only touch amount (and bank_date if the caller explicitly
    // provided one). The description is intentionally PRESERVED: the row
    // was tagged with the correct marker at INSERT time, and overwriting
    // on every edit would lose context the encargada may have added and
    // re-introduce the double-suffix bug for destination cells.
    const update: Record<string, unknown> = { amount }
    if (bankDate !== null) update.bank_date = bankDate
    const { error: upErr } = await supabase.from('transactions').update(update).eq('id', target.id)
    if (upErr) return dbFailure(upErr)
  } else if (amount > 0) {
    // INSERT — fresh row, use the full description.
    const { error: insErr } = await supabase
      .from('transactions')
      .insert({
        administration_id:    administrationId,
        contract_id:          contractId,
        transaction_type_id:  typeId,
        amount,
        period,
        bank_date:            bankDate,
        description:          insertDescription,
      })
    if (insErr) return dbFailure(insErr)
  }

  revalidate(contractId)
  return { ok: true, error: null }
}

// ============================================================================
// Cycle the liquidación status: borrador → enviada → pagada → borrador.
// Wraps the existing transitionLiquidacionStatus with the next-state logic.
// ============================================================================

export async function cycleLiquidacionStatus(
  contractId: string,
  landlordId: string,
  period:     string,
  currentStatus: 'draft' | 'sent' | 'paid',
): Promise<InlineResult> {
  const nextStatus = currentStatus === 'draft' ? 'sent' : currentStatus === 'sent' ? 'paid' : 'draft'
  const { transitionLiquidacionStatus } = await import('@/lib/liquidacion/actions')
  const res = await transitionLiquidacionStatus(contractId, landlordId, period, nextStatus)
  if (!res.ok) return { ok: false, error: res.error ?? 'Error al cambiar el estado' }
  revalidate(contractId)
  return { ok: true, error: null }
}
