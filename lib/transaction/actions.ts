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
import { deriveCommissionDest, buildCommissionMarker, COMMISSION_MARKER_RE, DESTINATION_SHORT_LABEL, type CommissionDest } from '@/lib/bancos/destination'
import { pickPrimaryLandlord } from '@/lib/contract/primary'

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
// computeCommissionForPeriod — the SINGLE commission calculation (total cobrado
// × commission_pct, +21% IVA for RI) plus the contract's default bank. READ-ONLY:
// it computes but writes nothing. Both generateCommissionForPeriod (which writes
// it) and the "Calcular todas" PREVIEW use this one function, so what the preview
// shows and what gets saved can never diverge.
//
// Per Alejandro's spec #2: applies to TOTAL COBRADO (alquiler + recuperos), i.e.
// every IN transaction with affects_liquidacion=true. Returns a reason (not a
// value) when there is no income / no valid %, so callers keep the same messages.
export interface CommissionComputation {
  amount:      number
  pct:         number
  includesIva: boolean
  ingresos:    number
  destination: CommissionDest | null   // contract's default bank (or null)
}
export async function computeCommissionForPeriod(
  contractId: string,
  period:     string,
): Promise<{ ok: true; value: CommissionComputation } | { ok: false; error: string; code?: 'NO_INCOME' }> {
  const supabase = await createSupabaseServer()
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select('commission_pct, commission_includes_iva, commission_destination')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr) return { ok: false, error: contractErr.message }
  if (!contract)   return { ok: false, error: 'Contrato no encontrado.' }

  const pct = Number((contract as any).commission_pct ?? 8)
  if (!isFinite(pct) || pct <= 0) {
    return { ok: false, error: 'El contrato no tiene un % de comisión válido.' }
  }
  // RI invoicers record the commission + 21% IVA on top ("ADM 9% + IVA"); same
  // factor the deviation check and the IVA column use. Monotributo: no IVA.
  const includesIva = (contract as any).commission_includes_iva === true
  const ivaFactor   = includesIva ? 1 + COMMISSION_IVA_RATE : 1

  const { data: ins, error: insErr } = await supabase
    .from('transactions')
    .select('amount, transaction_types!inner(direction, affects_liquidacion)')
    .eq('contract_id', contractId)
    .eq('period', period)
  if (insErr) return { ok: false, error: insErr.message }

  let ingresos = 0
  for (const t of (ins ?? []) as any[]) {
    const typ = t.transaction_types
    if (typ.affects_liquidacion && typ.direction === 'IN') ingresos += Number(t.amount)
  }
  if (ingresos <= 0) {
    return { ok: false, error: 'No hay ingresos cobrados todavía para este período — la comisión sería $0.', code: 'NO_INCOME' }
  }

  const amount = Math.round((ingresos * pct / 100) * ivaFactor * 100) / 100  // 2-decimal precision
  const destination = deriveCommissionDest((contract as any).commission_destination ?? null) ?? null
  return { ok: true, value: { amount, pct, includesIva, ingresos, destination } }
}

// generateCommissionForPeriod — compute (above) + WRITE via setCommission. The
// single writer guarantees exactly one COMMISSION_OUT row, preserves an existing
// bank marker when `destination` is omitted, and inherits the contract's default
// bank for a new one — so every commission surface (Calcular, the bulk button,
// the Pct recompute, the ADMI cell, the bank columns) stays consistent.
export async function generateCommissionForPeriod(
  contractId: string,
  period:     string,
  destination?: 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6',
): Promise<TransactionResult> {
  const c = await computeCommissionForPeriod(contractId, period)
  if (!c.ok) return { ok: false, error: c.error, code: c.code }
  return setCommission(contractId, period, {
    amount:      c.value.amount,
    destination,
    label:       `Comisión ${c.value.pct}%${c.value.includesIva ? ' + IVA' : ''} sobre total cobrado`,
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

  // Load the contract once: administration_id for the insert, and
  // commission_destination as the durable default bank a NEW commission
  // inherits (Alejandro assigns the bank to the administración, so every future
  // period lands in the right account without re-picking). An EXISTING row keeps
  // its own marker (a manual per-period move is never snapped back).
  const { data: contract } = await supabase
    .from('contracts').select('administration_id, commission_destination').eq('id', contractId).maybeSingle()
  const contractDefault = deriveCommissionDest((contract as any)?.commission_destination ?? null)

  const destination = opts.destination
    ?? (survivor ? deriveCommissionDest(survivor.description) : contractDefault)
  const base = (opts.label ?? String(survivor?.description ?? 'Comisión').replace(COMMISSION_MARKER_RE, '').trim()) || 'Comisión'
  const description = `${base}${destination ? buildCommissionMarker(destination) : ''}`

  // An EXPLICIT bank choice — from ANY surface that routes through here (the ADM
  // picker via tagCommissionBank, the Galicia/BBVA cells via setCommissionBankCell,
  // Calcular via generateCommissionForPeriod) — also becomes the contract's
  // durable default, so future periods inherit it. This keeps a single writer for
  // both the per-period marker AND the default. A recompute that omits the bank
  // (updateCommissionPctAndRecalc) passes no destination, so the default is left
  // untouched and a manual per-period move is never snapped back.
  if (opts.destination) {
    const { error: defErr } = await supabase
      .from('contracts').update({ commission_destination: opts.destination }).eq('id', contractId)
    if (defErr) return dbFailure(defErr)
  }

  if (survivor) {
    // Idempotent: skip the write when nothing actually changed. Every cobrado
    // edit now fires a recompute through here, and many are no-ops (e.g. stamping
    // a rent bank date recomputes the same amount) — this keeps them from writing
    // a redundant row + audit entry.
    if (Number(survivor.amount) === amount && survivor.description === description) {
      return { ok: true, error: null, transactionId: survivor.id }
    }
    const { error } = await supabase.from('transactions')
      .update({ amount, description })   // bank_date preserved
      .eq('id', survivor.id)
    if (error) return dbFailure(error)
    revalidatePath('/liquidacion'); revalidatePath('/movimientos')
    return { ok: true, error: null, transactionId: survivor.id }
  }

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

// ── syncCommissionForPeriod — the ONE reflex that keeps a contract's recorded ──
// commission in step with its cobrado. Every cobrado-changing edit fires exactly
// this: extras add/edit/delete, the Cobrado checkbox, Fecha banco, the IVA toggle,
// a recupero edited from Movimientos, the owner's condicion fiscal. It DELEGATES
// to generateCommissionForPeriod (compute + the single-writer setCommission:
// creates the row if missing, recomputes it if present, always preserves the
// bank). When the period's income has dropped to zero it clears any stale
// commission (setCommission with amount 0 deletes; a no-op when none exists).
//
// This is the SINGLE entry point — the old create-if-missing (resync) /
// update-if-exists (recompute) split collapsed into this one function; there is
// no other recompute wrapper. Best-effort: a commission hiccup must never block
// the underlying edit.
export async function syncCommissionForPeriod(contractId: string, period: string): Promise<void> {
  try {
    const res = await generateCommissionForPeriod(contractId, period)
    if (!res.ok && res.code === 'NO_INCOME') {
      // Income gone → clear any stale recorded commission (setCommission amount<=0
      // deletes the row; a no-op when none exists).
      await setCommission(contractId, period, { amount: 0 })
    }
  } catch { /* best-effort — never block the edit */ }
}

// ── "Calcular todas" — one-click sync of a whole period's commissions ─────────
// Finds every contract with a rent cobro whose commission is MISSING or has
// DRIFTED out of sync (recorded total != recomputed — e.g. after adding an ABL
// recupero), with both the current and the new amount. Preview + apply share
// this one function, so the modal shows exactly what gets saved. Every % / bank
// comes from the contract via computeCommissionForPeriod — nothing hardcoded.
async function commissionsToSyncForPeriod(
  period: string,
): Promise<{ ok: boolean; error: string | null; items: Array<{
  contractId: string; current: number | null; next: number
  pct: number; ingresos: number; destination: CommissionDest | null
}> }> {
  const supabase = await createSupabaseServer()
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('contract_id, transaction_types!inner(code)')
    .eq('period', period)
    .in('transaction_types.code', ['RENT_IN', 'RENT_NF_IN'])
  if (txErr) return { ok: false, error: txErr.message, items: [] }
  const cobroIds = [...new Set(((tx ?? []) as any[]).map(t => t.contract_id).filter(Boolean))] as string[]
  if (!cobroIds.length) return { ok: true, error: null, items: [] }

  // Recorded commission TOTAL per contract (a split across banks sums to ADMI).
  const { data: commType } = await supabase
    .from('transaction_types').select('id').eq('code', 'COMMISSION_OUT').maybeSingle()
  const recordedById = new Map<string, number>()
  if (commType) {
    const { data: comm } = await supabase
      .from('transactions').select('contract_id, amount')
      .eq('period', period).eq('transaction_type_id', (commType as any).id).in('contract_id', cobroIds)
    for (const r of (comm ?? []) as any[]) {
      recordedById.set(r.contract_id, (recordedById.get(r.contract_id) ?? 0) + Number(r.amount))
    }
  }

  const items: Array<{ contractId: string; current: number | null; next: number; pct: number; ingresos: number; destination: CommissionDest | null }> = []
  for (const id of cobroIds) {
    const c = await computeCommissionForPeriod(id, period)
    if (!c.ok) continue
    const next    = c.value.amount
    const current = recordedById.has(id) ? (recordedById.get(id) as number) : null
    if (current !== null && Math.abs(current - next) < 0.5) continue   // already in sync — skip
    items.push({ contractId: id, current, next, pct: c.value.pct, ingresos: c.value.ingresos, destination: c.value.destination })
  }
  return { ok: true, error: null, items }
}

export async function generateAllCommissionsForPeriod(
  period: string,
): Promise<{ ok: boolean; generated: number; error: string | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return { ok: false, generated: 0, error: 'Período inválido.' }
  }
  try {
    const { ok, error, items } = await commissionsToSyncForPeriod(period)
    if (!ok) return { ok: false, generated: 0, error }
    let generated = 0
    for (const it of items) {
      // generateCommissionForPeriod -> setCommission (session client) writes the
      // COMMISSION_OUT, which the audit trigger logs with the real actor. It
      // updates the amount and PRESERVES the existing bank marker.
      const res = await generateCommissionForPeriod(it.contractId, period)
      if (res.ok) generated++
    }
    revalidatePath('/liquidacion'); revalidatePath('/movimientos')
    return { ok: true, generated, error: null }
  } catch (e) {
    return { ok: false, generated: 0, error: (e as Error).message }
  }
}

export interface CommissionPreviewRow {
  contractId: string
  label:      string   // contract number + primary tenant/owner
  ingresos:   number
  pct:        number
  amount:     number   // the NEW commission that would be recorded
  /** Currently-recorded commission, or null when there is none yet (a new one).
   *  When it differs from `amount`, the row is a re-sync (drifted), shown as
   *  current -> new in the confirmation. */
  current:    number | null
  bank:       string   // short bank label, or 'sin banco'
}

// Read-only PREVIEW of what "Calcular todas" would create: the SAME target
// contracts (rent cobro, no commission yet) and the SAME math
// (computeCommissionForPeriod) as generateAllCommissionsForPeriod — but writes
// nothing. So the numbers in the confirmation are exactly what gets saved.
export async function previewAllCommissionsForPeriod(
  period: string,
): Promise<{ ok: boolean; rows: CommissionPreviewRow[]; error: string | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return { ok: false, rows: [], error: 'Período inválido.' }
  try {
    const { ok, error, items } = await commissionsToSyncForPeriod(period)
    if (!ok) return { ok: false, rows: [], error }
    if (items.length === 0) return { ok: true, rows: [], error: null }

    // Labels for display (contract number + primary tenant, else owner).
    const supabase = await createSupabaseServer()
    const ids = items.map(i => i.contractId)
    const { data: cs } = await supabase
      .from('contracts')
      .select('id, contract_number, contract_tenants(is_primary, tenants(name)), contract_landlords(ownership_pct, landlords(name))')
      .in('id', ids)
    const labelById = new Map<string, string>()
    for (const c of (cs ?? []) as any[]) {
      const primaryT = (c.contract_tenants ?? []).find((ct: any) => ct.is_primary) ?? (c.contract_tenants ?? [])[0]
      const owner    = pickPrimaryLandlord(c.contract_landlords)
      const who      = primaryT?.tenants?.name ?? owner?.landlords?.name ?? ''
      labelById.set(c.id, [c.contract_number, who].filter(Boolean).join(' · '))
    }

    const rows: CommissionPreviewRow[] = items.map(i => ({
      contractId: i.contractId,
      label:      labelById.get(i.contractId) ?? i.contractId,
      ingresos:   i.ingresos,
      pct:        i.pct,
      amount:     i.next,
      current:    i.current,
      bank:       i.destination ? DESTINATION_SHORT_LABEL[i.destination] : 'sin banco',
    }))
    rows.sort((a, b) => b.amount - a.amount)
    return { ok: true, rows, error: null }
  } catch (e) {
    return { ok: false, rows: [], error: (e as Error).message }
  }
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
  // Cobro recorded → keep the commission in step (create it on the first cobro,
  // recompute it otherwise). Best-effort — see syncCommissionForPeriod.
  await syncCommissionForPeriod(contractId, period)
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
    .from('transaction_types').select('id, direction, affects_liquidacion').eq('code', typeCode).maybeSingle()
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

  // A recupero/income row edited here moved the cobrado → sync the commission
  // (the shared reflex). Managed rows are rejected above, so this only ever fires
  // for recuperos / expensas / otros-IN.
  const t = typeRow as any
  if (contractIdRaw && t.affects_liquidacion && t.direction === 'IN') {
    await syncCommissionForPeriod(contractIdRaw, period)
  }

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
