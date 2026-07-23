'use server'

// ============================================================================
// Movimientos actions — backs the per-contract cashflow modal that's shown on
// both /liquidacion (cell-click) and /contratos/[id] (embedded panel).
//
// Each "movimiento" is one row in the existing `transactions` table — no new
// schema. The modal exposes only the four fields Alejandro asked for: fecha,
// monto, entrada/salida (direction), razón (description). Direction is
// modelled via the transaction_types lookup: when the encargada picks
// Entrada/Salida we map to OTHER_IN / OTHER_OUT so the row is always tagged
// with a valid type. Existing rows that originated from specific codes
// (REPAIR_OUT, COMMISSION_OUT, etc.) preserve their type until the encargada
// explicitly flips direction.
//
// All actions are direct (no redirects) so the modal can stay open after
// each edit. revalidatePath ensures /liquidacion and the contract page
// re-fetch on the next render.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { isManagedRow, managedRowMessage, stripOtrosMarker } from '@/lib/transaction/managed-rows'

export interface Movimiento {
  id:          string
  bankDate:    string | null
  amount:      number
  direction:   'IN' | 'OUT'
  typeCode:    string
  typeLabel:   string
  description: string | null
}

interface ListResult {
  ok:    boolean
  error: string | null
  rows?: Movimiento[]
}

interface InsertResult {
  ok:    boolean
  error: string | null
  movimiento?: Movimiento
}

interface SimpleResult {
  ok:    boolean
  error: string | null
}

const DEFAULT_TYPE_FOR_DIRECTION: Record<'IN' | 'OUT', string> = {
  IN:  'OTHER_IN',
  OUT: 'OTHER_OUT',
}

export async function listMovimientos(
  contractId: string,
  period:     string,
): Promise<ListResult> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, amount, bank_date, description,
      transaction_types!inner(code, label, direction)
    `)
    .eq('contract_id', contractId)
    .eq('period', period)
    .order('bank_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) return dbFailure(error)
  const rows: Movimiento[] = ((data ?? []) as any[]).map(t => ({
    id:          t.id,
    bankDate:    t.bank_date,
    amount:      Number(t.amount),
    direction:   t.transaction_types.direction as 'IN' | 'OUT',
    typeCode:    t.transaction_types.code,
    typeLabel:   t.transaction_types.label,
    description: t.description,
  }))
  return { ok: true, error: null, rows }
}

export async function addMovimiento(
  contractId:  string,
  period:      string,
  direction:   'IN' | 'OUT',
  bankDate:    string | null,
  amount:      number,
  description: string | null,
): Promise<InsertResult> {
  if (!isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a 0.' }
  }
  const supabase = await createSupabaseServer()
  const typeCode = DEFAULT_TYPE_FOR_DIRECTION[direction]
  // A free-text razon must never forge the OTROS cell's reserved marker.
  description = stripOtrosMarker(description)

  const [typeRes, contractRes] = await Promise.all([
    supabase.from('transaction_types').select('id, code, label, direction').eq('code', typeCode).maybeSingle(),
    supabase.from('contracts').select('administration_id').eq('id', contractId).maybeSingle(),
  ])
  if (typeRes.error)     return dbFailure(typeRes.error)
  if (!typeRes.data)     return { ok: false, error: `Tipo "${typeCode}" no encontrado.` }
  if (contractRes.error) return dbFailure(contractRes.error)
  if (!contractRes.data) return { ok: false, error: 'Contrato no encontrado.' }

  const { data: created, error } = await supabase
    .from('transactions')
    .insert({
      administration_id:   (contractRes.data as any).administration_id,
      contract_id:         contractId,
      transaction_type_id: (typeRes.data as any).id,
      amount,
      period,
      bank_date:           bankDate,
      description,
    })
    .select('id')
    .single()
  if (error) return dbFailure(error)

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)

  return {
    ok:    true,
    error: null,
    movimiento: {
      id:          (created as any).id,
      bankDate,
      amount,
      direction,
      typeCode:    (typeRes.data as any).code,
      typeLabel:   (typeRes.data as any).label,
      description,
    },
  }
}

export async function updateMovimiento(
  id:    string,
  patch: Partial<{
    bankDate:    string | null
    amount:      number
    direction:   'IN' | 'OUT'
    description: string | null
  }>,
): Promise<SimpleResult> {
  const supabase = await createSupabaseServer()

  // Guard: the Movimientos modal is a generic editor. It must NOT touch a row
  // owned by a dedicated cell (commission / rent / payout / OTROS cell) — doing
  // so used to retag the row and double the ADMI. Reject and point to the cell.
  const { data: existingRow } = await supabase
    .from('transactions')
    .select('contract_id, period, description, transaction_types!inner(code, direction, affects_liquidacion)')
    .eq('id', id)
    .maybeSingle()
  const existingCode = (existingRow as any)?.transaction_types?.code as string | undefined
  if (existingRow && isManagedRow(existingCode ?? '', (existingRow as any).description)) {
    return { ok: false, error: managedRowMessage(existingCode ?? '') }
  }

  const updates: Record<string, unknown> = {}
  if ('bankDate' in patch)    updates.bank_date   = patch.bankDate
  if ('description' in patch) updates.description = stripOtrosMarker(patch.description ?? null)
  if ('amount' in patch) {
    if (!isFinite(patch.amount as number) || (patch.amount as number) <= 0) {
      return { ok: false, error: 'El monto debe ser mayor a 0.' }
    }
    updates.amount = patch.amount
  }
  // Direction change → swap to the default type for the new direction so the
  // row is always tagged with a valid IN/OUT code. Losing the specific type
  // (REPAIR_OUT etc.) is the intended trade-off: the modal is the simple
  // four-field surface; granular type edits still happen on /movimientos.
  if ('direction' in patch && patch.direction) {
    const typeCode = DEFAULT_TYPE_FOR_DIRECTION[patch.direction]
    const { data: t, error: tErr } = await supabase
      .from('transaction_types').select('id').eq('code', typeCode).maybeSingle()
    if (tErr)  return dbFailure(tErr)
    if (!t)    return { ok: false, error: `Tipo "${typeCode}" no encontrado.` }
    updates.transaction_type_id = (t as any).id
  }

  if (Object.keys(updates).length === 0) return { ok: true, error: null }

  const contractId = (existingRow as any)?.contract_id as string | null

  const { error } = await supabase.from('transactions').update(updates).eq('id', id)
  if (error) return dbFailure(error)

  // A recupero/income row moved (amount or direction) → sync the commission so
  // the 9% follows. Managed rows are rejected above; this only fires for income.
  const typ = (existingRow as any)?.transaction_types
  const period = (existingRow as any)?.period as string | undefined
  const touchesCommission =
    (typ?.affects_liquidacion && typ?.direction === 'IN') || patch.direction === 'IN'
  if (contractId && period && touchesCommission) {
    const { syncCommissionForPeriod } = await import('@/lib/transaction/actions')
    await syncCommissionForPeriod(contractId, period)
  }

  revalidatePath('/liquidacion')
  if (contractId) revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}

export async function deleteMovimiento(id: string): Promise<SimpleResult> {
  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from('transactions')
    .select('contract_id, period, description, transaction_types!inner(code, direction, affects_liquidacion)')
    .eq('id', id)
    .maybeSingle()
  const contractId = (existing as any)?.contract_id as string | null

  // A managed row (commission / rent / payout / OTROS cell) must be cleared from
  // its own cell, not deleted here — deleting it would bypass its single writer.
  const existingCode = (existing as any)?.transaction_types?.code as string | undefined
  if (existing && isManagedRow(existingCode ?? '', (existing as any).description)) {
    return { ok: false, error: managedRowMessage(existingCode ?? '') }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) {
    return dbFailure(error, { fkMessage: 'No se puede eliminar: la transacción está referenciada por una liquidación.' })
  }
  // Deleting a recupero/income row moved the cobrado → sync the commission.
  const typ = (existing as any)?.transaction_types
  const period = (existing as any)?.period as string | undefined
  if (contractId && period && typ?.affects_liquidacion && typ?.direction === 'IN') {
    const { syncCommissionForPeriod } = await import('@/lib/transaction/actions')
    await syncCommissionForPeriod(contractId, period)
  }
  revalidatePath('/liquidacion')
  if (contractId) revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}
