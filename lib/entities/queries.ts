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

  const [landlordsRes, contractJunctionRes, propertyJunctionRes, transactionsRes] = await Promise.all([
    supabase
      .from('landlords')
      .select('id, name, email, phone, dni_or_cuit')
      .order('name'),
    // Contract-level co-ownership (drives the monthly revenue split + contract count)
    supabase
      .from('contract_landlords')
      .select('contract_id, landlord_id'),
    // Property-level ownership (drives the property count — INCLUDES vacancies)
    supabase
      .from('property_landlords')
      .select('property_id, landlord_id'),
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
  for (const j of (contractJunctionRes.data ?? []) as { contract_id: string; landlord_id: string }[]) {
    const arr = contractToLandlords.get(j.contract_id) ?? []
    arr.push(j.landlord_id)
    contractToLandlords.set(j.contract_id, arr)
  }

  // Per-landlord contract count + monthly revenue (split across co-owners)
  const stats = new Map<string, { contracts: Set<string>; revenue: number }>()
  for (const j of (contractJunctionRes.data ?? []) as { contract_id: string; landlord_id: string }[]) {
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

  // Property count per landlord — via the direct property_landlords junction.
  // This INCLUDES vacant properties (which contract_landlords doesn't).
  const propCount = new Map<string, number>()
  for (const j of (propertyJunctionRes.data ?? []) as { property_id: string; landlord_id: string }[]) {
    propCount.set(j.landlord_id, (propCount.get(j.landlord_id) ?? 0) + 1)
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
export type UrgencyTier = 'critical' | 'warning' | 'recent' | 'upcoming' | 'ok'

export interface ContractRow {
  id:              string
  primaryTenant:   string
  primaryLandlord: string
  currentRent:     number
  cadence:         string
  status:          string
  startDate:       string
  endDate:         string
  nextAdjustment:  string | null   // YYYY-MM-DD — next rent adjustment per cadence

  // Urgency audit signals (used for row tinting + sort)
  hasRentThisMonth:  boolean
  hasNoteThisMonth:  boolean
  recentlyTouched:   boolean       // tx bank_date or note updated_at within last 48h
  urgency:           UrgencyTier
  urgencyReasons:    string[]      // human-readable reasons, for the hover tooltip
}

// Cadence → step in months between adjustments
const CADENCE_MONTHS: Record<string, number> = {
  mensual:       1,
  bimestral:     2,
  trimestral:    3,
  cuatrimestral: 4,
  semestral:     6,
  anual:         12,
}

// Next adjustment date = start_date + N × cadence months, where N is the
// smallest positive integer such that the result is strictly after `today`.
// Returns null for unknown cadences or non-active contracts.
function computeNextAdjustment(startDate: string, cadence: string, status: string, today: Date): string | null {
  if (status !== 'active') return null
  const months = CADENCE_MONTHS[cadence]
  if (!months) return null
  const next = new Date(startDate)
  // Guard against infinite loops on bad data
  let safety = 1000
  while (next <= today && safety-- > 0) {
    next.setMonth(next.getMonth() + months)
  }
  if (safety <= 0) return null
  return next.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Urgency audit — what the encargada's eye should be pulled to
// ---------------------------------------------------------------------------
interface UrgencyInputs {
  status:            string
  endDate:           string
  hasRentThisMonth:  boolean
  hasNoteThisMonth:  boolean
  recentlyTouched:   boolean
  nextAdjustment:    string | null
  today:             Date
  in30days:          Date
  in60days:          Date
}

function computeUrgency(i: UrgencyInputs): { urgency: UrgencyTier; urgencyReasons: string[] } {
  const reasons: string[] = []

  if (i.status !== 'active') {
    return { urgency: 'ok', urgencyReasons: [] }
  }

  const end = new Date(i.endDate)
  const venceSoon30  = end >= i.today && end <= i.in30days
  const venceSoon60  = end >  i.in30days && end <= i.in60days
  const noRent       = !i.hasRentThisMonth
  const noNote       = !i.hasNoteThisMonth

  if (venceSoon30)               reasons.push('vence en ≤30 días')
  if (venceSoon60)               reasons.push('vence en 31-60 días')
  if (noRent)                    reasons.push('sin RENT_IN este mes')
  if (noNote)                    reasons.push('sin nota del período')

  // Tier ladder. Critical wins over warning, etc.
  if (venceSoon30)        return { urgency: 'critical', urgencyReasons: reasons }
  if (noRent && noNote)   return { urgency: 'critical', urgencyReasons: reasons }
  if (venceSoon60)        return { urgency: 'warning',  urgencyReasons: reasons }
  if (noRent || noNote)   return { urgency: 'warning',  urgencyReasons: reasons }

  if (i.recentlyTouched)  return { urgency: 'recent',   urgencyReasons: ['datos actualizados en las últimas 48 hs'] }

  if (i.nextAdjustment) {
    const adj = new Date(i.nextAdjustment)
    if (adj >= i.today && adj <= i.in30days) {
      return { urgency: 'upcoming', urgencyReasons: ['próximo aumento en ≤30 días'] }
    }
  }

  return { urgency: 'ok', urgencyReasons: [] }
}

const URGENCY_RANK: Record<UrgencyTier, number> = {
  critical: 0, warning: 1, recent: 2, upcoming: 3, ok: 4,
}

export interface ContractListFilters {
  estado?:     'todos' | 'activo' | 'por_vencer' | 'rescindido'
  cadencia?:   string   // 'trimestral', 'cuatrimestral', etc., or 'todas'
  landlordId?: string   // landlord uuid, or 'todos'
  q?:          string   // free-text search across tenant + landlord names
  orden?:      'urgencia' | 'fecha'  // sort
  pendientes?: boolean  // when true, hide urgency='ok' rows
}

export interface ContractListResult {
  rows:          ContractRow[]
  counts: {
    todos:       number
    activo:      number
    por_vencer:  number
    rescindido:  number
  }
}

export async function listContracts(filters: ContractListFilters = {}): Promise<ContractListResult> {
  const supabase = await createSupabaseServer()

  const [contractsRes, rentTxnsRes, notesRes] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, current_rent, cadence, status, start_date, end_date,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(id, name))
      `)
      .order('start_date', { ascending: false }),
    // Per-contract rent status for the current period — drives the audit
    supabase
      .from('transactions')
      .select(`contract_id, bank_date, transaction_types!inner(code)`)
      .eq('period', CURRENT_PERIOD)
      .eq('transaction_types.code', 'RENT_IN'),
    // Per-contract notes for the current period
    supabase
      .from('contract_period_notes')
      .select('contract_id, body, updated_at')
      .eq('period', CURRENT_PERIOD),
  ])

  // 48-hour cutoff for "recently touched"
  const today        = new Date()
  const in30days     = new Date(today.getTime() + 30 * 86400000)
  const in60days     = new Date(today.getTime() + 60 * 86400000)
  const last48hAgoMs = today.getTime() - 48 * 3600000

  // Roll up audit signals per contract
  const hasRent     = new Map<string, boolean>()
  const recentTxn   = new Map<string, boolean>()
  for (const t of (rentTxnsRes.data ?? []) as any[]) {
    if (!t.contract_id) continue
    hasRent.set(t.contract_id, true)
    if (t.bank_date && new Date(t.bank_date).getTime() > last48hAgoMs) {
      recentTxn.set(t.contract_id, true)
    }
  }
  const hasNote     = new Map<string, boolean>()
  const recentNote  = new Map<string, boolean>()
  for (const n of (notesRes.data ?? []) as any[]) {
    const body = (n.body ?? '').trim()
    if (body) hasNote.set(n.contract_id, true)
    if (n.updated_at && new Date(n.updated_at).getTime() > last48hAgoMs) {
      recentNote.set(n.contract_id, true)
    }
  }

  // Normalise to ContractRow shape + compute urgency
  const all: (ContractRow & { landlordId: string })[] = (contractsRes.data ?? []).map((c: any) => {
    const primary  = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    const topOwner = (c.contract_landlords ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]

    const cId            = c.id as string
    const status         = c.status as string
    const endDate        = c.end_date as string
    const nextAdj        = computeNextAdjustment(c.start_date, c.cadence, status, today)
    const hasRentNow     = !!hasRent.get(cId)
    const hasNoteNow     = !!hasNote.get(cId)
    const recentlyTouchedNow = !!recentTxn.get(cId) || !!recentNote.get(cId)

    const { urgency, urgencyReasons } = computeUrgency({
      status,
      endDate,
      hasRentThisMonth: hasRentNow,
      hasNoteThisMonth: hasNoteNow,
      recentlyTouched:  recentlyTouchedNow,
      nextAdjustment:   nextAdj,
      today, in30days, in60days,
    })

    return {
      id:                cId,
      primaryTenant:     primary?.tenants?.name ?? '(sin inquilino)',
      primaryLandlord:   topOwner?.landlords?.name ?? '(sin propietario)',
      landlordId:        topOwner?.landlords?.id ?? '',
      currentRent:       Number(c.current_rent),
      cadence:           c.cadence,
      status,
      startDate:         c.start_date,
      endDate,
      nextAdjustment:    nextAdj,
      hasRentThisMonth:  hasRentNow,
      hasNoteThisMonth:  hasNoteNow,
      recentlyTouched:   recentlyTouchedNow,
      urgency,
      urgencyReasons,
    }
  })

  // Status counts (always over the full set — independent of current filters)
  const counts = {
    todos:      all.length,
    activo:     all.filter(c => c.status === 'active').length,
    por_vencer: all.filter(c => {
      const end = new Date(c.endDate)
      return c.status === 'active' && end >= today && end <= in60days
    }).length,
    rescindido: all.filter(c => c.status === 'rescinded').length,
  }

  // Apply filters
  let rows = all
  if (filters.estado === 'activo') {
    rows = rows.filter(c => c.status === 'active')
  } else if (filters.estado === 'rescindido') {
    rows = rows.filter(c => c.status === 'rescinded')
  } else if (filters.estado === 'por_vencer') {
    rows = rows.filter(c => {
      const end = new Date(c.endDate)
      return c.status === 'active' && end >= today && end <= in60days
    })
  }
  if (filters.cadencia && filters.cadencia !== 'todas') {
    rows = rows.filter(c => c.cadence === filters.cadencia)
  }
  if (filters.landlordId && filters.landlordId !== 'todos') {
    rows = rows.filter(c => c.landlordId === filters.landlordId)
  }
  if (filters.q) {
    const q = filters.q.trim().toLowerCase()
    rows = rows.filter(c =>
      c.primaryTenant.toLowerCase().includes(q) ||
      c.primaryLandlord.toLowerCase().includes(q),
    )
  }
  if (filters.pendientes) {
    rows = rows.filter(c => c.urgency !== 'ok')
  }

  // Sort
  if (filters.orden === 'fecha') {
    rows = rows.slice().sort((a, b) => a.endDate.localeCompare(b.endDate))
  } else {
    // Default: by urgency (critical → ok), then by tenant name
    rows = rows.slice().sort((a, b) => {
      const ra = URGENCY_RANK[a.urgency]
      const rb = URGENCY_RANK[b.urgency]
      if (ra !== rb) return ra - rb
      return a.primaryTenant.localeCompare(b.primaryTenant)
    })
  }

  return { rows: rows.map(({ landlordId: _l, ...rest }) => rest), counts }
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
      .select(`
        id, address, property_type,
        property_landlords(ownership_pct, landlords(name))
      `)
      .order('address'),
    supabase
      .from('contracts')
      .select(`
        id, property_id, current_rent, status,
        contract_tenants(is_primary, tenants(name))
      `)
      .neq('status', 'rescinded'),
  ])

  // Map property_id → contract details (for active contract info)
  const contractByProp = new Map<string, any>()
  for (const c of (contractsRes.data ?? []) as any[]) {
    contractByProp.set(c.property_id, c)
  }

  return (propsRes.data ?? []).map((p: any) => {
    const addr  = String(p.address)
    const isVacantByAddress = /\(vacante\)/i.test(addr)
    const contract          = contractByProp.get(p.id)
    const isVacant          = isVacantByAddress || !contract

    // Top landlord via the direct property_landlords junction (works for
    // vacancies too)
    const topOwner = (p.property_landlords ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
    const landlord = topOwner?.landlords?.name ?? null

    let tenant: string | null = null
    let rent = 0
    if (contract) {
      const primary = contract.contract_tenants?.find((ct: any) => ct.is_primary) ?? contract.contract_tenants?.[0]
      tenant = primary?.tenants?.name ?? null
      rent   = Number(contract.current_rent)
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
  category:      string                   // 'rent' | 'commission' | 'expense' | 'tax' | 'utility' | 'deposit' | 'refund' | 'transfer' | 'other'
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
      transaction_types!inner(code, label, direction, category),
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
      category:    t.transaction_types.category,
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
