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
import { isManagedRow, managedRowMessage, stripOtrosMarker, OTROS_CELL_MARKER, OTROS_CELL_ILIKE } from '@/lib/transaction/managed-rows'

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
  const description   = stripOtrosMarker(String(formData.get('description') ?? '').trim() || null)

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
  /** Optional bank destination. When set, the COMMISSION_OUT is tagged with the
   *  marker so it lands in that bank column (Galicia / BBVA) instead of the
   *  unclassified ADMI total — avoiding the ADMI_DESTINATIONS_UNCLASSIFIED
   *  warning. The consolidate-then-upsert below keeps it a single row, so
   *  re-tagging an existing (unclassified) commission never duplicates it. */
  destination?: 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6',
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

  // Single writer: setCommission guarantees exactly one COMMISSION_OUT row,
  // preserves the existing bank marker when `destination` is omitted, and never
  // duplicates — so every commission surface (this, the Pct recompute, the
  // detail-page button, the ADMI cell, the bank columns) stays consistent.
  return setCommission(contractId, period, {
    amount:      commissionAmount,
    destination,
    label:       `Comisión ${pct}%${includesIva ? ' + IVA' : ''} sobre total cobrado`,
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

  // generateCommissionForPeriod preserves the existing bank marker when no
  // destination is passed, so editing the % keeps the commission's Galicia/BBVA
  // classification instead of un-classifying it.
  const gen = await generateCommissionForPeriod(contractId, period)
  if (!gen.ok && gen.code === 'NO_INCOME') {
    return { ok: true, error: null, code: 'NO_INCOME' }
  }
  return gen
}

// ============================================================================
// setCommission — the SINGLE writer for a contract+period commission. Every
// commission surface routes through here so their rules can never diverge: it
// guarantees exactly ONE COMMISSION_OUT row, sets amount / bank / label when
// given and PRESERVES the rest (including bank_date). No doubling, no silent
// un-classify, no clobbered amount.
//   • amount omitted       → keep the recorded amount (bank-only re-tag)
//   • destination omitted  → keep the existing bank
//   • label omitted        → keep the existing human text
//   • amount <= 0          → clear the commission (delete the row)
// ============================================================================
type CommissionDest = 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6'
const COMMISSION_MARKER_RE = /\s*[·-]\s*ADM_(GALICIA|FRANCES_50_9|FRANCES_51_6)\b/g
function deriveCommissionDest(description: string | null): CommissionDest | undefined {
  const d = description ?? ''
  return d.includes('ADM_GALICIA')      ? 'ADM_GALICIA'
       : d.includes('ADM_FRANCES_50_9') ? 'ADM_FRANCES_50_9'
       : d.includes('ADM_FRANCES_51_6') ? 'ADM_FRANCES_51_6'
       : undefined
}

export async function setCommission(
  contractId: string,
  period:     string,
  opts:       { amount?: number; destination?: CommissionDest; label?: string },
): Promise<TransactionResult> {
  const supabase = await createSupabaseServer()
  const { data: commType } = await supabase
    .from('transaction_types').select('id').eq('code', 'COMMISSION_OUT').maybeSingle()
  if (!commType) return { ok: false, error: 'Tipo de comisión no encontrado.' }
  const typeId = (commType as any).id

  const { data: rowsData } = await supabase
    .from('transactions').select('id, description, amount, bank_date')
    .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', typeId)
    .order('created_at', { ascending: false })
  const rows = (rowsData ?? []) as any[]
  const survivor = rows[0] ?? null

  // A contract's commission for a period is ONE row — collapse accidental dupes.
  if (rows.length > 1) {
    const { error: delErr } = await supabase.from('transactions').delete().in('id', rows.slice(1).map(r => r.id))
    if (delErr) return dbFailure(delErr)
  }

  const amount = opts.amount ?? (survivor ? Number(survivor.amount) : undefined)
  if (amount == null) return { ok: false, error: 'No hay comisión ni monto para registrar.' }

  // amount <= 0 clears the commission.
  if (amount <= 0) {
    if (survivor) {
      const { error } = await supabase.from('transactions').delete().eq('id', survivor.id)
      if (error) return dbFailure(error)
    }
    revalidatePath('/liquidacion'); revalidatePath('/movimientos')
    return { ok: true, error: null }
  }

  const destination = opts.destination ?? (survivor ? deriveCommissionDest(survivor.description) : undefined)
  const base = (opts.label ?? String(survivor?.description ?? 'Comisión').replace(COMMISSION_MARKER_RE, '').trim()) || 'Comisión'
  const description = `${base}${destination ? ` · ${destination}` : ''}`

  if (survivor) {
    const { error } = await supabase.from('transactions')
      .update({ amount, description })   // bank_date preserved
      .eq('id', survivor.id)
    if (error) return dbFailure(error)
    revalidatePath('/liquidacion'); revalidatePath('/movimientos')
    return { ok: true, error: null, transactionId: survivor.id }
  }

  const { data: contract } = await supabase
    .from('contracts').select('administration_id').eq('id', contractId).maybeSingle()
  const { data: created, error } = await supabase.from('transactions').insert({
    administration_id:   (contract as any)?.administration_id,
    contract_id:         contractId,
    transaction_type_id: typeId,
    period,
    amount,
    description,
    bank_date:           null,
  }).select('id').single()
  if (error) return dbFailure(error)
  revalidatePath('/liquidacion'); revalidatePath('/movimientos')
  return { ok: true, error: null, transactionId: (created as any).id }
}

// tagCommissionBank — assign an already-recorded commission to a bank WITHOUT
// recomputing the amount (the ADMI cell "banco?" affordance).
export async function tagCommissionBank(
  contractId:  string,
  period:      string,
  destination: CommissionDest,
): Promise<TransactionResult> {
  return setCommission(contractId, period, { destination })
}

// setCommissionBankCell — the planilla Galicia / BBVA cells. Sets the amount AND
// assigns it to that bank in ONE row, so typing into a different bank MOVES the
// commission instead of adding a second row (which used to double ADMI).
export async function setCommissionBankCell(
  contractId:  string,
  period:      string,
  destination: CommissionDest,
  amount:      number,
): Promise<TransactionResult> {
  if (amount > 0) return setCommission(contractId, period, { amount, destination })

  // amount <= 0: only clear the commission if it's CURRENTLY in this bank. Other
  // banks' cells read 0 for a commission that lives elsewhere; committing 0 there
  // must be a no-op, not delete the commission (matches the old per-cell action).
  const supabase = await createSupabaseServer()
  const { data: commType } = await supabase
    .from('transaction_types').select('id').eq('code', 'COMMISSION_OUT').maybeSingle()
  if (!commType) return { ok: false, error: 'Tipo de comisión no encontrado.' }
  const { data: rows } = await supabase
    .from('transactions').select('description')
    .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', (commType as any).id)
    .order('created_at', { ascending: false }).limit(1)
  const currentBank = rows && rows[0] ? deriveCommissionDest((rows[0] as any).description) : undefined
  if (currentBank === destination) return setCommission(contractId, period, { amount: 0 })
  return { ok: true, error: null }
}

// ============================================================================
// setRentBankDate — the FECHA BANCO cell (RENT_IN). Sets the bank date on the
// existing rent WITHOUT touching its amount; only creates a rent row (= current
// rent) when none exists yet. This fixes the clobber where marking the date
// used to overwrite a partial cobro recorded in the Alquiler popover with the
// full current_rent. RENT_IN can legitimately be more than one row (split
// payments), so this deliberately does NOT collapse to a single row — it just
// stamps the date on the most-recent rent line.
// ============================================================================
export async function setRentBankDate(
  contractId:     string,
  period:         string,
  bankDate:       string | null,
  fallbackAmount: number,   // current_rent — used only when creating a fresh rent
): Promise<TransactionResult> {
  if (bankDate && !/^\d{4}-\d{2}-\d{2}$/.test(bankDate)) {
    return { ok: false, error: 'Fecha bancaria inválida.' }
  }
  const supabase = await createSupabaseServer()
  const { data: typeRow } = await supabase
    .from('transaction_types').select('id').eq('code', 'RENT_IN').maybeSingle()
  if (!typeRow) return { ok: false, error: 'Tipo RENT_IN no encontrado.' }
  const typeId = (typeRow as any).id

  const { data: rows } = await supabase
    .from('transactions').select('id')
    .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', typeId)
    .order('created_at', { ascending: false }).limit(1)

  if (rows && rows.length > 0) {
    const { error } = await supabase.from('transactions')
      .update({ bank_date: bankDate }).eq('id', (rows[0] as any).id)   // amount preserved
    if (error) return dbFailure(error)
  } else {
    if (!isFinite(fallbackAmount) || fallbackAmount <= 0) {
      return { ok: false, error: 'No hay alquiler cargado para este contrato.' }
    }
    const { data: contract } = await supabase
      .from('contracts').select('administration_id').eq('id', contractId).maybeSingle()
    const { error } = await supabase.from('transactions').insert({
      administration_id:   (contract as any)?.administration_id,
      contract_id:         contractId,
      transaction_type_id: typeId,
      amount:              fallbackAmount,
      period,
      bank_date:           bankDate,
    })
    if (error) return dbFailure(error)
  }
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}

// ============================================================================
// setLandlordPayoutBankDate — the DIA TRANSFERENCIA cell (LANDLORD_PAYOUT).
// Stamps the transfer date on the existing payout row WITHOUT touching its
// amount; only creates a payout row (seeded with the computed transferencia)
// when none exists. Mirrors setRentBankDate: it fixes the clobber where marking
// the date used to overwrite a manually-entered partial payout with the
// computed figure (and silently clear the TRANSFERENCIA_IMBALANCE flag).
// upsertCellTransaction stays the sole writer of the payout AMOUNT.
// ============================================================================
export async function setLandlordPayoutBankDate(
  contractId:     string,
  period:         string,
  bankDate:       string | null,
  fallbackAmount: number,   // computed transferencia — used only when creating
): Promise<TransactionResult> {
  if (bankDate && !/^\d{4}-\d{2}-\d{2}$/.test(bankDate)) {
    return { ok: false, error: 'Fecha bancaria inválida.' }
  }
  const supabase = await createSupabaseServer()
  const { data: typeRow } = await supabase
    .from('transaction_types').select('id').eq('code', 'LANDLORD_PAYOUT').maybeSingle()
  if (!typeRow) return { ok: false, error: 'Tipo LANDLORD_PAYOUT no encontrado.' }
  const typeId = (typeRow as any).id

  const { data: rows } = await supabase
    .from('transactions').select('id')
    .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', typeId)
    .order('created_at', { ascending: false }).limit(1)

  if (rows && rows.length > 0) {
    const { error } = await supabase.from('transactions')
      .update({ bank_date: bankDate }).eq('id', (rows[0] as any).id)   // amount preserved
    if (error) return dbFailure(error)
  } else {
    if (!isFinite(fallbackAmount) || fallbackAmount <= 0) {
      return { ok: false, error: 'No hay transferencia para registrar en este contrato.' }
    }
    const { data: contract } = await supabase
      .from('contracts').select('administration_id').eq('id', contractId).maybeSingle()
    const { error } = await supabase.from('transactions').insert({
      administration_id:   (contract as any)?.administration_id,
      contract_id:         contractId,
      transaction_type_id: typeId,
      amount:              fallbackAmount,
      period,
      bank_date:           bankDate,
    })
    if (error) return dbFailure(error)
  }
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}

// ============================================================================
// setOtrosCell — the planilla OTROS cell (OTHER_OUT). The cell owns exactly one
// row, identified by the reserved OTROS_CELL_MARKER in its description (NOT a
// user-typable label). It only ever touches that row, so it can never adopt,
// overwrite, or delete an itemised salida logged in Movimientos (whose free
// text never carries the marker). Amount 0 clears the cell's row. Both the cell
// row and any Movs salidas sum into `otros`. Imported deduction rows are given
// the marker by the one-time migration so the cell edits them in place instead
// of inserting a duplicate.
// ============================================================================
export async function setOtrosCell(
  contractId: string,
  period:     string,
  amount:     number,
): Promise<TransactionResult> {
  const supabase = await createSupabaseServer()
  const { data: typeRow } = await supabase
    .from('transaction_types').select('id').eq('code', 'OTHER_OUT').maybeSingle()
  if (!typeRow) return { ok: false, error: 'Tipo OTHER_OUT no encontrado.' }
  const typeId = (typeRow as any).id

  const { data: rows } = await supabase
    .from('transactions').select('id')
    .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', typeId)
    .ilike('description', OTROS_CELL_ILIKE)
    .order('created_at', { ascending: false })
  const list = (rows ?? []) as any[]
  const survivor = list[0] ?? null
  if (list.length > 1) {
    const { error: delErr } = await supabase.from('transactions').delete().in('id', list.slice(1).map(r => r.id))
    if (delErr) return dbFailure(delErr)
  }

  if (!isFinite(amount) || amount <= 0) {
    if (survivor) {
      const { error } = await supabase.from('transactions').delete().eq('id', survivor.id)
      if (error) return dbFailure(error)
    }
    revalidatePath('/liquidacion'); revalidatePath('/movimientos')
    return { ok: true, error: null }
  }

  if (survivor) {
    const { error } = await supabase.from('transactions').update({ amount }).eq('id', survivor.id)
    if (error) return dbFailure(error)
  } else {
    const { data: contract } = await supabase
      .from('contracts').select('administration_id').eq('id', contractId).maybeSingle()
    const { error } = await supabase.from('transactions').insert({
      administration_id:   (contract as any)?.administration_id,
      contract_id:         contractId,
      transaction_type_id: typeId,
      amount,
      period,
      bank_date:           null,
      description:         `Otros descuentos ${OTROS_CELL_MARKER}`,
    })
    if (error) return dbFailure(error)
  }
  revalidatePath('/liquidacion'); revalidatePath('/movimientos')
  return { ok: true, error: null }
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

  // Guard: this generic editor must not create, retag, or re-key a row owned by
  // a dedicated cell writer. Editing the existing managed row here (or turning
  // any row INTO a managed type) would give COMMISSION_OUT/etc. a second writer
  // and double the ADMI. Route those edits to the owning planilla cell.
  const { data: existingRow } = await supabase
    .from('transactions')
    .select('description, transaction_types!inner(code)')
    .eq('id', id)
    .maybeSingle()
  const existingCode = (existingRow as any)?.transaction_types?.code as string | undefined
  if (existingRow && isManagedRow(existingCode ?? '', (existingRow as any).description)) {
    return { ok: false, error: managedRowMessage(existingCode ?? '') }
  }
  if (isManagedRow(typeCode, description)) {
    return { ok: false, error: managedRowMessage(typeCode) }
  }

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
