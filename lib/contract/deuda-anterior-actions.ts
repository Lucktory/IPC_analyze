'use server'

// ============================================================================
// Deuda anterior — alta / baja del saldo que un inquilino arrastra de meses
// previos al corte (DEUDA_EPOCH, Septiembre 2026).
//
// Vive en su propio modulo y no en inline-field-actions.ts porque escribe otra
// tabla (deuda_anterior) y no un campo de contracts: son filas, con alta y
// baja, no un valor que se corrige.
//
// Alejandro, 2026-09-11: "El unico problema va a ser los que deben en serio.
// Hay algunas personas que si... despues me decis como le pongo las deudas que
// tienen" y "la deuda cuando yo la agrego, puedo poner a que periodo
// pertenece?". De ahi que sea una fila por mes y no un total suelto.
//
// El monto lo afirma la oficina; el sistema NO lo calcula. Los meses previos
// al corte estan incompletos en la base (Julio tiene 23 alquileres de 97,
// Agosto ninguno), asi que derivarlo daria un numero que parece exacto y no lo
// es.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { DEUDA_EPOCH } from '@/lib/liquidacion/deuda-breakdown'

export interface InlineResult {
  ok:    boolean
  error: string | null
}

export interface DeudaAnteriorRow {
  period: string
  amount: number
  note:   string | null
}

function revalidate(contractId: string) {
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
}

/** Meses validos: primero de mes y ANTERIOR al corte. Un mes posterior al
 *  corte lo calcula el sistema solo desde los alquileres cobrados; aceptarlo
 *  aca crearia una fila que el desglose despues ignora por duplicada, que es
 *  peor que rechazarla con un motivo. */
function validatePeriod(period: string): string | null {
  if (!/^\d{4}-\d{2}-01$/.test(period)) {
    return 'El período debe ser el primero de un mes (por ejemplo 2026-07-01).'
  }
  if (period >= DEUDA_EPOCH) {
    return 'La deuda anterior es para meses previos al corte. De ahí en adelante el sistema la calcula solo con los alquileres cobrados.'
  }
  return null
}

/** Alta o actualizacion del saldo de UN mes. La unique (contract_id, period)
 *  hace que cargar dos veces el mismo mes lo pise en lugar de duplicarlo. */
export async function setDeudaAnterior(
  contractId: string,
  period:     string,
  amount:     number,
  note:       string | null = null,
): Promise<InlineResult> {
  const periodErr = validatePeriod(period)
  if (periodErr) return { ok: false, error: periodErr }
  if (!isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'El monto debe ser un número mayor a 0.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('deuda_anterior')
    .upsert(
      {
        contract_id: contractId,
        period,
        amount,
        note: note?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'contract_id,period' },
    )
  if (error) return dbFailure(error)

  revalidate(contractId)
  return { ok: true, error: null }
}

/** Baja del saldo de un mes. */
export async function deleteDeudaAnterior(
  contractId: string,
  period:     string,
): Promise<InlineResult> {
  if (!/^\d{4}-\d{2}-01$/.test(period)) {
    return { ok: false, error: 'Período inválido.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('deuda_anterior')
    .delete()
    .eq('contract_id', contractId)
    .eq('period', period)
  if (error) return dbFailure(error)

  revalidate(contractId)
  return { ok: true, error: null }
}

/** Filas cargadas para un contrato, de mas nueva a mas vieja. */
export async function listDeudaAnterior(contractId: string): Promise<DeudaAnteriorRow[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('deuda_anterior')
    .select('period, amount, note')
    .eq('contract_id', contractId)
    .order('period', { ascending: false })
  if (error) {
    console.error('[listDeudaAnterior] fetch failed:', error.message)
    return []
  }
  return ((data ?? []) as any[]).map(r => ({
    period: String(r.period),
    amount: Number(r.amount ?? 0) || 0,
    note:   r.note ?? null,
  }))
}
