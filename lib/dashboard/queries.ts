// ============================================================================
// Dashboard queries — wired against the v2 schema.
//
// Uses lib/period.ts getCurrentPeriod() so dashboard, /pendientes,
// /contratos, /conciliacion all audit the same month.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod, getRecentPeriods, periodAxisLabel } from '@/lib/period'

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
// ---------------------------------------------------------------------------
// 6. Contracts by cadence (mensual / trimestral / etc.) — donut composition.
//    Filters out rescinded so the chart reflects the live portfolio.
// ---------------------------------------------------------------------------
export interface CadenceBreakdown {
  cadence: string   // raw DB value
  label:   string   // capitalized for the legend
  count:   number
}

const CADENCE_LABEL: Record<string, string> = {
  mensual:       'Mensual',
  bimestral:     'Bimestral',
  trimestral:    'Trimestral',
  cuatrimestral: 'Cuatrimestral',
  semestral:     'Semestral',
  anual:         'Anual',
}

export async function getContractsByCadence(): Promise<CadenceBreakdown[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('contracts')
    .select('cadence')
    .eq('status', 'active')

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const c = ((row as any).cadence ?? 'desconocida') as string
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([cadence, count]) => ({
      cadence,
      label: CADENCE_LABEL[cadence] ?? cadence,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// 7. Monthly income trend — last N periods of RENT_IN totals.
//    Feeds the vertical-bar widget with a "vs. mes anterior" delta.
// ---------------------------------------------------------------------------
export interface MonthlyTrendPoint {
  period: string   // 'YYYY-MM-01'
  label:  string   // 'jun' / 'may' — for the x-axis
  value:  number   // pesos
}

export async function getMonthlyIncomeTrend(months = 6): Promise<MonthlyTrendPoint[]> {
  const supabase = await createSupabaseServer()
  const periods  = getRecentPeriods(months)

  const { data } = await supabase
    .from('transactions')
    .select('amount, period, transaction_types!inner(code)')
    .eq('transaction_types.code', 'RENT_IN')
    .in('period', periods)

  const totals = new Map<string, number>(periods.map(p => [p, 0]))
  for (const row of (data ?? []) as { amount: number | string; period: string }[]) {
    totals.set(row.period, (totals.get(row.period) ?? 0) + Number(row.amount))
  }

  return periods.map(p => ({
    period: p,
    label:  periodAxisLabel(p),
    value:  totals.get(p) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// 8. Operational trends — last N periods, 3 metrics:
//    - ingresos    (RENT_IN total)
//    - comisiones  (COMMISSION_OUT total)
//    - pagos       (RENT_IN tx count — proxy for "how many tenants paid")
// ---------------------------------------------------------------------------
export interface OperationalTrendPoint {
  period:     string
  label:      string
  ingresos:   number
  comisiones: number
  pagos:      number   // tx count
}

export async function getOperationalTrends(months = 6): Promise<OperationalTrendPoint[]> {
  const supabase = await createSupabaseServer()
  const periods  = getRecentPeriods(months)

  const [rentRes, commRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, period, transaction_types!inner(code)')
      .eq('transaction_types.code', 'RENT_IN')
      .in('period', periods),
    supabase
      .from('transactions')
      .select('amount, period, transaction_types!inner(code)')
      .eq('transaction_types.code', 'COMMISSION_OUT')
      .in('period', periods),
  ])

  const ingresos   = new Map<string, number>(periods.map(p => [p, 0]))
  const comisiones = new Map<string, number>(periods.map(p => [p, 0]))
  const pagos      = new Map<string, number>(periods.map(p => [p, 0]))

  for (const row of (rentRes.data ?? []) as { amount: number | string; period: string }[]) {
    ingresos.set(row.period, (ingresos.get(row.period) ?? 0) + Number(row.amount))
    pagos.set   (row.period, (pagos.get   (row.period) ?? 0) + 1)
  }
  for (const row of (commRes.data ?? []) as { amount: number | string; period: string }[]) {
    comisiones.set(row.period, (comisiones.get(row.period) ?? 0) + Number(row.amount))
  }

  return periods.map(p => ({
    period:     p,
    label:      periodAxisLabel(p),
    ingresos:   ingresos  .get(p) ?? 0,
    comisiones: comisiones.get(p) ?? 0,
    pagos:      pagos     .get(p) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// 9. Collection health — the single most important "how are we doing this
//    month" metric. Counts and amounts split into paid vs unpaid.
//
//    Uses two passes:
//      a. fetch all active contracts (gives us expected income via sum of
//         current_rent, and the universe of contracts to score)
//      b. fetch all RENT_IN tx for the current period (set of contract_ids
//         that paid, plus sum of actual income)
// ---------------------------------------------------------------------------
export interface CollectionHealth {
  totalContracts:  number
  paidCount:       number
  unpaidCount:     number
  /** Sum of current_rent across all active contracts. */
  expectedAmount:  number
  /** Sum of RENT_IN this period — what actually came in. */
  collectedAmount: number
  /** expectedAmount - collectedAmount (clamped at 0). */
  pendingAmount:   number
  /** % of contracts paid this period, 0-100. */
  collectionRateByCount:  number
  /** % of expected amount actually collected, 0-100. */
  collectionRateByAmount: number
  /** ok / warning / critical bucket — drives the panel's status pill color. */
  status:           'ok' | 'warning' | 'critical'
}

export async function getCollectionHealth(): Promise<CollectionHealth> {
  const supabase = await createSupabaseServer()
  const [contractsRes, paymentsRes] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, current_rent')
      .eq('status', 'active'),
    supabase
      .from('transactions')
      .select('amount, contract_id, transaction_types!inner(code)')
      .eq('transaction_types.code', 'RENT_IN')
      .eq('period', getCurrentPeriod()),
  ])

  const contracts = (contractsRes.data ?? []) as { id: string; current_rent: number | string }[]
  const payments  = (paymentsRes.data ?? []) as { amount: number | string; contract_id: string | null }[]

  const paidContractIds = new Set<string>(
    payments.map(p => p.contract_id).filter((id): id is string => !!id),
  )
  const totalContracts  = contracts.length
  const paidCount       = contracts.filter(c => paidContractIds.has(c.id)).length
  const unpaidCount     = totalContracts - paidCount
  const expectedAmount  = contracts.reduce((s, c) => s + Number(c.current_rent ?? 0), 0)
  const collectedAmount = payments  .reduce((s, p) => s + Number(p.amount       ?? 0), 0)
  const pendingAmount   = Math.max(0, expectedAmount - collectedAmount)

  const collectionRateByCount  = totalContracts > 0 ? (paidCount       / totalContracts) * 100 : 0
  const collectionRateByAmount = expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0

  // Pick the lower of the two for the status — both should be high to be healthy.
  const worstRate = Math.min(collectionRateByCount, collectionRateByAmount)
  const status: CollectionHealth['status'] =
    worstRate >= 85 ? 'ok' :
    worstRate >= 60 ? 'warning' :
                      'critical'

  return {
    totalContracts,
    paidCount,
    unpaidCount,
    expectedAmount,
    collectedAmount,
    pendingAmount,
    collectionRateByCount,
    collectionRateByAmount,
    status,
  }
}

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
