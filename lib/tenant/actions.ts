'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'

export interface UpdateTenantResult {
  ok:    boolean
  error: string | null
}

export async function updateTenant(
  id:       string,
  formData: FormData,
): Promise<UpdateTenantResult> {
  const fields = {
    name:  String(formData.get('name')  ?? '').trim(),
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    dni:   String(formData.get('dni')   ?? '').trim() || null,
  }

  if (!fields.name) {
    return { ok: false, error: 'El nombre no puede estar vacío.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('tenants').update(fields).eq('id', id)

  if (error) return dbFailure(error)

  revalidatePath('/inquilinos')
  revalidatePath(`/inquilinos/${id}`)
  return { ok: true, error: null }
}

/** Create a new tenant. Redirects to the detail page on success. */
export async function createTenant(formData: FormData): Promise<UpdateTenantResult> {
  const fields = {
    name:  String(formData.get('name')  ?? '').trim(),
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    dni:   String(formData.get('dni')   ?? '').trim() || null,
  }
  if (!fields.name) return { ok: false, error: 'El nombre no puede estar vacío.' }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('tenants')
    .insert(fields)
    .select('id')
    .single()
  if (error) return dbFailure(error)

  revalidatePath('/inquilinos')
  redirect(`/inquilinos/${(data as any).id}`)
}

export interface DeleteTenantResult {
  ok:    boolean
  error: string | null
}

/**
 * Hard delete a tenant. The DB has `contract_tenants.tenant_id ON DELETE
 * RESTRICT`, so if this tenant has any contracts (current or past) Postgres
 * will reject with a foreign-key violation. We catch and translate to a
 * friendly message.
 */
export async function deleteTenant(id: string): Promise<DeleteTenantResult> {
  const supabase  = await createSupabaseServer()
  const { error } = await supabase.from('tenants').delete().eq('id', id)

  if (error) {
    return dbFailure(error, {
      fkMessage: 'No se puede eliminar: el inquilino tiene contratos asociados. Primero rescindí o eliminá esos contratos.',
    })
  }

  revalidatePath('/inquilinos')
  redirect('/inquilinos')
}
