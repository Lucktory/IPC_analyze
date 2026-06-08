import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import {
  getContractDetail,
  getEmbudoForContract,
  getContractPeriods,
} from '@/lib/contract/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

const PERIOD_LABEL = (s: string) => {
  const [y, m] = s.split('-')
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${months[+m - 1]} ${y}`
}
const PERIOD_SHORT = (s: string) => {
  const [y, m] = s.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[+m - 1]} ${y}`
}

interface PageProps {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}

export default async function ContractDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { period: paramPeriod } = await searchParams

  const contract = await getContractDetail(id)
  if (!contract) notFound()

  const periods = await getContractPeriods(id)
  const period  = paramPeriod ?? periods[0] ?? '2026-05-01'
  const embudo  = await getEmbudoForContract(id, period)

  const primaryTenant   = contract.tenants.find(t => t.isPrimary) ?? contract.tenants[0]
  const topLandlord     = contract.landlords.slice().sort((a, b) => b.ownershipPct - a.ownershipPct)[0]

  // Commission percentage applied (for display)
  const commissionPct = embudo.totalIn > 0 ? (embudo.commissionTotal / embudo.totalIn) * 100 : 0

  return (
    <>
      <div className="mb-6">
        <Link href="/contratos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a contratos
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Contrato</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">
            {primaryTenant?.name ?? '(sin inquilino)'}
          </h1>
          <p className="text-[13px] text-slate-dark mt-1">
            {contract.property?.address ?? '(sin dirección)'} · Propietario: {topLandlord?.name ?? '—'}
          </p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      {/* Contract metadata strip */}
      <section className="bg-paper border border-line rounded shadow-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-5">
          <Meta label="Alquiler vigente" value={fmt(contract.currentRent)} mono />
          <Meta label="Cadencia" value={cap(contract.cadence)} />
          <Meta label="Índice" value={contract.indexer} />
          <Meta label="Inicio"  value={fmtDate(contract.startDate)} />
          <Meta label="Vence"   value={fmtDate(contract.endDate)} />
          <Meta label="Día pago" value={contract.paymentDay.toString()} />
        </div>
      </section>

      {/* Period filter */}
      {periods.length > 1 && (
        <section className="mt-6 bg-paper border border-line rounded shadow-card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="label-cap">Período</span>
            {periods.map(p => (
              <Link
                key={p}
                href={`/contratos/${id}?period=${p}`}
                className={[
                  'inline-flex items-center px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors',
                  p === period
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
                ].join(' ')}
              >
                {PERIOD_SHORT(p)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The embudo — Alejandro's design */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">
            Liquidación · {PERIOD_LABEL(period)}
          </h2>
          <p className="text-[12px] text-slate mt-0.5">
            Alquiler + recuperos → % administración → neto al propietario
          </p>
        </div>

        {embudo.totalIn === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-slate">Sin movimientos registrados en {PERIOD_LABEL(period)}</p>
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="max-w-2xl mx-auto">
              {/* Line items: rent + recoveries */}
              <Row label="Alquiler" value={embudo.rent} />
              {embudo.recoveries.map(r => (
                <Row key={r.typeCode} label={r.label} value={r.amount} indent />
              ))}

              <Divider />

              <Row label="Total cobrado al inquilino" value={embudo.totalIn} bold />

              <div className="my-3" />

              {/* Commission breakdown */}
              <Row
                label={`Comisión administrador (${commissionPct.toFixed(1)}%)`}
                value={-embudo.commissionTotal}
                tone="commission"
              />
              {embudo.commission.length > 0 && (
                <div className="pl-6 mt-1 mb-2 space-y-1">
                  {embudo.commission.map(c => (
                    <div key={c.destination} className="flex items-center justify-between text-[11px] text-slate">
                      <span>→ {c.destination}</span>
                      <span className="tabular-nums">{fmt(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {embudo.otherOut > 0 && (
                <Row label="Otros descuentos" value={-embudo.otherOut} tone="commission" />
              )}

              <Divider />

              <Row label="Transferencia al propietario" value={embudo.landlordPayout} bold tone="payout" />

              {/* Math validation hint */}
              <div className="mt-6 pt-4 border-t border-dashed border-line/60">
                <p className="text-[11px] text-slate">
                  Validación: total cobrado = transferencia + comisión + otros descuentos
                  <br />
                  {fmt(embudo.totalIn)} = {fmt(embudo.landlordPayout)} + {fmt(embudo.commissionTotal)} + {fmt(embudo.otherOut)} = {fmt(embudo.landlordPayout + embudo.commissionTotal + embudo.otherOut)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Sidebar info — landlords + tenants */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h3 className="font-display text-[14px] font-medium text-ink">Propietarios</h3>
            <p className="text-[12px] text-slate mt-0.5">{contract.landlords.length} en este contrato</p>
          </div>
          <ul className="divide-y divide-line">
            {contract.landlords.map(l => (
              <li key={l.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-[13px] text-ink">{l.name}</span>
                <span className="text-[12px] text-slate tabular-nums">{l.ownershipPct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h3 className="font-display text-[14px] font-medium text-ink">Inquilinos</h3>
            <p className="text-[12px] text-slate mt-0.5">{contract.tenants.length} en este contrato</p>
          </div>
          <ul className="divide-y divide-line">
            {contract.tenants.map(t => (
              <li key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-[13px] text-ink">{t.name}</span>
                  {t.isPrimary && <span className="ml-2 text-[10px] text-slate uppercase tracking-wider">titular</span>}
                </div>
                <span className="text-[12px] text-slate-dark tabular-nums">{t.phone ?? '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label-cap text-slate">{label}</p>
      <p className={`text-[14px] text-ink mt-1 ${mono ? 'font-display font-medium tabular-nums' : ''}`}>{value}</p>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  indent,
  tone,
}: {
  label:  string
  value:  number
  bold?:  boolean
  indent?: boolean
  tone?:  'commission' | 'payout'
}) {
  const valueClass = [
    'tabular-nums',
    bold ? 'font-display font-medium text-[16px]' : 'text-[14px]',
    tone === 'commission' ? 'text-slate-dark' : tone === 'payout' ? 'text-success' : 'text-ink',
  ].join(' ')
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? 'pl-6' : ''}`}>
      <span className={`${bold ? 'text-ink font-medium' : 'text-slate-dark'} text-[13px]`}>{label}</span>
      <span className={valueClass}>{value < 0 ? '− ' : ''}{fmt(Math.abs(value))}</span>
    </div>
  )
}

function Divider() {
  return <div className="my-2 border-t border-line" />
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':     return <Badge tone="success">Activo</Badge>
    case 'rescinded':  return <Badge tone="danger">Rescindido</Badge>
    case 'ended':      return <Badge tone="neutral">Finalizado</Badge>
    default:           return <Badge tone="neutral">{status}</Badge>
  }
}

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s }
