'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure }            from '@/lib/db-errors'

// ── Used by NewContractModal — when the encargada picks an existing
//    property, preload its current owners as the starting point for
//    the contract's per-contract ownership distribution.
export interface PropertyOwnerLine {
  landlordId:   string
  landlordName: string
  ownershipPct: number
}

export async function fetchPropertyOwners(propertyId: string): Promise<PropertyOwnerLine[]> {
  try {
    const supabase = await createSupabaseServer()
    const { data } = await supabase
      .from('property_landlords')
      .select('ownership_pct, landlords(id, name)')
      .eq('property_id', propertyId)
    return ((data ?? []) as any[])
      .map(r => ({
        landlordId:   r.landlords?.id,
        landlordName: r.landlords?.name ?? '',
        ownershipPct: Number(r.ownership_pct),
      }))
      .filter(r => r.landlordId)
  } catch (err) {
    console.error('[fetchPropertyOwners] failed:', err)
    return []
  }
}

// ── Phase 11: edit a property's owners. Validates the sum=100 rule using
//    the shared registry helper so client + server agree exactly. Replaces
//    the property_landlords junction rows in a single transaction.
import { isPctSum100, pctSum } from '@/lib/shared'

export interface UpdatePropertyOwnersResult {
  ok:    boolean
  error: string | null
}

export interface OwnerInput {
  landlordId:   string
  ownershipPct: number
}

export async function updatePropertyOwners(
  propertyId: string,
  rows:       OwnerInput[],
): Promise<UpdatePropertyOwnersResult> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'Tenés que cargar al menos un propietario.' }
    }
    for (const r of rows) {
      if (!r.landlordId) return { ok: false, error: 'Todos los propietarios deben estar seleccionados.' }
      if (!Number.isFinite(r.ownershipPct) || r.ownershipPct <= 0 || r.ownershipPct > 100) {
        return { ok: false, error: 'Cada propietario debe tener un porcentaje entre 0 y 100.' }
      }
    }
    const pcts = rows.map(r => r.ownershipPct)
    if (!isPctSum100(pcts)) {
      return { ok: false, error: `Los porcentajes deben sumar 100% (suman ${pctSum(pcts).toFixed(2)}%).` }
    }
    const seen = new Set<string>()
    for (const r of rows) {
      if (seen.has(r.landlordId)) return { ok: false, error: 'No podés repetir el mismo propietario dos veces.' }
      seen.add(r.landlordId)
    }

    const supabase = await createSupabaseServer()

    // Replace strategy: delete all current rows, then insert the new set.
    // contracts.property_id ON DELETE RESTRICT does not block deletes from
    // property_landlords (different junction), so this is safe.
    const { error: delErr } = await supabase
      .from('property_landlords').delete().eq('property_id', propertyId)
    if (delErr) return dbFailure(delErr)

    const insertRows = rows.map(r => ({
      property_id:    propertyId,
      landlord_id:    r.landlordId,
      ownership_pct:  r.ownershipPct,
    }))
    const { error: insErr } = await supabase
      .from('property_landlords').insert(insertRows)
    if (insErr) return dbFailure(insErr)

    revalidatePath('/propiedades')
    revalidatePath(`/propiedades/${propertyId}`)
    return { ok: true, error: null }
  } catch (err) {
    console.error('[updatePropertyOwners] failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

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

  if (error) return dbFailure(error)

  revalidatePath('/propiedades')
  revalidatePath(`/propiedades/${id}`)
  return { ok: true, error: null }
}

/** Create a new property. Redirects to the detail page on success. */
export async function createProperty(formData: FormData): Promise<UpdatePropertyResult> {
  const fields = {
    address:       String(formData.get('address')       ?? '').trim(),
    property_type: String(formData.get('property_type') ?? '').trim(),
  }
  if (!fields.address) return { ok: false, error: 'La dirección no puede estar vacía.' }
  if (!ALLOWED_TYPES.includes(fields.property_type)) {
    return { ok: false, error: 'Tipo de propiedad inválido.' }
  }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('properties').insert(fields).select('id').single()
  if (error) return dbFailure(error)

  revalidatePath('/propiedades')
  redirect(`/propiedades/${(data as any).id}`)
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
    return dbFailure(error, {
      fkMessage: 'No se puede eliminar: la propiedad tiene contratos asociados (incluyendo rescindidos).',
    })
  }

  revalidatePath('/propiedades')
  redirect('/propiedades')
}
