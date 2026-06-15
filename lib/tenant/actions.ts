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

/**
 * Standalone create for the planilla's "+ Nuevo X" modal — does NOT redirect.
 * Returns the new id so the caller can pre-select the tenant.
 */
export interface CreateTenantStandaloneResult {
  ok:    boolean
  error: string | null
  id?:   string
}

export async function createTenantStandalone(input: {
  name:    string
  dni?:    string | null
  phone?:  string | null
  email?:  string | null
}): Promise<CreateTenantStandaloneResult> {
  const supabase = await createSupabaseServer()
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'El nombre no puede estar vacío.' }

  const { data: admin } = await supabase.from('administrations').select('id').limit(1).maybeSingle()
  if (!admin) return { ok: false, error: 'No hay administración configurada.' }

  const { data: existing } = await supabase
    .from('tenants').select('id')
    .eq('administration_id', (admin as any).id).ilike('name', name).maybeSingle()
  if (existing) {
    return { ok: true, error: null, id: (existing as any).id }
  }

  const insertRow: Record<string, unknown> = { administration_id: (admin as any).id, name }
  if (input.dni?.trim())   insertRow.dni   = input.dni.trim()
  if (input.phone?.trim()) insertRow.phone = input.phone.trim()
  if (input.email?.trim()) insertRow.email = input.email.trim()

  const { data, error } = await supabase
    .from('tenants').insert(insertRow).select('id').single()
  if (error) return dbFailure(error)

  revalidatePath('/inquilinos')
  revalidatePath('/liquidacion')
  return { ok: true, error: null, id: (data as any).id }
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
