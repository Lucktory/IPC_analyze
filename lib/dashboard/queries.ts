// ============================================================================
// Dashboard queries — wired against the v2 schema.
//
// Uses lib/period.ts getCurrentPeriod() so dashboard, /pendientes,
// /contratos, /conciliacion all audit the same month.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod } from '@/lib/period'

export interface DashboardKpis {
  activeContracts:   number
  rescindedContracts: number
  monthlyIncome:     number  // RENT_IN sum for current period
  monthlyCommission: number  // COMMISSION_OUT sum for current period
}

export interface CommissionByDestination {
  destination: 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6' | 'OTHER'
  label:       string
  total:       number
  txCount:     number
}

export interface TopLandlord {
  name:     string
  revenue:  number
  contracts: number
}

export interface TenantWithoutPayment {
  contractId:   string
  tenantName:   string
  landlordName: string
  expectedRent: number
}

// ---------------------------------------------------------------------------
// 1. Top-level KPIs
// ---------------------------------------------------------------------------
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createSupabaseServer()

  // Contract status counts
  const [activeRes, rescindedRes, rentInRes, commissionRes] = await Promise.all([
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'rescinded'),
    // RENT_IN total for current period — sum via .select('amount')
    supabase
      .from('transactions')
      .select('amount, transaction_types!inner(code)')
      .eq('transaction_types.code', 'RENT_IN')
      .eq('period', getCurrentPeriod()),
    supabase
      .from('transactions')
      .select('amount, transaction_types!inner(code)')
      .eq('transaction_types.code', 'COMMISSION_OUT')
      .eq('period', getCurrentPeriod()),
  ])

  const sum = (rows: { amount: number | string }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount), 0)

  return {
    activeContracts:    activeRes.count ?? 0,
    rescindedContracts: rescindedRes.count ?? 0,
    monthlyIncome:      sum(rentInRes.data as any),
    monthlyCommission:  sum(commissionRes.data as any),
  }
}

// ---------------------------------------------------------------------------
// 2. Commission by destination — the section chief's reconciliation view
// ---------------------------------------------------------------------------
export async function getCommissionByDestination(): Promise<CommissionByDestination[]> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('transactions')
    .select('amount, description, transaction_types!inner(code)')
    .eq('transaction_types.code', 'COMMISSION_OUT')
    .eq('period', getCurrentPeriod())

  const buckets: Record<string, { total: number; count: number; label: string }> = {
    ADM_GALICIA:      { total: 0, count: 0, label: 'ADM Galicia' },
    ADM_FRANCES_50_9: { total: 0, count: 0, label: 'BBVA Francés 50/9 · DONDE.LISA.VALOR' },
    ADM_FRANCES_51_6: { total: 0, count: 0, label: 'BBVA Francés 51/6 · DORSO.LISA.VALOR' },
    OTHER:            { total: 0, count: 0, label: 'Sin destino identificado' },
  }

  for (const row of data ?? []) {
    const descr = (row.description ?? '') as string
    const key =
      descr.includes('ADM_GALICIA')       ? 'ADM_GALICIA' :
      descr.includes('ADM_FRANCES_50_9')  ? 'ADM_FRANCES_50_9' :
      descr.includes('ADM_FRANCES_51_6')  ? 'ADM_FRANCES_51_6' : 'OTHER'
    buckets[key].total += Number(row.amount)
    buckets[key].count += 1
  }

  return (Object.entries(buckets) as [keyof typeof buckets, typeof buckets[string]][])
    .filter(([, v]) => v.count > 0)
    .map(([destination, v]) => ({
      destination: destination as CommissionByDestination['destination'],
      label:       v.label,
      total:       v.total,
      txCount:     v.count,
    }))
    .sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------------------
// 3. Top landlords by current-period revenue
// ---------------------------------------------------------------------------
export async function getTopLandlords(limit = 10): Promise<TopLandlord[]> {
  const supabase = await createSupabaseServer()

  // Fetch every RENT_IN for the period with its contract → contract_landlords → landlord
  const { data } = await supabase
    .from('transactions')
    .select(`
      amount,
      contracts!inner(
        id,
        contract_landlords!inner(
          landlords!inner(name)
        )
      ),
      transaction_types!inner(code)
    `)
    .eq('transaction_types.code', 'RENT_IN')
    .eq('period', getCurrentPeriod())

  // Aggregate in JS — easier than complex Supabase aggregates.
  const acc = new Map<string, { revenue: number; contracts: Set<string> }>()
  for (const row of (data ?? []) as any[]) {
    const contract = row.contracts
    if (!contract) continue
    for (const cl of contract.contract_landlords ?? []) {
      const name = cl.landlords?.name ?? '(sin nombre)'
      if (!acc.has(name)) acc.set(name, { revenue: 0, contracts: new Set() })
      const entry = acc.get(name)!
      entry.revenue += Number(row.amount)
      entry.contracts.add(contract.id)
    }
  }

  return [...acc.entries()]
    .map(([name, v]) => ({ name, revenue: v.revenue, contracts: v.contracts.size }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// 4. Property type breakdown
// ---------------------------------------------------------------------------
export interface PropertyTypeBreakdown {
  type:  string
  count: number
}

export async function getPropertyTypeBreakdown(): Promise<PropertyTypeBreakdown[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.from('properties').select('property_type')
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const t = (row as any).property_type as string
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// 5. Contracts with no current-period payment — proxy for "atrasados"
// ---------------------------------------------------------------------------
export async function getContractsWithoutPayment(): Promise<TenantWithoutPayment[]> {
  const supabase = await createSupabaseServer()

  // Pull all active contracts with their primary tenant + first landlord
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id, current_rent,
      contract_tenants(is_primary, tenants(name)),
      contract_landlords(landlords(name))
    `)
    .eq('status', 'active')

  if (!contracts) return []

  // For each contract, check if there's a RENT_IN in the current period
  const contractIds = contracts.map(c => (c as any).id)
  const { data: payments } = await supabase
    .from('transactions')
    .select('contract_id, transaction_types!inner(code)')
    .eq('transaction_types.code', 'RENT_IN')
    .eq('period', getCurrentPeriod())
    .in('contract_id', contractIds)

  const paidIds = new Set((payments ?? []).map(p => (p as any).contract_id))

  const unpaid = contracts.filter(c => !paidIds.has((c as any).id))

  return unpaid.map((c: any) => {
    const primary = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    const firstLandlord = c.contract_landlords?.[0]
    return {
      contractId:   c.id,
      tenantName:   primary?.tenants?.name ?? '(sin inquilino)',
      landlordName: firstLandlord?.landlords?.name ?? '(sin propietario)',
      expectedRent: Number(c.current_rent),
    }
  })
}
