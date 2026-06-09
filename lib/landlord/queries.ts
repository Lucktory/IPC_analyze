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
      const addr = String(row.properties.address)
      return {
        id:           row.properties.id,
        address:      addr,
        propertyType: row.properties.property_type,
        isVacant:     /\(vacante\)/i.test(addr),
        ownershipPct: Number(row.ownership_pct),
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
