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

export interface IngresosLineResult {
  ok:    boolean
  error: string | null
}

// Allowed transaction type codes for an Ingresos line. Anything else is
// rejected at the server boundary so the popover dropdown stays canonical.
export const INGRESOS_LINE_TYPES = [
  'RENT_IN',
  'EXPENSAS_IN',
  'LATE_FEE_IN',
  'RECUPERO_ABL_IN',
  'RECUPERO_AYSA_IN',
  'RECUPERO_METROGAS_IN',
  'RECUPERO_EDESUR_IN',
  'RECUPERO_OTRO_IN',
  'UTILITY_REFUND_IN',
  'OTHER_IN',
] as const
type IngresosLineType = typeof INGRESOS_LINE_TYPES[number]

function isAllowedType(s: string): s is IngresosLineType {
  return (INGRESOS_LINE_TYPES as readonly string[]).includes(s)
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
  if (!isAllowedType(input.typeCode)) {
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
  if (input.typeCode !== undefined && !isAllowedType(input.typeCode)) {
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
  const { error } = await supabase.from('transactions').delete().eq('id', transactionId)
  if (error) return dbFailure(error)

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}
