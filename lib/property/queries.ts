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

export interface PropertyContract {
  id:             string
  status:         string
  currentRent:    number
  cadence:        string
  startDate:      string | null
  endDate:        string | null
  paymentDay:     number | null
  primaryTenant:  string | null
  /** Phase 11: full co-tenants list with share %. */
  tenants:        { id: string; name: string; sharePct: number }[]
  /** Phase 11: contract-level deposit fields. */
  depositAmount:  number | null
  depositStatus:  string
}

export interface PropertyDetail {
  id:           string
  address:      string
  unit:         string | null
  city:         string | null
  province:     string | null
  propertyType: string
  rooms:        number | null
  surfaceM2:    number | null
  notes:        string | null
  landlords:    { id: string; name: string; ownershipPct: number; cuit: string | null }[]
  contracts:    PropertyContract[]
}

export async function getPropertyDetail(id: string): Promise<PropertyDetail | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('properties')
    .select(`
      id, address, unit, city, province, property_type, rooms, surface_m2, notes,
      property_landlords(ownership_pct, landlords(id, name, dni_or_cuit)),
      contracts(
        id, current_rent, status, cadence, start_date, end_date, payment_day, deposit_amount, deposit_status,
        contract_tenants(is_primary, share_pct, tenants(id, name))
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
    cuit:         pl.landlords?.dni_or_cuit ?? null,
  })).filter((l: any) => l.id)

  const contracts: PropertyContract[] = (p.contracts ?? []).map((c: any) => {
    const tenants = (c.contract_tenants ?? [])
      .map((ct: any) => ({
        id:        ct.tenants?.id ?? '',
        name:      ct.tenants?.name ?? '',
        sharePct:  Number(ct.share_pct ?? 100),
      }))
      .filter((t: any) => t.id && t.name)
      .sort((a: any, b: any) => b.sharePct - a.sharePct)
    const primary = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    return {
      id:             c.id,
      status:         c.status,
      currentRent:    Number(c.current_rent),
      cadence:        c.cadence,
      startDate:      c.start_date ?? null,
      endDate:        c.end_date ?? null,
      paymentDay:     c.payment_day ?? null,
      primaryTenant:  primary?.tenants?.name ?? null,
      tenants,
      depositAmount:  c.deposit_amount != null ? Number(c.deposit_amount) : null,
      depositStatus:  c.deposit_status ?? 'held',
    }
  })

  return {
    id:           p.id,
    address:      p.address,
    unit:         p.unit ?? null,
    city:         p.city ?? null,
    province:     p.province ?? null,
    propertyType: p.property_type,
    rooms:        p.rooms ?? null,
    surfaceM2:    p.surface_m2 != null ? Number(p.surface_m2) : null,
    notes:        p.notes ?? null,
    landlords,
    contracts,
  }
}
