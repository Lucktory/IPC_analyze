'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'

export interface SaveNoteResult {
  ok:    boolean
  error: string | null
}

export async function saveContractPeriodNote(
  contractId: string,
  period:     string,    // YYYY-MM-DD (first-of-month)
  formData:   FormData,
): Promise<SaveNoteResult> {
  const body = String(formData.get('body') ?? '')

  const supabase = await createSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const editor = userRes?.user?.email ?? null

  const { error } = await supabase
    .from('contract_period_notes')
    .upsert(
      {
        contract_id: contractId,
        period,
        body,
        updated_at: new Date().toISOString(),
        updated_by: editor,
      },
      { onConflict: 'contract_id,period' },
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}

// ============================================================================
// createContract — minimal v1: one tenant + one landlord (100% ownership).
// Co-ownership and co-tenants editable from the detail page later.
// ============================================================================

const ALLOWED_CADENCES   = ['mensual', 'bimestral', 'trimestral', 'cuatrimestral', 'semestral', 'anual']
const ALLOWED_INDEXERS   = ['IPC_GENERAL', 'ICL', 'CASA_PROPIA', 'FIXED']
const ALLOWED_CURRENCIES = ['ARS', 'USD']

export interface CreateContractResult {
  ok:    boolean
  error: string | null
}

export async function createContract(formData: FormData): Promise<CreateContractResult> {
  const propertyId      = String(formData.get('property_id')     ?? '').trim()
  const tenantId        = String(formData.get('tenant_id')       ?? '').trim()
  const landlordId      = String(formData.get('landlord_id')     ?? '').trim()
  const currentRent     = Number(String(formData.get('current_rent') ?? '').trim())
  const cadence         = String(formData.get('cadence')         ?? 'trimestral').trim()
  const startDate       = String(formData.get('start_date')      ?? '').trim()
  const endDate         = String(formData.get('end_date')        ?? '').trim()
  const expensas        = Number(String(formData.get('expensas') ?? '0').trim() || '0')
  const currency        = String(formData.get('currency')        ?? 'ARS').trim()
  const indexer         = String(formData.get('indexer')         ?? 'IPC_GENERAL').trim()
  const paymentDay      = Number(String(formData.get('payment_day') ?? '5').trim() || '5')
  const lfaCode         = String(formData.get('lfa_code')        ?? '').trim() || null
  const contractNumber  = String(formData.get('contract_number') ?? '').trim() || null

  if (!propertyId) return { ok: false, error: 'Seleccioná una propiedad.' }
  if (!tenantId)   return { ok: false, error: 'Seleccioná un inquilino.' }
  if (!landlordId) return { ok: false, error: 'Seleccioná un propietario.' }
  if (!isFinite(currentRent) || currentRent <= 0) return { ok: false, error: 'Alquiler inicial debe ser mayor a 0.' }
  if (!ALLOWED_CADENCES.includes(cadence))   return { ok: false, error: 'Cadencia inválida.' }
  if (!ALLOWED_INDEXERS.includes(indexer))   return { ok: false, error: 'Índice inválido.' }
  if (!ALLOWED_CURRENCIES.includes(currency)) return { ok: false, error: 'Moneda inválida.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { ok: false, error: 'Fecha de inicio inválida.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate))   return { ok: false, error: 'Fecha de fin inválida.' }
  if (new Date(endDate) <= new Date(startDate)) return { ok: false, error: 'La fecha de fin debe ser posterior al inicio.' }
  if (!isFinite(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    return { ok: false, error: 'Día de pago debe ser entre 1 y 31.' }
  }

  const supabase = await createSupabaseServer()

  // Pull administration_id from the property
  const { data: property, error: propErr } = await supabase
    .from('properties').select('administration_id').eq('id', propertyId).maybeSingle()
  if (propErr)   return dbFailure(propErr)
  if (!property) return { ok: false, error: 'Propiedad no encontrada.' }

  // Insert contract row
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .insert({
      administration_id: (property as any).administration_id,
      property_id:       propertyId,
      contract_number:   contractNumber,
      current_rent:      currentRent,
      initial_rent:      currentRent,
      expensas:          isFinite(expensas) ? expensas : 0,
      currency,
      indexer,
      cadence,
      start_date:        startDate,
      end_date:          endDate,
      payment_day:       paymentDay,
      status:            'active',
      lfa_code:          lfaCode,
    })
    .select('id')
    .single()
  if (contractErr) return dbFailure(contractErr)
  const contractId = (contract as any).id as string

  // Junctions — tenant + landlord. Best-effort; if either fails we leave the
  // contract row in place for the operator to repair from the detail page.
  const { error: tenantJunctionErr } = await supabase
    .from('contract_tenants')
    .insert({ contract_id: contractId, tenant_id: tenantId, is_primary: true })
  if (tenantJunctionErr) return dbFailure(tenantJunctionErr)

  const { error: landlordJunctionErr } = await supabase
    .from('contract_landlords')
    .insert({ contract_id: contractId, landlord_id: landlordId, ownership_pct: 100 })
  if (landlordJunctionErr) return dbFailure(landlordJunctionErr)

  revalidatePath('/contratos')
  redirect(`/contratos/${contractId}`)
}
