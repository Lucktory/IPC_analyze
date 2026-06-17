// ============================================================================
// Landlord detail query + mutation (server action lives in actions.ts)
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface LandlordDetail {
  id:               string
  name:             string
  email:            string | null
  phone:            string | null
  dniOrCuit:        string | null
  notes:            string | null
  externalAccountant: { id: string; name: string; firmName: string | null } | null
}

export interface LandlordProperty {
  id:           string
  address:      string
  propertyType: string
  isVacant:     boolean
  ownershipPct: number
  /** Tenants on the currently-active contract for this property. Empty
   *  when the property is vacant. Sorted by share desc so the cell shows
   *  the dominant tenant first. */
  tenants:      { id: string; name: string; sharePct: number }[]
}

export interface LandlordContract {
  id:            string
  tenantName:    string
  rent:          number
  cadence:       string
  status:        string
  startDate:     string
  endDate:       string
}

export interface LandlordDetailFull {
  landlord:   LandlordDetail
  properties: LandlordProperty[]
  contracts:  LandlordContract[]
}

// ── Lightweight lookup — used by the InlineEntityCell autocomplete on the
//    /liquidacion grid. Returns just id + name, sorted by name.
export interface LandlordOption { id: string; name: string }

export async function listLandlordOptions(): Promise<LandlordOption[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('landlords')
    .select('id, name')
    .order('name', { ascending: true })
  return (data ?? []) as LandlordOption[]
}

export async function getLandlordDetail(id: string): Promise<LandlordDetailFull | null> {
  const supabase = await createSupabaseServer()

  const [landlordRes, propsRes, contractsRes] = await Promise.all([
    supabase
      .from('landlords')
      .select(`
        id, name, email, phone, dni_or_cuit, notes,
        external_accountants(id, name, firm_name)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('property_landlords')
      .select(`
        ownership_pct,
        properties!inner(id, address, property_type)
      `)
      .eq('landlord_id', id),
    supabase
      .from('contract_landlords')
      .select(`
        contracts!inner(
          id, current_rent, cadence, status, start_date, end_date,
          contract_tenants(is_primary, tenants(name))
        )
      `)
      .eq('landlord_id', id),
  ])

  if (!landlordRes.data) return null
  const l = landlordRes.data as any

  // ── Active contracts indexed by property_id, so each LandlordProperty
  //    can carry its current tenants + their share_pct. Phase 11 stores
  //    share_pct on contract_tenants — fall back to 100 for legacy rows.
  const propertyIds = ((propsRes.data ?? []) as any[])
    .map(r => r.properties?.id)
    .filter(Boolean) as string[]

  let tenantsByProperty = new Map<string, { id: string; name: string; sharePct: number }[]>()
  if (propertyIds.length > 0) {
    const activeRes = await supabase
      .from('contracts')
      .select(`
        property_id,
        contract_tenants(share_pct, tenants(id, name))
      `)
      .in('property_id', propertyIds)
      .eq('status', 'active')

    for (const row of (activeRes.data ?? []) as any[]) {
      const list = (row.contract_tenants ?? [])
        .map((ct: any) => ({
          id:        ct.tenants?.id ?? '',
          name:      ct.tenants?.name ?? '',
          sharePct:  Number(ct.share_pct ?? 100),
        }))
        .filter((t: any) => t.id && t.name)
        .sort((a: any, b: any) => b.sharePct - a.sharePct)
      tenantsByProperty.set(row.property_id, list)
    }
  }

  return {
    landlord: {
      id:                l.id,
      name:              l.name,
      email:             l.email,
      phone:             l.phone,
      dniOrCuit:         l.dni_or_cuit,
      notes:             l.notes,
      externalAccountant: l.external_accountants
        ? {
            id:       l.external_accountants.id,
            name:     l.external_accountants.name,
            firmName: l.external_accountants.firm_name,
          }
        : null,
    },
    properties: (propsRes.data ?? []).map((row: any) => {
      const addr     = String(row.properties.address)
      const propId   = row.properties.id
      const tenants  = tenantsByProperty.get(propId) ?? []
      return {
        id:           propId,
        address:      addr,
        propertyType: row.properties.property_type,
        // A property is vacant either by the legacy "(vacante)" suffix in
        // the address OR by having no active contract / no tenants.
        isVacant:     /\(vacante\)/i.test(addr) || tenants.length === 0,
        ownershipPct: Number(row.ownership_pct),
        tenants,
      }
    }),
    contracts: (contractsRes.data ?? []).map((row: any) => {
      const c       = row.contracts
      const primary = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
      return {
        id:         c.id,
        tenantName: primary?.tenants?.name ?? '(sin inquilino)',
        rent:       Number(c.current_rent),
        cadence:    c.cadence,
        status:     c.status,
        startDate:  c.start_date,
        endDate:    c.end_date,
      }
    }),
  }
}
