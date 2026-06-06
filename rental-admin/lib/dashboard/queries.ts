import { createSupabaseServer } from '@/lib/supabase/server'
import { addDays, format, startOfMonth, endOfMonth } from 'date-fns'

const TODAY = new Date('2026-06-06')
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')

export interface DashboardKpis {
  activeContracts: number
  expiringSoon: number
  lateCount: number
  lateTotal: number
  weeklyAdjustments: number
}

export interface UpcomingAdjustment {
  fecha: string
  contrato: string
  inquilino: string
  actual: number
  nuevo: number
  cadencia: string
}

export interface BankPosition {
  banco: string
  esperado: number
  recibido: number
}

export interface LateTenant {
  inquilino: string
  contrato: string
  monto: number
  dias: number
  interes: number
}

export async function getKpis(): Promise<DashboardKpis> {
  const supabase = await createSupabaseServer()
  const monthEnd60 = fmtDate(addDays(TODAY, 60))
  const weekEnd = fmtDate(addDays(TODAY, 7))

  const [active, expiring, late, weekly] = await Promise.all([
    supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).lte('end_date', monthEnd60),
    supabase.from('payments').select('amount').eq('status', 'late'),
    supabase.from('contracts').select('*', { count: 'exact', head: true })
      .gte('next_adjustment_date', fmtDate(TODAY))
      .lte('next_adjustment_date', weekEnd),
  ])

  const lateTotal = (late.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
  return {
    activeContracts: active.count ?? 0,
    expiringSoon: expiring.count ?? 0,
    lateCount: (late.data ?? []).length,
    lateTotal,
    weeklyAdjustments: weekly.count ?? 0,
  }
}

export async function getUpcomingAdjustments(limit = 5): Promise<UpcomingAdjustment[]> {
  const supabase = await createSupabaseServer()
  const window30 = fmtDate(addDays(TODAY, 30))

  const { data } = await supabase
    .from('contracts')
    .select('id, current_rent, cadence, next_adjustment_date, tenants(name)')
    .gte('next_adjustment_date', fmtDate(TODAY))
    .lte('next_adjustment_date', window30)
    .order('next_adjustment_date', { ascending: true })
    .limit(limit)

  // Estimated factor for display purposes — exact value comes from the live engine.
  const ESTIMATED_FACTOR = 1.1357
  return (data ?? []).map((c: any) => ({
    fecha: format(new Date(c.next_adjustment_date), 'dd/MM'),
    contrato: '#' + c.id.slice(0, 4).toUpperCase(),
    inquilino: c.tenants?.name?.split(' ').slice(-1)[0] ?? '—',
    actual: Number(c.current_rent),
    nuevo: Math.round((Number(c.current_rent) * ESTIMATED_FACTOR) / 100) * 100,
    cadencia: c.cadence.charAt(0).toUpperCase() + c.cadence.slice(1),
  }))
}

export async function getBankPositions(): Promise<BankPosition[]> {
  const supabase = await createSupabaseServer()
  const monthStart = fmtDate(startOfMonth(TODAY))
  const monthEnd = fmtDate(endOfMonth(TODAY))

  const [banksRes, paymentsRes] = await Promise.all([
    supabase.from('bank_accounts').select('id, bank_name'),
    supabase
      .from('payments')
      .select('bank_account_id, amount, status, bank_date, expected_date')
      .eq('direction', 'IN')
      .gte('expected_date', monthStart)
      .lte('expected_date', monthEnd),
  ])

  const banks = banksRes.data ?? []
  const payments = paymentsRes.data ?? []

  return banks.map(b => {
    const forBank = payments.filter(p => p.bank_account_id === b.id)
    const esperado = forBank.reduce((s, p) => s + Number(p.amount), 0)
    const recibido = forBank
      .filter(p => p.status === 'paid' && p.bank_date)
      .reduce((s, p) => s + Number(p.amount), 0)
    return { banco: b.bank_name, esperado, recibido }
  })
}

export async function getLateTenants(limit = 10): Promise<LateTenant[]> {
  const supabase = await createSupabaseServer()

  const { data } = await supabase
    .from('payments')
    .select('id, amount, expected_date, contracts(id, late_interest_rate, late_interest_enabled, tenants(name))')
    .eq('status', 'late')
    .order('expected_date', { ascending: true })
    .limit(limit)

  return (data ?? []).map((p: any) => {
    const expected = new Date(p.expected_date)
    const dias = Math.max(0, Math.floor((TODAY.getTime() - expected.getTime()) / 86_400_000))
    const c = p.contracts
    const interes = c?.late_interest_enabled
      ? Math.round((Number(p.amount) * (Number(c.late_interest_rate) / 100 / 30) * dias) / 100) * 100
      : 0
    return {
      inquilino: c?.tenants?.name?.split(' ').slice(-1)[0] ?? '—',
      contrato: '#' + (c?.id?.slice(0, 4).toUpperCase() ?? '----'),
      monto: Number(p.amount),
      dias,
      interes,
    }
  })
}
