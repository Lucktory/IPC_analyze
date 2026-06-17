'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'
import { isPctSum100, pctSum }  from '@/lib/shared'

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

// ============================================================================
// Phase 11 — edit the active contract's tenants from the property page.
// Replaces the contract_tenants rows in one shot, marking the highest
// share_pct row as is_primary so legacy planilla queries keep working.
// ============================================================================

export interface UpdateContractTenantsResult {
  ok:    boolean
  error: string | null
}

export interface TenantShareInput {
  tenantId:  string
  sharePct:  number
}

export async function updateContractTenants(
  contractId: string,
  rows:       TenantShareInput[],
): Promise<UpdateContractTenantsResult> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'Tenés que cargar al menos un inquilino.' }
    }
    for (const r of rows) {
      if (!r.tenantId) return { ok: false, error: 'Todos los inquilinos deben estar seleccionados.' }
      if (!Number.isFinite(r.sharePct) || r.sharePct <= 0 || r.sharePct > 100) {
        return { ok: false, error: 'Cada inquilino debe tener un porcentaje entre 0 y 100.' }
      }
    }
    const pcts = rows.map(r => r.sharePct)
    if (!isPctSum100(pcts)) {
      return { ok: false, error: `Los porcentajes deben sumar 100% (suman ${pctSum(pcts).toFixed(2)}%).` }
    }
    const seen = new Set<string>()
    for (const r of rows) {
      if (seen.has(r.tenantId)) return { ok: false, error: 'No podés repetir el mismo inquilino dos veces.' }
      seen.add(r.tenantId)
    }

    const supabase = await createSupabaseServer()

    const { error: delErr } = await supabase
      .from('contract_tenants').delete().eq('contract_id', contractId)
    if (delErr) return dbFailure(delErr)

    // Highest share = primary (matches NewContractModal's rule).
    let primaryIdx = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].sharePct > rows[primaryIdx].sharePct) primaryIdx = i
    }
    const insertRows = rows.map((r, i) => ({
      contract_id: contractId,
      tenant_id:   r.tenantId,
      share_pct:   r.sharePct,
      is_primary:  i === primaryIdx,
    }))
    const { error: insErr } = await supabase
      .from('contract_tenants').insert(insertRows)
    if (insErr) return dbFailure(insErr)

    // Bump contracts.updated_at so the planilla's recently-edited row tint
    // catches the change.
    await supabase.from('contracts').update({ updated_at: new Date().toISOString() }).eq('id', contractId)

    revalidatePath('/propiedades')
    revalidatePath('/liquidacion')
    revalidatePath(`/contratos/${contractId}`)
    return { ok: true, error: null }
  } catch (err) {
    console.error('[updateContractTenants] failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ============================================================================
// Phase 11 — edit a contract's deposit (amount + status).
// ============================================================================

export interface UpdateContractDepositResult {
  ok:    boolean
  error: string | null
}

const DEPOSIT_STATUSES = ['held', 'partially_used', 'refunded'] as const
type DepositStatus = typeof DEPOSIT_STATUSES[number]

export async function updateContractDeposit(
  contractId:    string,
  depositAmount: number | null,
  depositStatus: string,
): Promise<UpdateContractDepositResult> {
  try {
    if (depositAmount != null) {
      if (!Number.isFinite(depositAmount) || depositAmount < 0) {
        return { ok: false, error: 'El depósito debe ser un monto válido (≥ 0).' }
      }
    }
    if (!(DEPOSIT_STATUSES as readonly string[]).includes(depositStatus)) {
      return { ok: false, error: 'Estado del depósito inválido.' }
    }

    const supabase = await createSupabaseServer()
    const { error } = await supabase
      .from('contracts')
      .update({
        deposit_amount: depositAmount,
        deposit_status: depositStatus as DepositStatus,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', contractId)
    if (error) return dbFailure(error)

    revalidatePath('/propiedades')
    revalidatePath(`/contratos/${contractId}`)
    return { ok: true, error: null }
  } catch (err) {
    console.error('[updateContractDeposit] failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
