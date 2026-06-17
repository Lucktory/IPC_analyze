// ============================================================================
// Entity list queries — landlords / tenants / properties / contracts / banks
// Used by the *list* pages. Per-entity detail queries live in their own files.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod } from '@/lib/period'
import { deriveOwner, type OwnerType } from '@/lib/owner'

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
  // Audit
  urgency:         UrgencyTier
  urgencyReasons:  string[]
}

export async function listLandlords(): Promise<LandlordRow[]> {
  const supabase = await createSupabaseServer()

  // Defensive: if the updated_at migration hasn't been applied yet, fall
  // back to a name-only order so the /propietarios page doesn't go blank.
  const landlordsSelect = 'id, name, email, phone, dni_or_cuit'
  const landlordsOrderedP = supabase
    .from('landlords')
    .select(landlordsSelect)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('name')

  const [landlordsRes, contractJunctionRes, propertyJunctionRes, transactionsRes] = await Promise.all([
    landlordsOrderedP,
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
      .eq('period', getCurrentPeriod()),
  ])

  // Fall back for landlordsRes if the updated_at column doesn't exist yet.
  let landlordsData = landlordsRes.data
  if (landlordsRes.error) {
    console.warn('[listLandlords] updated_at order failed; falling back to name-only:', landlordsRes.error.message)
    const fallback = await supabase.from('landlords').select(landlordsSelect).order('name')
    landlordsData = fallback.data
  }

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

  return (landlordsData ?? []).map(l => {
    const id        = (l as any).id as string
    const s         = stats.get(id) ?? { contracts: new Set<string>(), revenue: 0 }
    const props     = propCount.get(id) ?? 0
    const email     = (l as any).email as string | null
    const phone     = (l as any).phone as string | null
    const cuit      = (l as any).dni_or_cuit as string | null
    const contracts = s.contracts.size

    // Urgency audit for landlords. Tighter than before — CUIT alone is data
    // hygiene, not operational urgency. Only flag when the encargada actually
    // needs to act:
    //   Critical: orphan record (zero props AND zero contracts)
    //   Warning:  has active contracts but no way to reach them
    //             (phone AND email both missing)
    //   OK:       everything else
    const reasons: string[] = []
    let urgency: UrgencyTier = 'ok'
    if (props === 0 && contracts === 0) {
      urgency = 'critical'
      reasons.push('Sin propiedades ni contratos')
    } else if (contracts > 0 && !phone && !email) {
      urgency = 'warning'
      reasons.push('Sin teléfono ni email para contactar')
    }

    return {
      id,
      name:            (l as any).name,
      email,
      phone,
      dniOrCuit:       cuit,
      propertyCount:   props,
      contractCount:   contracts,
      monthlyRevenue:  s.revenue,
      urgency,
      urgencyReasons:  reasons,
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
  urgency:        UrgencyTier
  urgencyReasons: string[]
}

export async function listTenants(): Promise<TenantRow[]> {
  const supabase = await createSupabaseServer()

  const tenantsSelect = 'id, name, email, phone, dni'
  const [tenantsRes, junctionRes, contractsRes] = await Promise.all([
    supabase
      .from('tenants')
      .select(tenantsSelect)
      // Sort by most recently updated first; name as tiebreaker.
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('name'),
    supabase
      .from('contract_tenants')
      .select('contract_id, tenant_id, is_primary'),
    supabase
      .from('contracts')
      .select('id, current_rent, status'),
  ])

  // Fall back for tenantsRes if the updated_at column doesn't exist yet.
  let tenantsData = tenantsRes.data
  if (tenantsRes.error) {
    console.warn('[listTenants] updated_at order failed; falling back to name-only:', tenantsRes.error.message)
    const fallback = await supabase.from('tenants').select(tenantsSelect).order('name')
    tenantsData = fallback.data
  }

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

  return (tenantsData ?? []).map(t => {
    const id     = (t as any).id as string
    const s      = stats.get(id) ?? { contracts: new Set<string>(), rent: 0 }
    const email  = (t as any).email as string | null
    const phone  = (t as any).phone as string | null
    const dni    = (t as any).dni as string | null
    const contracts = s.contracts.size

    // Urgency for tenants:
    //   Critical: zero contracts (orphan tenant record)
    //   Warning:  missing phone AND email (can't contact)
    //   OK:       has contract and at least one contact method
    const reasons: string[] = []
    let urgency: UrgencyTier = 'ok'
    if (contracts === 0) {
      urgency = 'critical'
      reasons.push('Sin contratos vigentes')
    } else if (!phone && !email) {
      urgency = 'warning'
      reasons.push('Sin teléfono ni email')
    } else {
      if (!phone) reasons.push('Sin teléfono')
      if (!email) reasons.push('Sin email')
      if (!dni)   reasons.push('Sin DNI')
      if (reasons.length > 0) urgency = 'warning'
    }

    return {
      id,
      name:           (t as any).name,
      email, phone, dni,
      contractCount:  contracts,
      monthlyRent:    s.rent,
      urgency,
      urgencyReasons: reasons,
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
  ownerType:     OwnerType
  ownerLabel:    string
  isActive:      boolean
  urgency:        UrgencyTier
  urgencyReasons: string[]
}

export async function listBankAccounts(): Promise<BankAccountRow[]> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('bank_accounts')
    .select(`
      id, alias, account_number, cbu, account_type, is_active,
      banks!inner(name),
      administration_id, administrator_id, landlord_id,
      administrations(name),
      administrators(name),
      landlords(name)
    `)
    .order('alias')

  return (data ?? []).map(b => {
    const row = b as any
    const { ownerType, ownerLabel } = deriveOwner(row)
    // Urgency for bank accounts — only the blocking case (can't transfer).
    // Missing account_number alone is data hygiene; we don't tint for that.
    const reasons: string[] = []
    let urgency: UrgencyTier = 'ok'
    if (!row.cbu) {
      urgency = 'critical'
      reasons.push('Sin CBU — no se puede transferir')
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
      urgency,
      urgencyReasons: reasons,
    }
  })
}

// Also expose the master list of bank brands (15 seeded Argentine banks).
// Used by the EditBankAccountForm dropdown — only needs id+name+short_code.
export interface BankRow {
  id:        string
  name:      string
  shortCode: string | null
}

export async function listBanks(): Promise<BankRow[]> {
  const supabase = await createSupabaseServer()
  // Try sorting by updated_at first; fall back to name-only if the column
  // doesn't exist yet (migration-2026-06-16-entities-updated-at.sql not
  // applied). The previous version silently returned an empty array on
  // the schema error, which made the /bancos page look broken.
  let { data, error } = await supabase
    .from('banks')
    .select('id, name, short_code')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('name')
  if (error) {
    console.warn('[listBanks] updated_at order failed; falling back to name-only:', error.message)
    const fallback = await supabase.from('banks').select('id, name, short_code').order('name')
    data = fallback.data
  }
  return (data ?? []).map(b => ({
    id:        (b as any).id,
    name:      (b as any).name,
    shortCode: (b as any).short_code,
  }))
}

// Richer view for the Instituciones tab on /bancos — includes the per-bank
// operational fields + an account count rolled up from bank_accounts.
export interface BankInstitutionRow {
  id:               string
  name:             string
  shortCode:        string | null
  monthlyFee:       number | null
  transferFeePct:   number | null
  transferFeeFixed: number | null
  contactName:      string | null
  contactPhone:     string | null
  contactEmail:     string | null
  notes:            string | null
  accountCount:     number
}

export async function listBankInstitutions(): Promise<BankInstitutionRow[]> {
  const supabase = await createSupabaseServer()
  const select = `
        id, name, short_code,
        monthly_fee, transfer_fee_pct, transfer_fee_fixed,
        contact_name, contact_phone, contact_email, notes
      `
  // Same defensive pattern as listBanks: try updated_at-first, fall back to
  // name-only if the migration hasn't been applied yet.
  const [banksRes, accountsRes] = await Promise.all([
    supabase
      .from('banks')
      .select(select)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('name'),
    supabase
      .from('bank_accounts')
      .select('bank_id'),
  ])

  let banksData = banksRes.data
  if (banksRes.error) {
    console.warn('[listBankInstitutions] updated_at order failed; falling back to name-only:', banksRes.error.message)
    const fallback = await supabase.from('banks').select(select).order('name')
    banksData = fallback.data
  }

  const countByBank = new Map<string, number>()
  for (const a of (accountsRes.data ?? []) as any[]) {
    countByBank.set(a.bank_id, (countByBank.get(a.bank_id) ?? 0) + 1)
  }

  return (banksData ?? []).map(b => {
    const row = b as any
    return {
      id:               row.id,
      name:             row.name,
      shortCode:        row.short_code,
      monthlyFee:       row.monthly_fee       != null ? Number(row.monthly_fee)       : null,
      transferFeePct:   row.transfer_fee_pct  != null ? Number(row.transfer_fee_pct)  : null,
      transferFeeFixed: row.transfer_fee_fixed != null ? Number(row.transfer_fee_fixed) : null,
      contactName:      row.contact_name,
      contactPhone:     row.contact_phone,
      contactEmail:     row.contact_email,
      notes:            row.notes,
      accountCount:     countByBank.get(row.id) ?? 0,
    }
  })
}

// ---------------------------------------------------------------------------
// CONTRACTS  (the spine of the business)
// ---------------------------------------------------------------------------
import { computeUrgency, URGENCY_RANK, type UrgencyTier } from '@/lib/contract/urgency'
export type { UrgencyTier }

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
      .eq('period', getCurrentPeriod())
      .eq('transaction_types.code', 'RENT_IN'),
    // Per-contract notes for the current period
    supabase
      .from('contract_period_notes')
      .select('contract_id, body, updated_at')
      .eq('period', getCurrentPeriod()),
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

    const { urgency, reasons: urgencyReasons } = computeUrgency({
      status,
      endDate,
      hasRentThisMonth: hasRentNow,
      hasNoteThisMonth: hasNoteNow,
      recentlyTouched:  recentlyTouchedNow,
      nextAdjustment:   nextAdj,
      today,
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
  /** Legacy single-tenant (primary) — kept for backwards compat. */
  tenant:        string | null
  /** Legacy single-landlord (top owner). */
  landlord:      string | null
  /** Phase 11: every co-owner with their pct, sorted by pct desc. */
  landlords:     { id: string; name: string; ownershipPct: number }[]
  /** Phase 11: every co-tenant on the active contract (if any), sorted by
   *  share desc. Empty when the property is vacant. */
  tenants:       { id: string; name: string; sharePct: number }[]
  currentRent:   number
  urgency:        UrgencyTier
  urgencyReasons: string[]
}

export async function listProperties(): Promise<PropertyRow[]> {
  const supabase = await createSupabaseServer()

  const [propsRes, contractsRes] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        id, address, property_type,
        property_landlords(ownership_pct, landlords(id, name))
      `)
      .order('address'),
    supabase
      .from('contracts')
      .select(`
        id, property_id, current_rent, status,
        contract_tenants(is_primary, share_pct, tenants(id, name))
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

    // Full owners list (sorted by pct desc) — drives the multi-name cell.
    const landlords = ((p.property_landlords ?? []) as any[])
      .map(pl => ({
        id:            pl.landlords?.id ?? '',
        name:          pl.landlords?.name ?? '',
        ownershipPct:  Number(pl.ownership_pct ?? 0),
      }))
      .filter(l => l.id && l.name)
      .sort((a, b) => b.ownershipPct - a.ownershipPct)
    const landlord = landlords[0]?.name ?? null

    // Full tenants list (only when the property has an active contract).
    let tenants: { id: string; name: string; sharePct: number }[] = []
    let tenant: string | null = null
    let rent = 0
    if (contract) {
      tenants = ((contract.contract_tenants ?? []) as any[])
        .map((ct: any) => ({
          id:        ct.tenants?.id ?? '',
          name:      ct.tenants?.name ?? '',
          sharePct:  Number(ct.share_pct ?? 100),
        }))
        .filter((t: any) => t.id && t.name)
        .sort((a, b) => b.sharePct - a.sharePct)
      const primary = (contract.contract_tenants as any[]).find(ct => ct.is_primary) ?? contract.contract_tenants?.[0]
      tenant = primary?.tenants?.name ?? null
      rent   = Number(contract.current_rent)
    }

    // Urgency — vacante = critical, matches the orange Vacante badge.
    const reasons: string[] = []
    let urgency: UrgencyTier = 'ok'
    if (isVacant) {
      urgency = 'critical'
      reasons.push('Propiedad vacante')
    }

    return {
      id:           p.id,
      address:      addr,
      propertyType: p.property_type,
      isVacant,
      hasContract:  !!contract,
      tenant,
      landlord,
      landlords,
      tenants,
      currentRent:  rent,
      urgency,
      urgencyReasons: reasons,
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
  urgency:        UrgencyTier
  urgencyReasons: string[]
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
    const code = t.transaction_types.code as string

    // Urgency for transactions:
    //   Critical: rent-like transaction with no contract link (orphan, can't liquidate)
    //   Warning:  no bank_date (not yet confirmed by the bank statement)
    //   OK:       complete
    const reasons: string[] = []
    let urgency: UrgencyTier = 'ok'
    const isRevenueLike = code === 'RENT_IN' || code === 'OTHER_IN' || code === 'EXPENSAS_IN'
    if (isRevenueLike && !t.contract_id) {
      urgency = 'critical'
      reasons.push('Sin contrato asignado — no se puede liquidar')
    } else if (!t.bank_date) {
      urgency = 'warning'
      reasons.push('Sin fecha bancaria confirmada')
    }

    return {
      id:          t.id,
      typeCode:    code,
      typeLabel:   t.transaction_types.label,
      category:    t.transaction_types.category,
      direction:   t.transaction_types.direction,
      amount:      Number(t.amount),
      period:      t.period,
      bankDate:    t.bank_date,
      description: t.description,
      contractId:  t.contract_id,
      tenantName:  primary?.tenants?.name ?? null,
      urgency,
      urgencyReasons: reasons,
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
