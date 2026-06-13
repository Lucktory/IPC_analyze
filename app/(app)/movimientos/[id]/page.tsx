import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { createSupabaseServer } from '@/lib/supabase/server'
import { EditMovimientoForm } from '@/components/movimiento/EditMovimientoForm'
import { fmtMoney, fmtDate } from '@/lib/format'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MovimientoDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const [txRes, typesRes, contractsRes, banksRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        id, amount, period, bank_date, description, contract_id, bank_account_id,
        transaction_types!inner(code, label, direction)
      `)
      .eq('id', id)
      .maybeSingle(),
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

  if (!txRes.data) notFound()
  const tx = txRes.data as any

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

  const direction = tx.transaction_types.direction as 'IN' | 'OUT'
  const sign = direction === 'IN' ? '+' : '−'
  const periodLabelStr = tx.period ? new Date(tx.period).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : '—'

  return (
    <>
      <BreadcrumbTitle name={tx.transaction_types.label} />

      <div className="mb-6">
        <Link href="/movimientos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a movimientos
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div className="min-w-0">
          <p className="label-cap text-slate">Movimiento</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1 truncate">{tx.transaction_types.label}</h1>
          <p className="text-[13px] text-slate-dark mt-1 tabular-nums capitalize">
            {periodLabelStr}{tx.bank_date && <> · banco: {fmtDate(tx.bank_date)}</>}
          </p>
        </div>
        <p className={`font-display text-[28px] font-medium tabular-nums ${direction === 'IN' ? 'text-success' : 'text-danger'}`}>
          {sign} {fmtMoney(Number(tx.amount))}
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Editar movimiento</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Cambiar tipo o monto reescribe el período histórico — actuá con cuidado.
          </p>
        </div>
        <div className="p-5">
          <EditMovimientoForm
            initial={{
              id:            tx.id,
              typeCode:      tx.transaction_types.code,
              amount:        Number(tx.amount),
              period:        tx.period ?? '',
              bankDate:      tx.bank_date,
              contractId:    tx.contract_id,
              bankAccountId: tx.bank_account_id,
              description:   tx.description,
            }}
            types={types}
            contracts={contracts}
            bankAccounts={bankAccounts}
          />
        </div>
      </section>
    </>
  )
}
