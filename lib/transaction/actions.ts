'use server'

// ============================================================================
// Transaction actions — write paths for transactions.
//   createTransaction(formData)            — explicit create from /movimientos/nuevo
//   upsertTransactionByContractPeriod(...) — inline edit on the liquidación grid
//
// Original header below (left as-is):
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
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { updateContractCommissionPct } from '@/lib/contract/inline-field-actions'
import { COMMISSION_IVA_RATE } from '@/lib/liquidacion/thresholds'

export interface TransactionResult {
  ok:    boolean
  error: string | null
  transactionId?: string
  /** Machine-readable reason on a non-fatal failure, so callers can branch
   *  without string-matching the message. 'NO_INCOME' = the period has no
   *  cobro yet, so there's nothing to compute a commission from. */
  code?: 'NO_INCOME'
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
  try {
    console.log(
      `[CELL_TX] upsertTransactionByContractPeriod contract=${contractId} period=${period} ` +
      `type=${typeCode} bankDate=${bankDate ?? '(null)'} amount=${amount ?? '(omitted)'}`,
    )
  } catch { /* ignore */ }
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

// ============================================================================
// createTransaction — explicit create from /movimientos/nuevo form.
// Always inserts; never upserts. Redirects to /movimientos on success.
// ============================================================================
export interface CreateTransactionResult {
  ok:    boolean
  error: string | null
}

export async function createTransaction(formData: FormData): Promise<CreateTransactionResult> {
  const typeCode      = String(formData.get('type_code')   ?? '').trim()
  const amountRaw     = String(formData.get('amount')      ?? '').trim()
  const period        = String(formData.get('period')      ?? '').trim()
  const bankDateRaw   = String(formData.get('bank_date')   ?? '').trim()
  const contractIdRaw = String(formData.get('contract_id') ?? '').trim()
  const bankAccountIdRaw = String(formData.get('bank_account_id') ?? '').trim()
  const description   = String(formData.get('description') ?? '').trim() || null

  // Basic validation
  if (!typeCode)            return { ok: false, error: 'Tipo es obligatorio.' }
  if (!amountRaw)           return { ok: false, error: 'Monto es obligatorio.' }
  const amount = Number(amountRaw)
  if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Monto debe ser un número mayor a 0.' }
  if (!period)              return { ok: false, error: 'Período es obligatorio.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return { ok: false, error: 'Período debe ser YYYY-MM-DD.' }

  const contractId    = contractIdRaw    || null
  const bankAccountId = bankAccountIdRaw || null
  const bankDate      = bankDateRaw      || null

  const supabase = await createSupabaseServer()

  // Resolve transaction_type_id
  const { data: typeRow, error: typeErr } = await supabase
    .from('transaction_types').select('id').eq('code', typeCode).maybeSingle()
  if (typeErr)   return dbFailure(typeErr)
  if (!typeRow)  return { ok: false, error: `Tipo "${typeCode}" no encontrado.` }

  // Resolve administration_id — from contract when provided, else from the
  // bank account, else from the default administration (only one in v1).
  let administrationId: string | null = null
  if (contractId) {
    const { data: c } = await supabase.from('contracts').select('administration_id').eq('id', contractId).maybeSingle()
    administrationId = (c as any)?.administration_id ?? null
  }
  if (!administrationId && bankAccountId) {
    const { data: b } = await supabase.from('bank_accounts').select('administration_id').eq('id', bankAccountId).maybeSingle()
    administrationId = (b as any)?.administration_id ?? null
  }
  if (!administrationId) {
    const { data: defaultAdmin } = await supabase.from('administrations').select('id').limit(1).maybeSingle()
    administrationId = (defaultAdmin as any)?.id ?? null
  }
  if (!administrationId) return { ok: false, error: 'No se pudo determinar la administración.' }

  const { error } = await supabase
    .from('transactions')
    .insert({
      administration_id:   administrationId,
      contract_id:         contractId,
      transaction_type_id: (typeRow as any).id,
      bank_account_id:     bankAccountId,
      amount,
      period,
      bank_date:           bankDate,
      description,
    })

  if (error) return dbFailure(error)

  revalidatePath('/movimientos')
  revalidatePath('/liquidacion')
  redirect('/movimientos')
}

// ============================================================================
// generateCommissionForPeriod — auto-calculate Pampa's commission for a
// (contract, period) based on total cobrado × contract.commission_pct.
//
// Per Alejandro's spec #2: applies to TOTAL COBRADO (alquiler + recuperos),
// not just the rent. Sums all IN transactions where affects_liquidacion=true.
//
// Idempotent: if a COMMISSION_OUT already exists for the (contract, period),
// updates its amount in place rather than inserting a duplicate.
// ============================================================================
export async function generateCommissionForPeriod(
  contractId: string,
  period:     string,
): Promise<TransactionResult> {
  const supabase = await createSupabaseServer()

  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select('administration_id, commission_pct, commission_includes_iva')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr) return dbFailure(contractErr)
  if (!contract)   return { ok: false, error: 'Contrato no encontrado.' }

  const pct = Number((contract as any).commission_pct ?? 8)
  if (!isFinite(pct) || pct <= 0) {
    return { ok: false, error: 'El contrato no tiene un % de comisión válido.' }
  }
  // RI invoicers record the commission + 21% IVA on top ("ADM 9% + IVA"); the
  // same factor the deviation check and the IVA column use. Without this the
  // recompute wrote a 21%-short ADMI for IVA contracts, leaving the row
  // inconsistent. Monotributo: no IVA.
  const includesIva = (contract as any).commission_includes_iva === true
  const ivaFactor   = includesIva ? 1 + COMMISSION_IVA_RATE : 1

  // Sum total cobrado for the period
  const { data: ins, error: insErr } = await supabase
    .from('transactions')
    .select('amount, transaction_types!inner(direction, affects_liquidacion)')
    .eq('contract_id', contractId)
    .eq('period', period)
  if (insErr) return dbFailure(insErr)

  let totalCobrado = 0
  for (const t of (ins ?? []) as any[]) {
    const typ = t.transaction_types
    if (typ.affects_liquidacion && typ.direction === 'IN') {
      totalCobrado += Number(t.amount)
    }
  }
  if (totalCobrado <= 0) {
    return {
      ok: false,
      error: 'No hay ingresos cobrados todavía para este período — la comisión sería $0.',
      code: 'NO_INCOME',
    }
  }

  const commissionAmount =
    Math.round((totalCobrado * pct / 100) * ivaFactor * 100) / 100  // 2-decimal precision

  // Use the upsert helper — it preserves existing description if any.
  return upsertTransactionByContractPeriod({
    contractId,
    period,
    typeCode:    'COMMISSION_OUT',
    bankDate:    null,   // not yet transferred when computed
    amount:      commissionAmount,
    description: `Comisión ${pct}%${includesIva ? ' + IVA' : ''} sobre total cobrado`,
  })
}

// ============================================================================
// updateCommissionPctAndRecalc — change a contract's commission % AND
// recompute the COMMISSION_OUT for the period at the new rate, in one
// confirmed step. Powers the planilla Pct cell: edit % → confirm "$X → $Y"
// → done, with the recorded commission actually updated so the effective %
// reflects the change (no snap-back).
//
// Reuses the two existing actions verbatim — no duplicated validation or
// commission math. If the period has no cobro yet there's nothing to
// recompute: the % is still saved and we return ok with code 'NO_INCOME'
// so the cell shows a soft note instead of a false error.
// ============================================================================
export async function updateCommissionPctAndRecalc(
  contractId: string,
  period:     string,
  pct:        number,
): Promise<TransactionResult> {
  const upd = await updateContractCommissionPct(contractId, pct)
  if (!upd.ok) return { ok: false, error: upd.error }

  const gen = await generateCommissionForPeriod(contractId, period)
  if (!gen.ok && gen.code === 'NO_INCOME') {
    return { ok: true, error: null, code: 'NO_INCOME' }
  }
  return gen
}

// ============================================================================
// updateTransaction — edit an existing transaction's mutable fields.
// ============================================================================
export async function updateTransaction(
  id:       string,
  formData: FormData,
): Promise<CreateTransactionResult> {
  const typeCode      = String(formData.get('type_code')   ?? '').trim()
  const amountRaw     = String(formData.get('amount')      ?? '').trim()
  const period        = String(formData.get('period')      ?? '').trim()
  const bankDateRaw   = String(formData.get('bank_date')   ?? '').trim()
  const contractIdRaw = String(formData.get('contract_id') ?? '').trim()
  const bankAccountIdRaw = String(formData.get('bank_account_id') ?? '').trim()
  const description   = String(formData.get('description') ?? '').trim() || null

  if (!typeCode)  return { ok: false, error: 'Tipo es obligatorio.' }
  if (!amountRaw) return { ok: false, error: 'Monto es obligatorio.' }
  const amount = Number(amountRaw)
  if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Monto debe ser un número mayor a 0.' }
  if (!period) return { ok: false, error: 'Período es obligatorio.' }

  const supabase = await createSupabaseServer()

  const { data: typeRow, error: typeErr } = await supabase
    .from('transaction_types').select('id').eq('code', typeCode).maybeSingle()
  if (typeErr)   return dbFailure(typeErr)
  if (!typeRow)  return { ok: false, error: `Tipo "${typeCode}" no encontrado.` }

  const { error } = await supabase
    .from('transactions')
    .update({
      transaction_type_id: (typeRow as any).id,
      contract_id:         contractIdRaw    || null,
      bank_account_id:     bankAccountIdRaw || null,
      amount,
      period,
      bank_date:           bankDateRaw      || null,
      description,
    })
    .eq('id', id)

  if (error) return dbFailure(error)

  revalidatePath('/movimientos')
  revalidatePath(`/movimientos/${id}`)
  revalidatePath('/liquidacion')
  return { ok: true, error: null }
}

// ============================================================================
// deleteTransaction — hard delete with optional FK guard message.
// ============================================================================
export async function deleteTransaction(id: string): Promise<CreateTransactionResult> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) {
    return dbFailure(error, {
      fkMessage: 'No se puede eliminar: la transacción está referenciada por una liquidación.',
    })
  }
  revalidatePath('/movimientos')
  revalidatePath('/liquidacion')
  redirect('/movimientos')
}
