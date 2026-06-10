'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

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

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/propietarios')
  revalidatePath(`/propietarios/${id}`)
  return { ok: true, error: null }
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
    if ((error as any).code === '23503' || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        error: 'No se puede eliminar: el propietario tiene propiedades o contratos asociados.',
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/propietarios')
  redirect('/propietarios')
}
