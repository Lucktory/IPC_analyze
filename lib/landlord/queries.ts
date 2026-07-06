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
  taxCategory:      string          // RI | MONOTRIBUTO | CF | EXENTO
  altEmails:        string[]
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
  id:              string
  contractNumber:  string | null
  propertyAddress: string | null
  tenantName:      string
  rent:            number
  cadence:         string
  status:          string
  startDate:       string
  endDate:         string
}

export interface LandlordPeriodStats {
  cobrado:            number   // affects_liquidacion IN, co-owner split
  comision:           number   // COMMISSION_OUT share
  transferencia:      number   // LANDLORD_PAYOUT share
  contratosCobrados:  number
  contratosActivos:   number
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
        id, name, email, phone, dni_or_cuit, tax_category, alt_emails, notes,
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
          id, contract_number, current_rent, cadence, status, start_date, end_date,
          properties(address),
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
      taxCategory:       l.tax_category ?? 'CF',
      altEmails:         (l.alt_emails ?? []) as string[],
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
        id:              c.id,
        contractNumber:  c.contract_number ?? null,
        propertyAddress: c.properties?.address ?? null,
        tenantName:      primary?.tenants?.name ?? '(sin inquilino)',
        rent:            Number(c.current_rent),
        cadence:         c.cadence,
        status:          c.status,
        startDate:       c.start_date,
        endDate:         c.end_date,
      }
    }),
  }
}

// Per-period money for one landlord: gross cobrado, commission, net transfer —
// each split across a contract's co-owners. Drives the detail "Resumen" card.
export async function getLandlordPeriodStats(landlordId: string, period: string): Promise<LandlordPeriodStats> {
  const supabase = await createSupabaseServer()
  const empty: LandlordPeriodStats = { cobrado: 0, comision: 0, transferencia: 0, contratosCobrados: 0, contratosActivos: 0 }

  const clRes = await supabase
    .from('contract_landlords')
    .select('contract_id, contracts!inner(status)')
    .eq('landlord_id', landlordId)
  const mine = (clRes.data ?? []) as any[]
  const contractIds = mine.map(r => r.contract_id)
  if (contractIds.length === 0) return empty
  const activeIds = new Set(mine.filter(r => r.contracts?.status === 'active').map(r => r.contract_id))

  // Co-owner count per contract (for the split)
  const coRes = await supabase.from('contract_landlords').select('contract_id').in('contract_id', contractIds)
  const coCount = new Map<string, number>()
  for (const r of (coRes.data ?? []) as any[]) coCount.set(r.contract_id, (coCount.get(r.contract_id) ?? 0) + 1)

  const txRes = await supabase
    .from('transactions')
    .select('amount, contract_id, transaction_types!inner(code, direction, affects_liquidacion)')
    .in('contract_id', contractIds)
    .eq('period', period)

  let cobrado = 0, comision = 0, transferencia = 0
  const cobradoContracts = new Set<string>()
  for (const t of (txRes.data ?? []) as any[]) {
    const share = Number(t.amount) / (coCount.get(t.contract_id) ?? 1)
    const tt = t.transaction_types
    if (tt.direction === 'IN' && tt.affects_liquidacion) { cobrado += share; if (activeIds.has(t.contract_id)) cobradoContracts.add(t.contract_id) }
    if (tt.code === 'COMMISSION_OUT')  comision += share
    if (tt.code === 'LANDLORD_PAYOUT') transferencia += share
  }
  return { cobrado, comision, transferencia, contratosCobrados: cobradoContracts.size, contratosActivos: activeIds.size }
}
