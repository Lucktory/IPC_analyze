import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CreditCard, FileText, DollarSign, CircleCheck, Wallet, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EditTenantForm } from '@/components/tenant/EditTenantForm'
import { getTenantDetail } from '@/lib/tenant/queries'
import { getContractDetail, getContractPaymentHistory } from '@/lib/contract/queries'
import { getDeudaBreakdown } from '@/lib/liquidacion/deuda-breakdown'
import { getDashboardPeriod } from '@/lib/dashboard/queries'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { fmtMoney as fmt, fmtDate } from '@/lib/format'
import { periodLabel } from '@/lib/period'

const cleanAddress = (s: string | null | undefined) => (s ?? '').replace(/\s*\(vacante\)\s*$/i, '')
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const INDEXER: Record<string, string> = { IPC_GENERAL: 'IPC', ICL: 'ICL', CASA_PROPIA: 'Casa Propia', FIXED: 'Fijo' }
const DEP_STATUS: Record<string, string> = { held: 'Retenido', partially_used: 'Usado parcial', refunded: 'Devuelto' }

interface PageProps { params: Promise<{ id: string }> }

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = await params
  const [tenant, period] = await Promise.all([getTenantDetail(id), getDashboardPeriod()])
  if (!tenant) notFound()

  const primary = tenant.contracts.find(c => c.status === 'active') ?? tenant.contracts[0] ?? null
  const [contract, deuda, history] = primary
    ? await Promise.all([
        getContractDetail(primary.id),
        getDeudaBreakdown(primary.id, period),
        getContractPaymentHistory(primary.id, 5),
      ])
    : [null, null, []]

  const totalDebt = deuda ? deuda.deudaCurrent + deuda.deudaCarryover : 0
  const estado: 'al_dia' | 'en_mora' | 'sin_pago' | 'sin_contrato' =
    !primary ? 'sin_contrato'
    : deuda && deuda.cobradoThisPeriod <= 0 ? 'sin_pago'
    : totalDebt > 0 ? 'en_mora'
    : 'al_dia'
  const lastPaid = history.find(h => h.cobrado)

  const kpis = [
    { Icon: CreditCard, color: '#3B82F6', label: 'DNI',             value: tenant.dni ?? '—',                              sub: 'Documento' },
    { Icon: FileText,   color: '#8B5CF6', label: 'Contrato',        value: contract?.contractNumber ?? (primary ? `#${primary.id.slice(0, 8)}` : '—'), sub: primary ? 'Vigente' : 'Sin contrato' },
    { Icon: DollarSign, color: '#16A34A', label: 'Alquiler vigente', value: primary ? fmt(primary.currentRent) : '—',      sub: contract ? `Día de pago: ${contract.paymentDay}` : '' },
    { Icon: CircleCheck, color: estado === 'al_dia' ? '#16A34A' : '#EF4444', label: 'Estado de pago', value: '', badge: estado, sub: periodLabel(period) },
    { Icon: Wallet,     color: totalDebt > 0 ? '#EF4444' : '#16A34A', label: 'Deuda actual', value: totalDebt > 0 ? fmt(totalDebt) : 'Sin deuda', sub: lastPaid ? `Último pago: ${lastPaid.periodLabel}` : 'Sin pagos registrados' },
  ]

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      <BreadcrumbTitle name={tenant.name} />

      <header className="shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <nav className="text-[12px] text-slate flex items-center gap-1.5">
            <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
            <span className="text-slate/50">/</span>
            <Link href="/inquilinos" className="hover:text-ink transition-colors">Inquilinos</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark truncate max-w-[240px]">{tenant.name}</span>
          </nav>
          <Link href="/inquilinos" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-info/40 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
        </div>
        <h1 className="text-[22px] font-semibold text-ink tracking-tight mt-2">Inquilino · {tenant.name}</h1>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-line bg-paper p-3.5 flex flex-col gap-2.5">
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ backgroundColor: k.color + '1f', color: k.color }}>
              <k.Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate">{k.label}</p>
              {k.badge ? <div className="mt-0.5"><EstadoBadge estado={k.badge as any} /></div>
                       : <p className="text-[15px] font-semibold text-ink leading-tight tabular-nums truncate">{k.value}</p>}
              <p className="text-[11px] text-slate mt-0.5 truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Body */}
      <section className="flex flex-col lg:flex-row gap-4 lg:flex-1 lg:min-h-0">
        {/* Left */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Datos de contacto">
            <dl className="space-y-2.5 text-[12px]">
              <Field k="DNI" v={tenant.dni ?? '—'} mono />
              <Field k="Teléfono" v={tenant.phone ?? '—'} mono />
              <Field k="Email" v={tenant.email ?? '—'} />
            </dl>
          </Card>

          <Card title="Garantía / Depósito">
            <dl className="space-y-2.5 text-[12px]">
              <Field k="Depósito" v={contract?.depositAmount != null ? fmt(contract.depositAmount) : '—'} mono />
              <Field k="Estado" v={contract?.depositStatus ? (DEP_STATUS[contract.depositStatus] ?? contract.depositStatus) : '—'} />
              <Field k="Garante" v="No registrado" />
              <Field k="Tipo" v="No registrado" />
            </dl>
          </Card>
        </div>

        {/* Center */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Historial de pagos" sub="Últimos meses">
            {history.length === 0 ? (
              <p className="text-[13px] text-slate py-2">Sin pagos registrados</p>
            ) : (
              <ul className="space-y-3">
                {history.map(h => (
                  <li key={h.period} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${h.cobrado ? 'bg-success' : 'bg-warn'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink">{h.periodLabel}</p>
                      <p className="text-[11px] text-slate tabular-nums">{h.period.slice(8, 10)}/{h.period.slice(5, 7)}/{h.period.slice(0, 4)}</p>
                    </div>
                    <span className="text-[13px] tabular-nums text-ink whitespace-nowrap">{fmt(h.amount)}</span>
                    {h.cobrado
                      ? <Badge tone="success">Cobrado</Badge>
                      : <Badge tone="warn">Pendiente</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {contract && (
            <Card title="Contrato">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
                <Field k="Propiedad" v={cleanAddress(contract.property?.address) || '—'} />
                <Field k="Vigencia" v={`${fmtDate(contract.startDate)} — ${fmtDate(contract.endDate)}`} mono />
                <Field k="Propietario" v={primary?.primaryLandlord ?? '—'} />
                <Field k="Día de pago" v={`${contract.paymentDay} de cada mes`} />
                <Field k="Cadencia" v={cap(contract.cadence)} />
                <Field k="Comisión adm." v={`${contract.commissionPct}%`} />
                <Field k="Índice" v={INDEXER[contract.indexer] ?? contract.indexer} />
                <div><dt className="text-slate">Estado</dt><dd className="mt-0.5"><ContractStatusBadge status={contract.status} /></dd></div>
              </dl>
            </Card>
          )}
        </div>

        {/* Right */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Deuda" sub={periodLabel(period)}>
            {totalDebt <= 0 ? (
              <div className="py-4 text-center">
                <CircleCheck size={40} className="text-success mx-auto" />
                <p className="text-[15px] font-semibold text-ink mt-2">No presenta deuda</p>
                <p className="text-[12px] text-slate mt-1">Sin saldo arrastrado ni intereses punitorios.</p>
                <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[13px]">
                  <span className="text-slate">Saldo actual</span><span className="tabular-nums text-success font-medium">{fmt(0)}</span>
                </div>
              </div>
            ) : (
              <dl className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between"><dt className="text-slate">Alquiler esperado</dt><dd className="tabular-nums text-ink">{fmt(deuda!.expectedRent)}</dd></div>
                <div className="flex items-center justify-between"><dt className="text-slate">Cobrado</dt><dd className="tabular-nums text-slate-dark">{fmt(deuda!.cobradoThisPeriod)}</dd></div>
                {deuda!.deudaCarryover > 0 && <div className="flex items-center justify-between"><dt className="text-slate">Arrastrado</dt><dd className="tabular-nums text-slate-dark">{fmt(deuda!.deudaCarryover)}</dd></div>}
                {deuda!.interesesEstimado > 0 && <div className="flex items-center justify-between"><dt className="text-slate">Intereses est.</dt><dd className="tabular-nums text-slate-dark">{fmt(deuda!.interesesEstimado)}</dd></div>}
                <div className="flex items-center justify-between border-t border-line pt-2"><dt className="text-ink font-medium">Saldo actual</dt><dd className="tabular-nums text-danger font-medium">{fmt(totalDebt)}</dd></div>
                {deuda!.daysOverdue > 0 && <p className="text-[11px] text-slate">Vencido hace {deuda!.daysOverdue} días</p>}
              </dl>
            )}
          </Card>

          <Card title="Notas">
            <p className="text-[13px] text-slate-dark whitespace-pre-wrap leading-relaxed">{tenant.notes?.trim() || 'Sin notas'}</p>
          </Card>

          <details className="bg-paper border border-line rounded-xl shadow-card">
            <summary className="list-none px-4 sm:px-5 py-3.5 flex items-center gap-2 cursor-pointer text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              <Pencil size={15} className="text-slate" /> Editar datos
            </summary>
            <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-line">
              <EditTenantForm tenant={tenant} />
            </div>
          </details>
        </div>
      </section>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-paper border border-line rounded-xl shadow-card p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="font-display text-[14px] font-medium text-ink leading-tight">{title}</h2>
        {sub && <p className="text-[12px] text-slate mt-0.5">{sub}</p>}
      </header>
      {children}
    </section>
  )
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate">{k}</dt>
      <dd className={`text-ink mt-0.5 break-words ${mono ? 'tabular-nums' : ''}`}>{v}</dd>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: 'al_dia' | 'en_mora' | 'sin_pago' | 'sin_contrato' }) {
  const map = {
    al_dia:       { label: 'Al día',       cls: 'bg-success/15 text-success' },
    en_mora:      { label: 'En mora',      cls: 'bg-danger/15 text-danger' },
    sin_pago:     { label: 'Sin pago',     cls: 'border border-danger/50 text-danger' },
    sin_contrato: { label: 'Sin contrato', cls: 'bg-slate/15 text-slate' },
  }[estado]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${map.cls}`}>{map.label}</span>
}

function ContractStatusBadge({ status }: { status: string }) {
  if (status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>
  if (status === 'active')    return <Badge tone="success">Activo</Badge>
  return <Badge tone="neutral">{status}</Badge>
}
