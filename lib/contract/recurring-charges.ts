// ============================================================================
// Recurring charges per contract (ABL, THU, Camuzzi, Tasa de Limpieza, etc.)
//
// Each contract can have N rows in contract_recurring_charges. Each row has:
//   • label   — free text, common ones suggested in the editor dropdown
//   • amount  — fixed monthly amount
//   • recupero_type_code — optional FK to transaction_types.code. When set,
//                          drives the cobro-was-recorded check.
//   • active  — toggle off without deleting
//   • sort_order — for stable ordering inside the editor + popover
//
// Replaces the single-row ABL feature (contracts.includes_abl/abl_amount)
// shipped 2026-06-19 then revised on 2026-06-20 per Alejandro's voice:
// the Alquiler column must stay pure (only rent) and recargos go in a
// separate column with N items per contract.
// ============================================================================

'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'

export interface RecurringCharge {
  id:                string
  contractId:        string
  label:             string
  amount:            number
  recuperoTypeCode:  string | null
  active:            boolean
  sortOrder:         number
}

interface InlineResult {
  ok:    boolean
  error: string | null
  id?:   string
}

function revalidate(contractId: string) {
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
}

// ── List ────────────────────────────────────────────────────────────────────
export async function listRecurringCharges(contractId: string): Promise<RecurringCharge[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('contract_recurring_charges')
    .select('id, contract_id, label, amount, recupero_type_code, active, sort_order')
    .eq('contract_id', contractId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return ((data ?? []) as any[]).map(r => ({
    id:                r.id,
    contractId:        r.contract_id,
    label:             r.label,
    amount:            Number(r.amount),
    recuperoTypeCode:  r.recupero_type_code ?? null,
    active:            r.active === true,
    sortOrder:         Number(r.sort_order ?? 0),
  }))
}

// ── Add ─────────────────────────────────────────────────────────────────────
export async function addRecurringCharge(args: {
  contractId:        string
  label:             string
  amount:            number
  recuperoTypeCode:  string | null
}): Promise<InlineResult> {
  const label = args.label.trim()
  if (!label) return { ok: false, error: 'Cargá una etiqueta para el recargo.' }
  if (!isFinite(args.amount) || args.amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a 0.' }
  }

  const supabase = await createSupabaseServer()
  // Compute next sort_order: max existing + 10 (gaps allow drag-reorder later).
  const { data: existing } = await supabase
    .from('contract_recurring_charges')
    .select('sort_order')
    .eq('contract_id', args.contractId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((existing as any)?.sort_order ?? 0) + 10

  const { data: created, error } = await supabase
    .from('contract_recurring_charges')
    .insert({
      contract_id:         args.contractId,
      label,
      amount:              args.amount,
      recupero_type_code:  args.recuperoTypeCode,
      active:              true,
      sort_order:          nextOrder,
    })
    .select('id')
    .single()
  if (error) return dbFailure(error)
  revalidate(args.contractId)
  return { ok: true, error: null, id: (created as any).id }
}

// ── Update ──────────────────────────────────────────────────────────────────
export async function updateRecurringCharge(
  id: string,
  patch: Partial<{
    label:             string
    amount:            number
    recuperoTypeCode:  string | null
    active:            boolean
  }>,
): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const updates: Record<string, unknown> = {}
  if ('label' in patch) {
    const label = (patch.label ?? '').trim()
    if (!label) return { ok: false, error: 'Cargá una etiqueta para el recargo.' }
    updates.label = label
  }
  if ('amount' in patch) {
    if (!isFinite(patch.amount as number) || (patch.amount as number) <= 0) {
      return { ok: false, error: 'El monto debe ser mayor a 0.' }
    }
    updates.amount = patch.amount
  }
  if ('recuperoTypeCode' in patch) updates.recupero_type_code = patch.recuperoTypeCode
  if ('active' in patch)           updates.active = patch.active

  if (Object.keys(updates).length === 0) return { ok: true, error: null }

  const { data: existing } = await supabase
    .from('contract_recurring_charges').select('contract_id').eq('id', id).maybeSingle()
  const contractId = (existing as any)?.contract_id as string | null

  const { error } = await supabase
    .from('contract_recurring_charges').update(updates).eq('id', id)
  if (error) return dbFailure(error)
  if (contractId) revalidate(contractId)
  return { ok: true, error: null }
}

// ── Delete ──────────────────────────────────────────────────────────────────
export async function deleteRecurringCharge(id: string): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from('contract_recurring_charges').select('contract_id').eq('id', id).maybeSingle()
  const contractId = (existing as any)?.contract_id as string | null

  const { error } = await supabase
    .from('contract_recurring_charges').delete().eq('id', id)
  if (error) return dbFailure(error)
  if (contractId) revalidate(contractId)
  return { ok: true, error: null }
}
