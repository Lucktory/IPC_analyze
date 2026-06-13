'use server'

// ============================================================================
// Transaction actions — write path for the encargada's inline edits.
//
// `upsertTransactionByContractPeriod` is the foundation under inline edits
// on the /liquidacion grid:
//   - typing FECHA BANCO  → upsert RENT_IN for (contract, period)
//   - typing DIA TRANSF   → upsert LANDLORD_PAYOUT for (contract, period)
//
// One transaction per (contract, period, type_code) is the v1 invariant
// — recuperos (ABL/CAMUZZI/TASA) coexist as separate transactions of the
// same RENT_IN type. The inline edit only touches the one matching
// (contract, period, type_code) — recuperos keep their own bank_dates.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'

export interface TransactionResult {
  ok:    boolean
  error: string | null
  transactionId?: string
}

interface UpsertArgs {
  contractId:   string
  /** YYYY-MM-01 — first of the period month. */
  period:       string
  typeCode:     string  // e.g. 'RENT_IN', 'LANDLORD_PAYOUT'
  /** YYYY-MM-DD or null to clear the date. */
  bankDate:     string | null
  /** Required when creating; optional when updating (kept as-is if omitted). */
  amount?:      number
  description?: string | null
}

export async function upsertTransactionByContractPeriod(args: UpsertArgs): Promise<TransactionResult> {
  const { contractId, period, typeCode, bankDate, amount, description } = args
  const supabase = await createSupabaseServer()

  const [typeRes, contractRes] = await Promise.all([
    supabase.from('transaction_types').select('id, direction').eq('code', typeCode).maybeSingle(),
    supabase.from('contracts').select('administration_id').eq('id', contractId).maybeSingle(),
  ])

  if (typeRes.error)     return dbFailure(typeRes.error)
  if (!typeRes.data)     return { ok: false, error: `Tipo "${typeCode}" no encontrado.` }
  if (contractRes.error) return dbFailure(contractRes.error)
  if (!contractRes.data) return { ok: false, error: 'Contrato no encontrado.' }

  const typeId           = (typeRes.data as any).id as string
  const administrationId = (contractRes.data as any).administration_id as string

  // First match on (contract, period, type) — v1 assumes one row per combo
  // for the inline-edit codes. If multiple exist we touch the most recent.
  const { data: existing, error: lookupErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('contract_id', contractId)
    .eq('period', period)
    .eq('transaction_type_id', typeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupErr) return dbFailure(lookupErr)

  if (existing) {
    const updates: Record<string, unknown> = { bank_date: bankDate }
    if (amount !== undefined)      updates.amount      = amount
    if (description !== undefined) updates.description = description

    const { error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', (existing as any).id)
    if (error) return dbFailure(error)

    revalidatePath('/liquidacion')
    revalidatePath('/movimientos')
    return { ok: true, error: null, transactionId: (existing as any).id }
  }

  // Create path
  if (amount == null) {
    return { ok: false, error: 'El monto es obligatorio al crear una nueva transacción.' }
  }

  const { data: created, error } = await supabase
    .from('transactions')
    .insert({
      administration_id:    administrationId,
      contract_id:          contractId,
      transaction_type_id:  typeId,
      period,
      bank_date:            bankDate,
      amount,
      description:          description ?? null,
    })
    .select('id')
    .single()
  if (error) return dbFailure(error)

  revalidatePath('/liquidacion')
  revalidatePath('/movimientos')
  return { ok: true, error: null, transactionId: (created as any).id }
}
