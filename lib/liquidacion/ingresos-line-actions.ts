'use server'

// ============================================================================
// Per-line actions for the dynamic Ingresos cell (Phase 6).
//
// The Ingresos popover lets the encargada add / edit / delete individual
// transactions that make up the period's gross cobrado:
//   - alquiler (RENT_IN)
//   - expensas cobradas (EXPENSAS_IN)
//   - mora (LATE_FEE_IN)
//   - recupero ABL / AySA / Metrogas / Edesur / otro (RECUPERO_*_IN)
//   - otro ingreso (OTHER_IN)
//
// Each action returns the standard { ok, error } shape and bumps the
// parent contract's updated_at via the existing transactions-→-contracts
// trigger (so the row gets the recently-edited tint).
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { isAllowedIngresosLineType } from './ingresos-line-types'
import { syncCommissionForPeriod } from '@/lib/transaction/actions'

// Files marked 'use server' in Next.js can only export async functions.
// The result interface is TypeScript-only (erased at compile time), so
// it doesn't violate that rule. The canonical type list + type-guard
// live in ./ingresos-line-types.ts where non-function exports are legal.
export interface IngresosLineResult {
  ok:    boolean
  error: string | null
}

// ── Create a new line ──────────────────────────────────────────────────────
export async function createIngresosLine(input: {
  contractId:  string
  period:      string
  typeCode:    string
  amount:      number
  bankDate?:   string | null
  description?: string | null
}): Promise<IngresosLineResult> {
  if (!isAllowedIngresosLineType(input.typeCode)) {
    return { ok: false, error: `Tipo de ingreso inválido: ${input.typeCode}.` }
  }
  if (!isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a 0.' }
  }
  if (input.bankDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.bankDate)) {
    return { ok: false, error: 'Fecha bancaria inválida.' }
  }

  const supabase = await createSupabaseServer()

  const [{ data: typeRow, error: typeErr }, { data: contract, error: contractErr }] = await Promise.all([
    supabase.from('transaction_types').select('id').eq('code', input.typeCode).maybeSingle(),
    supabase.from('contracts').select('administration_id').eq('id', input.contractId).maybeSingle(),
  ])
  if (typeErr) return dbFailure(typeErr)
  if (contractErr) return dbFailure(contractErr)
  if (!typeRow)  return { ok: false, error: `Tipo ${input.typeCode} no encontrado en transaction_types. Aplicaste la migración de recuperos?` }
  if (!contract) return { ok: false, error: 'Contrato no encontrado.' }

  const { error } = await supabase.from('transactions').insert({
    administration_id:   (contract as any).administration_id,
    contract_id:         input.contractId,
    transaction_type_id: (typeRow as any).id,
    amount:              input.amount,
    period:              input.period,
    bank_date:           input.bankDate ?? null,
    description:         input.description?.trim() || null,
  })
  if (error) return dbFailure(error)

  // Keep the recorded commission in step with the cobrado — one reflex for every
  // income line (rent, recupero, expensas, ...): create it if missing, recompute
  // it if present. Best-effort; a commission hiccup never blocks the cobro.
  await syncCommissionForPeriod(input.contractId, input.period)
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${input.contractId}`)
  return { ok: true, error: null }
}

// ── Update an existing line — amount + bankDate + description ──────────────
//    typeCode change is allowed because the encargada may have selected the
//    wrong concept initially.
export async function updateIngresosLine(input: {
  transactionId:  string
  contractId:     string
  amount?:        number
  typeCode?:      string
  bankDate?:      string | null
  description?:   string | null
}): Promise<IngresosLineResult> {
  if (input.amount !== undefined && (!isFinite(input.amount) || input.amount <= 0)) {
    return { ok: false, error: 'El monto debe ser mayor a 0.' }
  }
  if (input.typeCode !== undefined && !isAllowedIngresosLineType(input.typeCode)) {
    return { ok: false, error: `Tipo de ingreso inválido: ${input.typeCode}.` }
  }
  if (input.bankDate !== undefined && input.bankDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.bankDate)) {
    return { ok: false, error: 'Fecha bancaria inválida.' }
  }

  const supabase = await createSupabaseServer()

  const update: Record<string, unknown> = {}
  if (input.amount !== undefined)      update.amount      = input.amount
  if (input.bankDate !== undefined)    update.bank_date   = input.bankDate
  if (input.description !== undefined) update.description = input.description?.trim() || null

  // Type code change → look up the new transaction_type_id.
  if (input.typeCode !== undefined) {
    const { data: typeRow, error: typeErr } = await supabase
      .from('transaction_types').select('id').eq('code', input.typeCode).maybeSingle()
    if (typeErr) return dbFailure(typeErr)
    if (!typeRow) return { ok: false, error: `Tipo ${input.typeCode} no encontrado.` }
    update.transaction_type_id = (typeRow as any).id
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, error: null }  // no-op
  }

  const { error } = await supabase
    .from('transactions').update(update).eq('id', input.transactionId)
  if (error) return dbFailure(error)

  // Amount/type may have moved the cobrado → sync the commission. The input omits
  // period, so read it off the row.
  const { data: txnP } = await supabase
    .from('transactions').select('period').eq('id', input.transactionId).maybeSingle()
  if ((txnP as any)?.period) await syncCommissionForPeriod(input.contractId, (txnP as any).period)

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${input.contractId}`)
  return { ok: true, error: null }
}

// ── Delete a line ──────────────────────────────────────────────────────────
export async function deleteIngresosLine(
  transactionId: string,
  contractId:    string,
): Promise<IngresosLineResult> {
  const supabase = await createSupabaseServer()
  // Capture the period BEFORE deleting so we can sync the commission after.
  const { data: txnP } = await supabase
    .from('transactions').select('period').eq('id', transactionId).maybeSingle()
  const { error } = await supabase.from('transactions').delete().eq('id', transactionId)
  if (error) return dbFailure(error)
  if ((txnP as any)?.period) await syncCommissionForPeriod(contractId, (txnP as any).period)

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}

// ── Mark a recurring charge (recargo) as COBRADO for the period ──────────────
// Powers the "Cobrado" checkbox in the recargos panel. The green/recorded state
// comes purely from a transaction of the recargo's recupero_type_code existing
// for (contract, period) — see recurring-charges-bulk — so this is the single
// lever: tildar CREATES that recupero (idempotent, at the configured amount);
// destildar DELETES it. The commission is then recomputed automatically
// (recompute-if-exists), so the 9% follows the new cobrado — same as any edit.
export async function setRecurringChargeCollected(input: {
  contractId:       string
  period:           string
  recuperoTypeCode: string
  amount:           number
  collected:        boolean
}): Promise<IngresosLineResult> {
  const { contractId, period, recuperoTypeCode, amount, collected } = input
  if (!isAllowedIngresosLineType(recuperoTypeCode)) {
    return { ok: false, error: `Tipo de recupero inválido: ${recuperoTypeCode}.` }
  }
  const supabase = await createSupabaseServer()
  const { data: typeRow, error: typeErr } = await supabase
    .from('transaction_types').select('id').eq('code', recuperoTypeCode).maybeSingle()
  if (typeErr) return dbFailure(typeErr)
  if (!typeRow) return { ok: false, error: `Tipo ${recuperoTypeCode} no encontrado.` }
  const typeId = (typeRow as any).id

  const { data: existing, error: findErr } = await supabase
    .from('transactions').select('id')
    .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', typeId)
  if (findErr) return dbFailure(findErr)
  const rows = (existing ?? []) as any[]

  if (collected) {
    // Idempotent — only create when there is no matching recupero yet (so an
    // amount already entered via Extras is respected, not duplicated).
    if (rows.length === 0) {
      if (!isFinite(amount) || amount <= 0) {
        return { ok: false, error: 'El monto del recargo debe ser mayor a 0.' }
      }
      const { data: contract, error: cErr } = await supabase
        .from('contracts').select('administration_id').eq('id', contractId).maybeSingle()
      if (cErr) return dbFailure(cErr)
      if (!contract) return { ok: false, error: 'Contrato no encontrado.' }
      const { error } = await supabase.from('transactions').insert({
        administration_id:   (contract as any).administration_id,
        contract_id:         contractId,
        transaction_type_id: typeId,
        amount,
        period,
        bank_date:           null,
        description:         null,
      })
      if (error) return dbFailure(error)
    }
  } else if (rows.length > 0) {
    const { error } = await supabase.from('transactions').delete().in('id', rows.map(r => r.id))
    if (error) return dbFailure(error)
  }

  // Ticking / unticking moved the cobrado → sync the commission so the 9% follows.
  await syncCommissionForPeriod(contractId, period)
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}
