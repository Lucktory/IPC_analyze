'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

export interface UpdatePropertyResult {
  ok:    boolean
  error: string | null
}

const ALLOWED_TYPES = ['vivienda', 'local', 'cochera', 'oficina', 'deposito']

export async function updateProperty(
  id:       string,
  formData: FormData,
): Promise<UpdatePropertyResult> {
  const fields = {
    address:       String(formData.get('address')       ?? '').trim(),
    property_type: String(formData.get('property_type') ?? '').trim(),
  }

  if (!fields.address) {
    return { ok: false, error: 'La dirección no puede estar vacía.' }
  }
  if (!ALLOWED_TYPES.includes(fields.property_type)) {
    return { ok: false, error: 'Tipo de propiedad inválido.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('properties').update(fields).eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/propiedades')
  revalidatePath(`/propiedades/${id}`)
  return { ok: true, error: null }
}

export interface DeletePropertyResult {
  ok:    boolean
  error: string | null
}

/**
 * Hard delete a property. `contracts.property_id ON DELETE RESTRICT` blocks
 * deletion if the property has ever had a contract (including rescinded).
 */
export async function deleteProperty(id: string): Promise<DeletePropertyResult> {
  const supabase  = await createSupabaseServer()
  const { error } = await supabase.from('properties').delete().eq('id', id)

  if (error) {
    if ((error as any).code === '23503' || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        error: 'No se puede eliminar: la propiedad tiene contratos asociados (incluyendo rescindidos).',
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/propiedades')
  redirect('/propiedades')
}
