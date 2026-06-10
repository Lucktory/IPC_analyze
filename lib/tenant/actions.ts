'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

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

  if (error) return { ok: false, error: error.message }

  revalidatePath('/inquilinos')
  revalidatePath(`/inquilinos/${id}`)
  return { ok: true, error: null }
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
    // 23503 = foreign_key_violation. Most common cause here: tenant has
    // contract_tenants junction rows.
    if ((error as any).code === '23503' || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        error: 'No se puede eliminar: el inquilino tiene contratos asociados. Primero rescindí o eliminá esos contratos.',
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/inquilinos')
  redirect('/inquilinos')
}
