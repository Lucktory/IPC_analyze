'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'
import { getDashboardPeriod }   from '@/lib/dashboard/queries'

export interface UpdateLandlordResult {
  ok:    boolean
  error: string | null
}

// Fiscal condition (condición fiscal). Drives the planilla IVA: an RI owner's
// commission carries 21% IVA. Anything not in this set is stored as null.
const TAX_CATEGORIES = new Set(['RI', 'MONOTRIBUTO', 'CF', 'EXENTO'])
function parseTaxCategory(formData: FormData): string | null {
  const raw = String(formData.get('tax_category') ?? '').trim().toUpperCase()
  return TAX_CATEGORIES.has(raw) ? raw : null
}

// Feed the owner's fiscal condition into the SINGLE IVA source of truth (the
// per-contract commission_includes_iva flag): RI → commission with IVA,
// anything else → without. Then re-run the SAME commission function the
// planilla toggle and "Calcular" use, for the current period, on the owner's
// contracts that already have a commission — so the recorded ADMI stays
// consistent with the flag. Never throws: a sync failure must not break the
// profile save. (Single-owner is the common case; a co-owned contract takes
// whichever owner was edited last — override per contract with the IVA cell.)
async function syncOwnerIvaToContracts(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  landlordId: string,
  taxCategory: string | null,
): Promise<void> {
  try {
    const isRI = taxCategory === 'RI'
    const { data: cls } = await supabase
      .from('contract_landlords').select('contract_id').eq('landlord_id', landlordId)
    const contractIds = [...new Set(((cls ?? []) as any[]).map(r => r.contract_id).filter(Boolean))] as string[]
    if (!contractIds.length) return

    await supabase.from('contracts').update({ commission_includes_iva: isRI }).in('id', contractIds)

    const period = await getDashboardPeriod()
    const { data: typeRow } = await supabase
      .from('transaction_types').select('id').eq('code', 'COMMISSION_OUT').maybeSingle()
    if (!typeRow) return
    const { data: existing } = await supabase
      .from('transactions').select('contract_id')
      .eq('period', period)
      .eq('transaction_type_id', (typeRow as any).id)
      .in('contract_id', contractIds)
    const withCommission = new Set(((existing ?? []) as any[]).map(r => r.contract_id))
    if (!withCommission.size) return
    const { generateCommissionForPeriod } = await import('@/lib/transaction/actions')
    for (const cid of contractIds) {
      if (withCommission.has(cid)) await generateCommissionForPeriod(cid, period)
    }
  } catch (e) {
    console.warn('[syncOwnerIvaToContracts] failed:', e)
  }
}

export async function updateLandlord(
  id:       string,
  formData: FormData,
): Promise<UpdateLandlordResult> {
  // Normalise fields. Empty strings become null so the DB stores cleanly.
  const fields = {
    name:         String(formData.get('name') ?? '').trim(),
    email:        String(formData.get('email') ?? '').trim() || null,
    phone:        String(formData.get('phone') ?? '').trim() || null,
    dni_or_cuit:  String(formData.get('dni_or_cuit') ?? '').trim() || null,
    tax_category: parseTaxCategory(formData),
    notes:        String(formData.get('notes') ?? '').trim() || null,
  }

  if (!fields.name) {
    return { ok: false, error: 'El nombre no puede estar vacío.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('landlords').update(fields).eq('id', id)

  if (error) return dbFailure(error)

  // Reflect the fiscal condition in the planilla IVA (single source of truth).
  await syncOwnerIvaToContracts(supabase, id, fields.tax_category)

  revalidatePath('/propietarios')
  revalidatePath(`/propietarios/${id}`)
  revalidatePath('/liquidacion')
  return { ok: true, error: null }
}

// Single-field patch for inline editing on the detail page (email / phone /
// CUIT). Whitelisted so only these columns can be written this way.
const LANDLORD_FIELD_COLUMN = { email: 'email', phone: 'phone', cuit: 'dni_or_cuit' } as const

export async function updateLandlordField(
  id:    string,
  field: keyof typeof LANDLORD_FIELD_COLUMN,
  value: string,
): Promise<UpdateLandlordResult> {
  const col = LANDLORD_FIELD_COLUMN[field]
  if (!col) return { ok: false, error: 'Campo inválido.' }
  const v = value.trim() || null
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('landlords').update({ [col]: v }).eq('id', id)
  if (error) return dbFailure(error)
  revalidatePath('/propietarios')
  revalidatePath(`/propietarios/${id}`)
  return { ok: true, error: null }
}

/**
 * Standalone create for the planilla's "+ Nuevo X" modal — does NOT redirect.
 * Returns the new id so the caller (NewContractModal) can pre-select the
 * landlord in its form after creation.
 */
export interface CreateLandlordStandaloneResult {
  ok:    boolean
  error: string | null
  id?:   string
}

export async function createLandlordStandalone(input: {
  name:       string
  dniOrCuit?: string | null
  phone?:     string | null
  email?:     string | null
  notes?:     string | null
}): Promise<CreateLandlordStandaloneResult> {
  const supabase = await createSupabaseServer()
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'El nombre no puede estar vacío.' }

  // Pull administration_id from the first one (single-tenant for now).
  const { data: admin } = await supabase.from('administrations').select('id').limit(1).maybeSingle()
  if (!admin) return { ok: false, error: 'No hay administración configurada.' }

  // Defensive de-dup: link to existing landlord if same name found.
  const { data: existing } = await supabase
    .from('landlords').select('id')
    .eq('administration_id', (admin as any).id).ilike('name', name).maybeSingle()
  if (existing) {
    return { ok: true, error: null, id: (existing as any).id }
  }

  const insertRow: Record<string, unknown> = { administration_id: (admin as any).id, name }
  if (input.dniOrCuit?.trim()) insertRow.dni_or_cuit = input.dniOrCuit.trim()
  if (input.phone?.trim())     insertRow.phone       = input.phone.trim()
  if (input.email?.trim())     insertRow.email       = input.email.trim()
  if (input.notes?.trim())     insertRow.notes       = input.notes.trim()

  const { data, error } = await supabase
    .from('landlords').insert(insertRow).select('id').single()
  if (error) return dbFailure(error)

  revalidatePath('/propietarios')
  revalidatePath('/liquidacion')
  return { ok: true, error: null, id: (data as any).id }
}

/** Create a new landlord. Redirects to the detail page on success. */
export async function createLandlord(formData: FormData): Promise<UpdateLandlordResult> {
  const fields = {
    name:         String(formData.get('name') ?? '').trim(),
    email:        String(formData.get('email') ?? '').trim() || null,
    phone:        String(formData.get('phone') ?? '').trim() || null,
    dni_or_cuit:  String(formData.get('dni_or_cuit') ?? '').trim() || null,
    tax_category: parseTaxCategory(formData),
    notes:        String(formData.get('notes') ?? '').trim() || null,
  }
  if (!fields.name) return { ok: false, error: 'El nombre no puede estar vacío.' }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('landlords').insert(fields).select('id').single()
  if (error) return dbFailure(error)

  revalidatePath('/propietarios')
  redirect(`/propietarios/${(data as any).id}`)
}

export interface DeleteLandlordResult {
  ok:    boolean
  error: string | null
}

/**
 * Hard delete a landlord. Two RESTRICT constraints block this if the
 * landlord has any properties (`property_landlords`) or any contracts
 * (`contract_landlords`). Both are caught and translated to friendly text.
 */
export async function deleteLandlord(id: string): Promise<DeleteLandlordResult> {
  const supabase  = await createSupabaseServer()
  const { error } = await supabase.from('landlords').delete().eq('id', id)

  if (error) {
    return dbFailure(error, {
      fkMessage: 'No se puede eliminar: el propietario tiene propiedades o contratos asociados.',
    })
  }

  revalidatePath('/propietarios')
  redirect('/propietarios')
}
