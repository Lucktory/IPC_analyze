// Per-property detail (for the /propiedades/[id] edit page) + lightweight
// option lists used by the New Contract modal's property autocomplete.

import { createSupabaseServer } from '@/lib/supabase/server'

// ── Property autocomplete option (id + label only) ─────────────────────────
export interface PropertyOption {
  id:      string
  address: string
}

export async function listPropertyOptions(): Promise<PropertyOption[]> {
  try {
    const supabase = await createSupabaseServer()
    const { data } = await supabase
      .from('properties')
      .select('id, address')
      .order('address')
    return ((data ?? []) as any[]).map(p => ({ id: p.id, address: p.address ?? '' }))
  } catch (err) {
    console.error('[listPropertyOptions] failed:', err)
    return []
  }
}

// ── A property's current landlords (drives the modal's owners preload) ─
export interface PropertyOwnerRow {
  landlordId:   string
  landlordName: string
  ownershipPct: number
}

export async function getPropertyOwners(propertyId: string): Promise<PropertyOwnerRow[]> {
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
    console.error('[getPropertyOwners] failed:', err)
    return []
  }
}

export interface PropertyDetail {
  id:           string
  address:      string
  propertyType: string
  landlords:    { id: string; name: string; ownershipPct: number }[]
  contracts:    { id: string; status: string; currentRent: number; primaryTenant: string | null }[]
}

export async function getPropertyDetail(id: string): Promise<PropertyDetail | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('properties')
    .select(`
      id, address, property_type,
      property_landlords(ownership_pct, landlords(id, name)),
      contracts(
        id, current_rent, status,
        contract_tenants(is_primary, tenants(name))
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  const p = data as any

  const landlords = (p.property_landlords ?? []).map((pl: any) => ({
    id:           pl.landlords?.id,
    name:         pl.landlords?.name ?? '',
    ownershipPct: Number(pl.ownership_pct),
  })).filter((l: any) => l.id)

  const contracts = (p.contracts ?? []).map((c: any) => {
    const primary = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    return {
      id:            c.id,
      status:        c.status,
      currentRent:   Number(c.current_rent),
      primaryTenant: primary?.tenants?.name ?? null,
    }
  })

  return {
    id:           p.id,
    address:      p.address,
    propertyType: p.property_type,
    landlords,
    contracts,
  }
}
