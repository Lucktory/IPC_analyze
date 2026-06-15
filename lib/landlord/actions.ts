'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'

export interface UpdateLandlordResult {
  ok:    boolean
  error: string | null
}

export async function updateLandlord(
  id:       string,
  formData: FormData,
): Promise<UpdateLandlordResult> {
  // Normalise fields. Empty strings become null so the DB stores cleanly.
  const fields = {
    name:        String(formData.get('name') ?? '').trim(),
    email:       String(formData.get('email') ?? '').trim() || null,
    phone:       String(formData.get('phone') ?? '').trim() || null,
    dni_or_cuit: String(formData.get('dni_or_cuit') ?? '').trim() || null,
    notes:       String(formData.get('notes') ?? '').trim() || null,
  }

  if (!fields.name) {
    return { ok: false, error: 'El nombre no puede estar vacío.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('landlords').update(fields).eq('id', id)

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
    name:        String(formData.get('name') ?? '').trim(),
    email:       String(formData.get('email') ?? '').trim() || null,
    phone:       String(formData.get('phone') ?? '').trim() || null,
    dni_or_cuit: String(formData.get('dni_or_cuit') ?? '').trim() || null,
    notes:       String(formData.get('notes') ?? '').trim() || null,
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
