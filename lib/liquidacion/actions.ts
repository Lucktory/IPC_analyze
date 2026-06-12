'use server'

// ============================================================================
// Liquidación actions — status transitions + notes updates.
//
// The `liquidaciones` row is created lazily. Until the encargada clicks an
// action, only computed (transaction-derived) data exists; the moment she
// transitions status, we upsert a real row tagged with the computed amounts.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'
import type { LiquidacionStatus } from '@/lib/liquidacion/queries'

export interface LiquidacionActionResult {
  ok:    boolean
  error: string | null
}

/**
 * Move a (contract, landlord, period) liquidación to the given status.
 * Creates the row on first call (status starts as 'draft' by default).
 *
 * We RECOMPUTE the amounts at transition time — so if the encargada
 * recorded a new transaction since opening the page, the snapshot stored
 * in the liquidaciones row reflects the latest data.
 */
export async function transitionLiquidacionStatus(
  contractId: string,
  landlordId: string,
  period:     string,
  newStatus:  LiquidacionStatus,
): Promise<LiquidacionActionResult> {
  if (!['draft', 'sent', 'paid'].includes(newStatus)) {
    return { ok: false, error: 'Estado inválido.' }
  }

  const supabase = await createSupabaseServer()

  // 1. Fetch the contract's administration_id (required FK)
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select('administration_id')
    .eq('id', contractId)
    .maybeSingle()

  if (contractErr) return dbFailure(contractErr)
  if (!contract)   return { ok: false, error: 'Contrato no encontrado.' }

  // 2. Recompute aggregates from current transactions
  const { data: txns, error: txnsErr } = await supabase
    .from('transactions')
    .select('amount, transaction_types!inner(code, direction, affects_liquidacion)')
    .eq('contract_id', contractId)
    .eq('period', period)

  if (txnsErr) return dbFailure(txnsErr)

  let gross = 0, commission = 0, otros = 0
  for (const t of (txns ?? []) as any[]) {
    const typ = t.transaction_types
    if (!typ.affects_liquidacion) continue
    if (typ.direction === 'IN') {
      gross += Number(t.amount)
    } else if (typ.code === 'COMMISSION_OUT') {
      commission += Number(t.amount)
    } else {
      otros += Number(t.amount)
    }
  }
  const totalDeductions = commission + otros
  const netToLandlord   = gross - totalDeductions

  // 3. Upsert the liquidaciones row
  const updates: Record<string, unknown> = {
    administration_id: (contract as any).administration_id,
    contract_id:       contractId,
    landlord_id:       landlordId,
    period,
    gross_amount:      gross,
    total_deductions:  totalDeductions,
    net_to_landlord:   netToLandlord,
    status:            newStatus,
  }
  // Stamp timestamps appropriately; clear them when going back to draft.
  if (newStatus === 'sent')  updates.sent_at = new Date().toISOString()
  if (newStatus === 'paid')  updates.paid_at = new Date().toISOString()
  if (newStatus === 'draft') { updates.sent_at = null; updates.paid_at = null }

  const { error } = await supabase
    .from('liquidaciones')
    .upsert(updates, { onConflict: 'contract_id,landlord_id,period' })

  if (error) return dbFailure(error)

  revalidatePath('/liquidacion')
  revalidatePath(`/liquidacion/${contractId}`)
  return { ok: true, error: null }
}

/** Save free-text notes on a liquidación (creates the row if missing). */
export async function updateLiquidacionNotes(
  contractId: string,
  landlordId: string,
  period:     string,
  notes:      string,
): Promise<LiquidacionActionResult> {
  const supabase = await createSupabaseServer()

  const { data: contract } = await supabase
    .from('contracts')
    .select('administration_id')
    .eq('id', contractId)
    .maybeSingle()
  if (!contract) return { ok: false, error: 'Contrato no encontrado.' }

  const { error } = await supabase
    .from('liquidaciones')
    .upsert(
      {
        administration_id: (contract as any).administration_id,
        contract_id:       contractId,
        landlord_id:       landlordId,
        period,
        notes:             notes.trim() || null,
      },
      { onConflict: 'contract_id,landlord_id,period' },
    )

  if (error) return dbFailure(error)
  revalidatePath(`/liquidacion/${contractId}`)
  return { ok: true, error: null }
}
