import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, DollarSign, RefreshCw, TrendingUp, CalendarDays, CalendarClock, CreditCard } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  getContractDetail,
  getEmbudoForContract,
  getContractPeriods,
} from '@/lib/contract/queries'
import { getNoteForPeriod } from '@/lib/contract/notes'
import { PeriodNotesEditor } from '@/components/contract/PeriodNotesEditor'
import { MovimientosPanel } from '@/components/shared/MovimientosPanel'
import { RecurringChargesEditor } from '@/components/contract/RecurringChargesEditor'
import { AplicarAumentoControl } from '@/components/contract/AplicarAumentoControl'
import { ContractStatusControl } from '@/components/contract/ContractStatusControl'
import { InlineParticipantsCell } from '@/components/liquidacion/InlineParticipantsCell'
import { CommissionPctEditor } from '@/components/contract/CommissionPctEditor'
import { listLandlordOptions } from '@/lib/landlord/queries'
import { listTenantOptions } from '@/lib/tenant/queries'
import { DeudaBreakdownPanel } from '@/components/shared/DeudaBreakdownPanel'
import { getDeudaBreakdown } from '@/lib/liquidacion/deuda-breakdown'
import { ValidationIssueRow } from '@/components/shared/ValidationIssueRow'
import { getContractDiagnostico } from '@/lib/liquidacion/diagnostico'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { computeUrgency, hasRentForAudit, isRecentlyTouched, URGENCY_LABEL, URGENCY_BANNER, type UrgencyTier } from '@/lib/contract/urgency'
import { getCurrentPeriod } from '@/lib/period'
import { fmtMoney as fmt, fmtDate } from '@/lib/format'

const CADENCE_MONTHS: Record<string, number> = {
  mensual: 1, bimestral: 2, trimestral: 3, cuatrimestral: 4, semestral: 6, anual: 12,
}
function computeNextAdjustment(startDate: string, cadence: string, status: string): string | null {
  if (status !== 'active') return null
  const months = CADENCE_MONTHS[cadence]
  if (!months) return null
  const today = new Date()
  const next  = new Date(startDate)
  let safety  = 1000
  while (next <= today && safety-- > 0) next.setMonth(next.getMonth() + months)
  return safety > 0 ? next.toISOString().slice(0, 10) : null
}
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const fmtMonthYear = (s: string) => { const d = new Date(s); return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}` }
const daysUntil = (s: string) => Math.round((new Date(s).getTime() - Date.now()) / 86400000)
const monthsRound = (days: number) => Math.max(0, Math.round(Math.abs(days) / 30.44))
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

const PERIOD_LABEL = (s: string) => { const [y, m] = s.split('-'); return `${MONTHS_ES[+m - 1]} ${y}` }
const PERIOD_SHORT = (s: string) => {
  const short = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const [y, m] = s.split('-'); return `${short[+m - 1]} ${y}`
}
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

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
  const period  = paramPeriod ?? periods[0] ?? getCurrentPeriod()
  const [embudo, note, deudaBreakdown, contractIssues, landlordOptions, tenantOptions] = await Promise.all([
    getEmbudoForContract(id, period),
    getNoteForPeriod(id, period),
    getDeudaBreakdown(id, period),
    getContractDiagnostico(id, period),
    listLandlordOptions(),
    listTenantOptions(),
  ])

  const primaryTenant  = contract.tenants.find(t => t.isPrimary) ?? contract.tenants[0]
  const topLandlord    = contract.landlords.slice().sort((a, b) => b.ownershipPct - a.ownershipPct)[0]
  const nextAdjustment = computeNextAdjustment(contract.startDate, contract.cadence, contract.status)
  const commissionPct  = embudo.totalIn > 0 ? (embudo.commissionTotal / embudo.totalIn) * 100 : 0

  const audit = computeUrgency({
    status: contract.status, endDate: contract.endDate,
    // Same audit rule as the contract list: rent = RENT_IN/RENT_NF_IN only
    // (OTHER_IN is income, not rent), and "recent" = rent OR note within 48h.
    hasRentThisMonth: hasRentForAudit(embudo.rentPaid), hasNoteThisMonth: !!note.body.trim(),
    recentlyTouched: isRecentlyTouched({ rentBankDate: embudo.lastRentBankDate, noteUpdatedAt: note.updatedAt }),
    nextAdjustment,
  })

  // Contract progress (months elapsed of the term)
  const startMs = new Date(contract.startDate).getTime()
  const endMs   = new Date(contract.endDate).getTime()
  const nowMs   = Date.now()
  const totalMs = Math.max(1, endMs - startMs)
  const progressPct   = Math.max(0, Math.min(100, ((nowMs - startMs) / totalMs) * 100))
  const monthsTotal   = Math.max(1, Math.round(totalMs / (30.44 * 86400000)))
  const monthsElapsed = Math.max(0, Math.min(monthsTotal, Math.round((nowMs - startMs) / (30.44 * 86400000))))

  const startDays = daysUntil(contract.startDate)   // negative = past
  const endDays   = daysUntil(contract.endDate)

  const kpis = [
    { Icon: DollarSign,   color: '#3B82F6', label: 'Alquiler vigente', value: fmt(contract.currentRent), sub: `Desde ${fmtDate(contract.startDate)}` },
    { Icon: RefreshCw,    color: '#8B5CF6', label: 'Cadencia',         value: cap(contract.cadence),      sub: `Día de pago: ${contract.paymentDay}` },
    { Icon: TrendingUp,   color: '#F59E0B', label: 'Índice',           value: indexerLabel(contract.indexer), sub: nextAdjustment ? `Próx. ${fmtMonthYear(nextAdjustment)}` : 'Sin ajuste' },
    { Icon: CalendarDays, color: '#16A34A', label: 'Inicio',           value: fmtDate(contract.startDate), sub: startDays < 0 ? `Hace ${monthsRound(startDays)} meses` : `En ${monthsRound(startDays)} meses` },
    { Icon: CalendarClock, color: endDays < 0 ? '#EF4444' : '#F59E0B', label: 'Vence', value: fmtDate(contract.endDate), sub: endDays < 0 ? `Vencido hace ${monthsRound(endDays)} m` : `En ${monthsRound(endDays)} meses` },
    { Icon: CreditCard,   color: '#8A93A5', label: 'Día de pago',      value: String(contract.paymentDay), sub: 'de cada mes' },
  ]

  return (
    <div className="space-y-5">
      <BreadcrumbTitle name={primaryTenant?.name ?? 'Detalle'} />

      {/* Header */}
      <header>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <nav className="text-[12px] text-slate flex items-center gap-1.5">
            <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
            <span className="text-slate/50">/</span>
            <Link href="/contratos" className="hover:text-ink transition-colors">Contratos</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark tabular-nums">{contract.contractNumber ?? `#${contract.id.slice(0, 8)}`}</span>
          </nav>
          <Link href="/contratos" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-info/40 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
          <h1 className="text-[22px] font-semibold text-ink tracking-tight">
            Contrato · {primaryTenant?.name ?? '(sin inquilino)'}
          </h1>
          <div className="flex flex-col items-end gap-1.5">
            <RowStatusBadge status={contract.status} urgency={audit.urgency} hasRent={embudo.rent > 0} hasNote={!!note.body.trim()} />
            <ContractStatusControl contractId={contract.id} status={contract.status} />
          </div>
        </div>
        <p className="text-[13px] text-slate-dark mt-1">
          {contract.property?.address ?? '(sin dirección)'}{contract.property?.city ? ` · ${contract.property.city}` : ''} · Propietario: {topLandlord?.name ?? '—'}
        </p>
      </header>

      {(audit.urgency === 'critical' || audit.urgency === 'warning') && (
        <AuditBanner urgency={audit.urgency} reasons={audit.reasons} />
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-line bg-paper p-3.5 flex flex-col gap-2.5">
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ backgroundColor: k.color + '1f', color: k.color }}>
              <k.Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate">{k.label}</p>
              <p className="text-[16px] font-semibold text-ink leading-tight tabular-nums truncate">{k.value}</p>
              <p className="text-[11px] text-slate mt-0.5 truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Aumento — scales both parts for two-part contracts */}
      <div className="flex justify-end">
        <AplicarAumentoControl
          contractId={contract.id}
          currentRent={contract.currentRent}
          rentFacturadoNeto={contract.rentFacturadoNeto}
          rentNoFacturado={contract.rentNoFacturado}
          rentIvaRate={contract.rentIvaRate}
        />
      </div>

      {/* People + resumen band */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Propietarios — editable (same editor as the planilla) */}
        <Card title="Propietarios" sub={`${contract.landlords.length} en este contrato`}>
          <InlineParticipantsCell
            kind="landlord"
            contractId={contract.id}
            initial={contract.landlords.map(l => ({ id: l.id, name: l.name, pct: l.ownershipPct }))}
            options={landlordOptions}
          />
          <div className="pt-2.5 mt-2 border-t border-line flex items-center justify-between text-[12px]">
            <span className="text-slate">Total</span>
            <span className="tabular-nums text-ink font-medium">{contract.landlords.reduce((s, l) => s + l.ownershipPct, 0).toFixed(0)}%</span>
          </div>
          <p className="text-[10px] text-slate mt-1.5 italic">Tocá para editar propietarios y su %</p>
        </Card>

        {/* Inquilinos — editable, incl. the % each tenant pays */}
        <Card title="Inquilinos" sub={`${contract.tenants.length} en este contrato`}>
          <InlineParticipantsCell
            kind="tenant"
            contractId={contract.id}
            initial={contract.tenants.map(t => ({ id: t.id, name: t.name, pct: t.sharePct }))}
            options={tenantOptions}
          />
          <p className="text-[10px] text-slate mt-1.5 italic">Tocá para editar inquilinos y el % que paga cada uno</p>
        </Card>

        {/* Resumen + progreso */}
        <Card title="Resumen del contrato">
          <dl className="space-y-2 text-[12px]">
            <ResumenRow k="ID Contrato" v={contract.contractNumber ?? `#${contract.id.slice(0, 8)}`} mono />
            <ResumenRow k="Propiedad" v={`${contract.property?.address ?? '—'}${contract.property?.unit ? ` ${contract.property.unit}` : ''}`} />
            <ResumenRow k="Destino" v={contract.property ? cap(contract.property.propertyType) : '—'} />
            <ResumenRow k="Expensas" v={contract.expensas > 0 ? fmt(contract.expensas) : 'A cargo del inquilino'} />
            <ResumenRow k="Depósito" v={contract.depositAmount != null ? fmt(contract.depositAmount) : '—'} />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate shrink-0">Comisión</dt>
              <dd className="w-24"><CommissionPctEditor contractId={contract.id} pct={contract.commissionPct} /></dd>
            </div>
            {contract.rentFacturadoNeto != null && (
              <div className="pt-2 mt-1 border-t border-line space-y-2">
                <p className="text-[11px] text-slate uppercase tracking-wider">Alquiler en dos partes</p>
                <ResumenRow k="Facturado (neto)" v={fmt(contract.rentFacturadoNeto)} mono />
                {contract.rentIvaRate > 0 && (
                  <ResumenRow k={`IVA (${contract.rentIvaRate}%)`} v={fmt(contract.rentFacturadoNeto * contract.rentIvaRate / 100)} mono />
                )}
                <ResumenRow k="Facturado c/IVA" v={fmt(contract.rentFacturadoNeto * (1 + contract.rentIvaRate / 100))} mono />
                <ResumenRow k="No facturado (N/F)" v={fmt(contract.rentNoFacturado)} mono />
                <div className="flex items-start justify-between gap-3 pt-1.5 border-t border-line">
                  <dt className="text-ink font-medium shrink-0">Total alquiler</dt>
                  <dd className="text-ink text-right font-semibold tabular-nums">
                    {fmt(contract.rentFacturadoNeto * (1 + contract.rentIvaRate / 100) + contract.rentNoFacturado)}
                  </dd>
                </div>
              </div>
            )}
          </dl>
          <div className="mt-4 pt-3 border-t border-line">
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="text-slate">Progreso del contrato</span>
              <span className="tabular-nums text-ink font-medium">{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-cream-2 overflow-hidden">
              <div className="h-full rounded-full bg-info" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[11px] text-slate mt-1.5 tabular-nums">{monthsElapsed} / {monthsTotal} meses transcurridos</p>
          </div>
        </Card>
      </section>

      {/* Recurring charges */}
      <RecurringChargesEditor contractId={id} currentRent={contract.currentRent} currentPeriod={period} />

      {/* Period switcher */}
      {periods.length > 1 && (
        <Card title="Período">
          <div className="flex items-center gap-2 flex-wrap">
            {periods.map(p => (
              <Link
                key={p}
                href={`/contratos/${id}?period=${p}`}
                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors ${
                  p === period ? 'bg-info text-white border-info' : 'bg-cream-2 text-slate-dark border-line hover:border-info/40'
                }`}
              >
                {PERIOD_SHORT(p)}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Liquidación embudo */}
      <Card title={`Liquidación · ${PERIOD_LABEL(period)}`} sub="Alquiler + recuperos → % administración → neto al propietario">
        {embudo.totalIn === 0 ? (
          <p className="py-8 text-center text-[14px] text-slate">Sin movimientos registrados en {PERIOD_LABEL(period)}</p>
        ) : (
          <div className="max-w-2xl">
            <Row label="Alquiler" value={embudo.rent} />
            {embudo.recoveries.map(r => <Row key={r.typeCode} label={r.label} value={r.amount} indent />)}
            <Divider />
            <Row label="Total cobrado al inquilino" value={embudo.totalIn} bold />
            <div className="my-3" />
            <Row label={`Comisión administrador (${commissionPct.toFixed(1)}%)`} value={-embudo.commissionTotal} tone="commission" />
            {embudo.commission.length > 0 && (
              <div className="pl-6 mt-1 mb-2 space-y-1">
                {embudo.commission.map(c => (
                  <div key={c.destination} className="flex items-center justify-between text-[11px] text-slate">
                    <span>→ {c.destination}</span><span className="tabular-nums">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {embudo.otherOut > 0 && <Row label="Otros descuentos" value={-embudo.otherOut} tone="commission" />}
            <Divider />
            <Row label="Transferencia al propietario" value={embudo.landlordPayout} bold tone="payout" />
          </div>
        )}
      </Card>

      {/* Diagnóstico */}
      {contractIssues.length > 0 && (
        <Card title={`Diagnóstico · ${PERIOD_LABEL(period)}`} sub={`${contractIssues.length} ${contractIssues.length === 1 ? 'issue detectado' : 'issues detectados'} por las reglas de validación.`} flush>
          <ul className="-mx-4 sm:-mx-5">
            {contractIssues.map((item, idx) => <ValidationIssueRow key={`${item.issue.code}-${idx}`} issue={item.issue} />)}
          </ul>
        </Card>
      )}

      {/* Deuda */}
      {deudaBreakdown && (
        <Card title={`Deuda · ${PERIOD_LABEL(period)}`} sub="Desglose con arrastrado anterior y estimación de intereses por mora.">
          <div className="max-w-2xl"><DeudaBreakdownPanel breakdown={deudaBreakdown} /></div>
        </Card>
      )}

      {/* Movimientos */}
      <Card title={`Movimientos · ${PERIOD_LABEL(period)}`} sub="Cash flow del contrato — entradas y salidas con fecha, monto y razón.">
        <MovimientosPanel contractId={id} period={period} />
      </Card>

      {/* Observaciones */}
      <Card title={`Observaciones · ${PERIOD_LABEL(period)}`} sub="Notas libres por mes — recuperos, deudas, observaciones para el inquilino o el propietario.">
        <PeriodNotesEditor
          contractId={id}
          period={period}
          periodLabel={PERIOD_LABEL(period)}
          initialBody={note.body}
          initialUpdatedAt={note.updatedAt}
          initialUpdatedBy={note.updatedBy}
        />
      </Card>
    </div>
  )
}

// ── Reusable card wrapper ──
function Card({ title, sub, children, flush }: { title: string; sub?: string; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className="bg-paper border border-line rounded-xl shadow-card p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="font-display text-[15px] font-medium text-ink leading-tight">{title}</h2>
        {sub && <p className="text-[12px] text-slate mt-0.5">{sub}</p>}
      </header>
      {children}
    </section>
  )
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0" style={{ backgroundColor: color + '22', color }}>
      {initials(name)}
    </span>
  )
}

function ResumenRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate shrink-0">{k}</dt>
      <dd className={`text-ink text-right ${mono ? 'tabular-nums' : ''}`}>{v}</dd>
    </div>
  )
}

function indexerLabel(indexer: string): string {
  const map: Record<string, string> = { IPC_GENERAL: 'IPC', ICL: 'ICL', CASA_PROPIA: 'Casa Propia', FIXED: 'Fijo' }
  return map[indexer] ?? indexer
}

function Row({ label, value, bold, indent, tone }: {
  label: string; value: number; bold?: boolean; indent?: boolean; tone?: 'commission' | 'payout'
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

function Divider() { return <div className="my-2 border-t border-line" /> }

function RowStatusBadge({ status, urgency, hasRent, hasNote }: {
  status: string; urgency: UrgencyTier; hasRent: boolean; hasNote: boolean
}) {
  if (status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>
  if (status === 'draft')     return <Badge tone="neutral">Borrador</Badge>
  if (status === 'suspended') return <Badge tone="warn">Suspendido</Badge>
  const cc = urgency === 'critical' ? '!text-white' : urgency === 'warning' ? '!text-ink' : ''
  switch (urgency) {
    case 'critical': return <Badge tone="danger" className={cc}>{hasRent ? 'Vence pronto' : 'Sin pago'}</Badge>
    case 'warning':  return <Badge tone="warn" className={cc}>{!hasRent ? 'Sin pago' : !hasNote ? 'Sin nota' : 'Por vencer'}</Badge>
    case 'recent':   return <Badge tone="info">Activo · cambios</Badge>
    case 'upcoming': return <Badge tone="info">Aumento próximo</Badge>
    default:         return <Badge tone="success">Activo</Badge>
  }
}

function AuditBanner({ urgency, reasons }: { urgency: 'critical' | 'warning'; reasons: string[] }) {
  const p = URGENCY_BANNER[urgency]
  return (
    <section className={`${p.bg} border border-line border-l-[4px] ${p.border} rounded-xl shadow-card p-4`}>
      <div className="flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${p.dot}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className={`label-cap ${p.text}`}>{URGENCY_LABEL[urgency]}</p>
          <ul className="mt-2 space-y-1">
            {reasons.map((r, i) => <li key={i} className="text-[13px] text-slate-dark leading-snug">{r}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}
