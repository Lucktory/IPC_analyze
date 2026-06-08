// ============================================================================
// Entity list queries — landlords / tenants / properties / contracts / banks
// Used by the *list* pages. Per-entity detail queries live in their own files.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

const CURRENT_PERIOD = '2026-05-01'

// ---------------------------------------------------------------------------
// LANDLORDS  (a.k.a. "contribuyentes" — propietarios with tax info)
// ---------------------------------------------------------------------------
export interface LandlordRow {
  id:              string
  name:            string
  email:           string | null
  phone:           string | null
  dniOrCuit:       string | null
  propertyCount:   number
  contractCount:   number
  monthlyRevenue:  number   // RENT_IN sum for current period across this landlord's contracts
}

export async function listLandlords(): Promise<LandlordRow[]> {
  const supabase = await createSupabaseServer()

  const [landlordsRes, junctionRes, transactionsRes] = await Promise.all([
    supabase
      .from('landlords')
      .select('id, name, email, phone, dni_or_cuit')
      .order('name'),
    supabase
      .from('contract_landlords')
      .select('contract_id, landlord_id'),
    supabase
      .from('transactions')
      .select(`
        amount,
        contract_id,
        transaction_types!inner(code)
      `)
      .eq('transaction_types.code', 'RENT_IN')
      .eq('period', CURRENT_PERIOD),
  ])

  // Build a contract_id → landlord_ids map (a contract may have multiple co-owners)
  const contractToLandlords = new Map<string, string[]>()
  for (const j of (junctionRes.data ?? []) as { contract_id: string; landlord_id: string }[]) {
    const arr = contractToLandlords.get(j.contract_id) ?? []
    arr.push(j.landlord_id)
    contractToLandlords.set(j.contract_id, arr)
  }

  // Per-landlord: count contracts + sum monthly revenue (split across co-owners)
  const stats = new Map<string, { contracts: Set<string>; revenue: number }>()
  for (const j of (junctionRes.data ?? []) as { contract_id: string; landlord_id: string }[]) {
    const entry = stats.get(j.landlord_id) ?? { contracts: new Set<string>(), revenue: 0 }
    entry.contracts.add(j.contract_id)
    stats.set(j.landlord_id, entry)
  }
  for (const tx of (transactionsRes.data ?? []) as { amount: number; contract_id: string }[]) {
    const landlords = contractToLandlords.get(tx.contract_id) ?? []
    const share = landlords.length > 0 ? Number(tx.amount) / landlords.length : 0
    for (const lid of landlords) {
      const entry = stats.get(lid)
      if (entry) entry.revenue += share
    }
  }

  // Property count per landlord — we count via contract_landlords (vacant
  // properties don't have a landlord_id column on properties, only via address).
  const propCount = new Map<string, number>()
  for (const [, landlordIds] of contractToLandlords) {
    for (const lid of landlordIds) propCount.set(lid, (propCount.get(lid) ?? 0) + 1)
  }

  return (landlordsRes.data ?? []).map(l => {
    const s = stats.get((l as any).id) ?? { contracts: new Set(), revenue: 0 }
    return {
      id:              (l as any).id,
      name:            (l as any).name,
      email:           (l as any).email,
      phone:           (l as any).phone,
      dniOrCuit:       (l as any).dni_or_cuit,
      propertyCount:   propCount.get((l as any).id) ?? 0,
      contractCount:   s.contracts.size,
      monthlyRevenue:  s.revenue,
    }
  })
}

// ---------------------------------------------------------------------------
// TENANTS  (inquilinos)
// ---------------------------------------------------------------------------
export interface TenantRow {
  id:            string
  name:          string
  email:         string | null
  phone:         string | null
  dni:           string | null
  contractCount: number
  monthlyRent:   number   // sum of current_rent across the tenant's active contracts
}

export async function listTenants(): Promise<TenantRow[]> {
  const supabase = await createSupabaseServer()

  const [tenantsRes, junctionRes, contractsRes] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, name, email, phone, dni')
      .order('name'),
    supabase
      .from('contract_tenants')
      .select('contract_id, tenant_id, is_primary'),
    supabase
      .from('contracts')
      .select('id, current_rent, status'),
  ])

  const rentByContract = new Map<string, { rent: number; active: boolean }>()
  for (const c of (contractsRes.data ?? []) as any[]) {
    rentByContract.set(c.id, { rent: Number(c.current_rent), active: c.status === 'active' })
  }

  const stats = new Map<string, { contracts: Set<string>; rent: number }>()
  for (const j of (junctionRes.data ?? []) as any[]) {
    const c = rentByContract.get(j.contract_id)
    if (!c) continue
    const entry = stats.get(j.tenant_id) ?? { contracts: new Set<string>(), rent: 0 }
    entry.contracts.add(j.contract_id)
    if (c.active) entry.rent += c.rent
    stats.set(j.tenant_id, entry)
  }

  return (tenantsRes.data ?? []).map(t => {
    const s = stats.get((t as any).id) ?? { contracts: new Set(), rent: 0 }
    return {
      id:             (t as any).id,
      name:           (t as any).name,
      email:          (t as any).email,
      phone:          (t as any).phone,
      dni:            (t as any).dni,
      contractCount:  s.contracts.size,
      monthlyRent:    s.rent,
    }
  })
}

// ---------------------------------------------------------------------------
// BANKS  (Pampa's operating accounts + landlord deposit accounts + the
// 15 seeded bank entries from the master list)
// ---------------------------------------------------------------------------
export interface BankAccountRow {
  id:            string
  bankName:      string
  alias:         string
  accountNumber: string | null
  cbu:           string | null
  accountType:   string
  ownerType:     'admin' | 'administrator' | 'landlord' | 'unknown'
  ownerLabel:    string
  isActive:      boolean
}

export async function listBankAccounts(): Promise<BankAccountRow[]> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('bank_accounts')
    .select(`
      id, alias, account_number, cbu, account_type, is_active,
      banks!inner(name),
      administration_id, administrator_id, landlord_id,
      administrators(name),
      landlords(name)
    `)
    .order('alias')

  return (data ?? []).map(b => {
    const row = b as any
    let ownerType: BankAccountRow['ownerType'] = 'unknown'
    let ownerLabel = '(sin dueño asignado)'
    if (row.administration_id) {
      ownerType = 'admin'
      ownerLabel = 'Pampa Administración'
    } else if (row.administrator_id) {
      ownerType = 'administrator'
      ownerLabel = row.administrators?.name ?? '(admin)'
    } else if (row.landlord_id) {
      ownerType = 'landlord'
      ownerLabel = row.landlords?.name ?? '(propietario)'
    }
    return {
      id:            row.id,
      bankName:      row.banks.name,
      alias:         row.alias,
      accountNumber: row.account_number,
      cbu:           row.cbu,
      accountType:   row.account_type,
      ownerType,
      ownerLabel,
      isActive:      row.is_active,
    }
  })
}

// Also expose the master list of bank brands (15 seeded Argentine banks)
export interface BankRow {
  id:        string
  name:      string
  shortCode: string | null
}

export async function listBanks(): Promise<BankRow[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.from('banks').select('id, name, short_code').order('name')
  return (data ?? []).map(b => ({
    id:        (b as any).id,
    name:      (b as any).name,
    shortCode: (b as any).short_code,
  }))
}

// ---------------------------------------------------------------------------
// CONTRACTS  (the spine of the business)
// ---------------------------------------------------------------------------
export interface ContractRow {
  id:              string
  primaryTenant:   string
  primaryLandlord: string
  currentRent:     number
  cadence:         string
  status:          string
  startDate:       string
  endDate:         string
}

export async function listContracts(): Promise<ContractRow[]> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('contracts')
    .select(`
      id, current_rent, cadence, status, start_date, end_date,
      contract_tenants(is_primary, tenants(name)),
      contract_landlords(ownership_pct, landlords(name))
    `)
    .order('start_date', { ascending: false })

  return (data ?? []).map((c: any) => {
    const primary = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    const topOwner = (c.contract_landlords ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
    return {
      id:              c.id,
      primaryTenant:   primary?.tenants?.name ?? '(sin inquilino)',
      primaryLandlord: topOwner?.landlords?.name ?? '(sin propietario)',
      currentRent:     Number(c.current_rent),
      cadence:         c.cadence,
      status:          c.status,
      startDate:       c.start_date,
      endDate:         c.end_date,
    }
  })
}

// ---------------------------------------------------------------------------
// PROPERTIES
// ---------------------------------------------------------------------------
export interface PropertyRow {
  id:            string
  address:       string
  propertyType:  string
  isVacant:      boolean       // address ends with "(vacante)" OR no contract
  hasContract:   boolean
  tenant:        string | null
  landlord:      string | null // derived from contract (active) or placeholder address
  currentRent:   number
}

export async function listProperties(): Promise<PropertyRow[]> {
  const supabase = await createSupabaseServer()

  const [propsRes, contractsRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, address, property_type')
      .order('address'),
    supabase
      .from('contracts')
      .select(`
        id, property_id, current_rent, status,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(name))
      `)
      .neq('status', 'rescinded'),
  ])

  // Map property_id → contract details
  const contractByProp = new Map<string, any>()
  for (const c of (contractsRes.data ?? []) as any[]) {
    contractByProp.set(c.property_id, c)
  }

  return (propsRes.data ?? []).map((p: any) => {
    const addr  = String(p.address)
    const isVacantByAddress = /\(vacante\)/i.test(addr)
    const contract          = contractByProp.get(p.id)
    const isVacant          = isVacantByAddress || !contract

    let tenant: string | null = null
    let landlord: string | null = null
    let rent = 0
    if (contract) {
      const primary  = contract.contract_tenants?.find((ct: any) => ct.is_primary) ?? contract.contract_tenants?.[0]
      const topOwner = (contract.contract_landlords ?? [])
        .slice()
        .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
      tenant   = primary?.tenants?.name ?? null
      landlord = topOwner?.landlords?.name ?? null
      rent     = Number(contract.current_rent)
    } else {
      // Vacant — try to extract landlord from address text "Propiedad de X"
      const m = addr.match(/^Propiedad de (.+?)( \(vacante\))?$/i)
      if (m) landlord = m[1]
    }

    return {
      id:           p.id,
      address:      addr,
      propertyType: p.property_type,
      isVacant,
      hasContract:  !!contract,
      tenant,
      landlord,
      currentRent:  rent,
    }
  })
}

// ---------------------------------------------------------------------------
// TRANSACTIONS  (movimientos)
// ---------------------------------------------------------------------------
export interface TransactionRow {
  id:            string
  typeCode:      string
  typeLabel:     string
  direction:     'IN' | 'OUT'
  amount:        number
  period:        string | null
  bankDate:      string | null
  description:   string | null
  contractId:    string | null
  tenantName:    string | null
}

export async function listTransactions(period?: string): Promise<TransactionRow[]> {
  const supabase = await createSupabaseServer()

  let q = supabase
    .from('transactions')
    .select(`
      id, amount, period, bank_date, description, contract_id,
      transaction_types!inner(code, label, direction),
      contracts(
        contract_tenants(is_primary, tenants(name))
      )
    `)
    .order('bank_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (period) q = q.eq('period', period)

  const { data } = await q

  return (data ?? []).map((t: any) => {
    const primary = t.contracts?.contract_tenants?.find((ct: any) => ct.is_primary) ?? t.contracts?.contract_tenants?.[0]
    return {
      id:          t.id,
      typeCode:    t.transaction_types.code,
      typeLabel:   t.transaction_types.label,
      direction:   t.transaction_types.direction,
      amount:      Number(t.amount),
      period:      t.period,
      bankDate:    t.bank_date,
      description: t.description,
      contractId:  t.contract_id,
      tenantName:  primary?.tenants?.name ?? null,
    }
  })
}

// Periods that have at least one transaction — for the period filter dropdown
export async function listTransactionPeriods(): Promise<string[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select('period')
    .not('period', 'is', null)
  const seen = new Set<string>()
  for (const r of (data ?? []) as any[]) if (r.period) seen.add(r.period)
  return [...seen].sort().reverse()
}
