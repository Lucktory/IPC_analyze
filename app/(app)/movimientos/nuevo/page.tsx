import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod } from '@/lib/period'
import { NewMovimientoForm } from '@/components/movimiento/NewMovimientoForm'

export default async function NewMovimientoPage() {
  const supabase = await createSupabaseServer()

  const [typesRes, contractsRes, banksRes] = await Promise.all([
    supabase
      .from('transaction_types')
      .select('code, label, direction')
      .order('direction')
      .order('label'),
    supabase
      .from('contracts')
      .select(`
        id,
        contract_tenants(is_primary, tenants(name)),
        contract_landlords(ownership_pct, landlords(name))
      `)
      .eq('status', 'active')
      .limit(500),
    supabase
      .from('bank_accounts')
      .select('id, alias, banks!inner(name)')
      .order('alias'),
  ])

  const types = (typesRes.data ?? []) as { code: string; label: string; direction: 'IN' | 'OUT' }[]

  const contracts = ((contractsRes.data ?? []) as any[])
    .map(c => {
      const t = (c.contract_tenants ?? []).find((x: any) => x.is_primary) ?? c.contract_tenants?.[0]
      const l = [...(c.contract_landlords ?? [])].sort((a, b) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
      const tenant   = t?.tenants?.name   ?? '(sin inquilino)'
      const landlord = l?.landlords?.name ?? '(sin propietario)'
      return { id: c.id as string, label: `${tenant}  →  ${landlord}` }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const bankAccounts = ((banksRes.data ?? []) as any[])
    .map(b => ({ id: b.id as string, label: `${b.alias} · ${b.banks.name}` }))

  return (
    <>
      <BreadcrumbTitle name="Nuevo movimiento" />

      <div className="mb-6">
        <Link href="/movimientos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a movimientos
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Nuevo movimiento</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">Registrar transacción</h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Ingresos del inquilino, comisiones, transferencias al propietario, gastos.
          Para registrar el cobro de un alquiler usá la grilla de Liquidación — es más rápido.
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos del movimiento</h2>
        </div>
        <div className="p-5">
          <NewMovimientoForm
            types={types}
            contracts={contracts}
            bankAccounts={bankAccounts}
            defaultPeriod={getCurrentPeriod()}
          />
        </div>
      </section>
    </>
  )
}
