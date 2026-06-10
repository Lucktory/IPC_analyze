import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import {
  getContractDetail,
  getEmbudoForContract,
  getContractPeriods,
} from '@/lib/contract/queries'
import { getNoteForPeriod } from '@/lib/contract/notes'
import { PeriodNotesEditor } from '@/components/contract/PeriodNotesEditor'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { computeUrgency, URGENCY_LABEL, type UrgencyTier } from '@/lib/contract/urgency'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

// Próximo aumento: same logic as in the contracts list — keeps both views consistent.
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
const fmtMonthYear = (s: string) => {
  const d = new Date(s)
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}
const daysUntil = (s: string) => Math.round((new Date(s).getTime() - Date.now()) / 86400000)

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
  const [embudo, note] = await Promise.all([
    getEmbudoForContract(id, period),
    getNoteForPeriod(id, period),
  ])

  const primaryTenant   = contract.tenants.find(t => t.isPrimary) ?? contract.tenants[0]
  const topLandlord     = contract.landlords.slice().sort((a, b) => b.ownershipPct - a.ownershipPct)[0]
  const nextAdjustment  = computeNextAdjustment(contract.startDate, contract.cadence, contract.status)

  // Commission percentage applied (for display)
  const commissionPct = embudo.totalIn > 0 ? (embudo.commissionTotal / embudo.totalIn) * 100 : 0

  // Same audit the list page runs, with the data we already have on this page.
  // Note: "recently touched" only checks the note's updated_at — we don't have
  // bank_date per transaction in the embudo result. Good enough for the badge.
  const noteUpdatedRecently = !!note.updatedAt &&
    (Date.now() - new Date(note.updatedAt).getTime()) < 48 * 3600000
  const audit = computeUrgency({
    status:           contract.status,
    endDate:          contract.endDate,
    hasRentThisMonth: embudo.rent > 0,
    hasNoteThisMonth: !!note.body.trim(),
    recentlyTouched:  noteUpdatedRecently,
    nextAdjustment,
  })

  return (
    <>
      <BreadcrumbTitle name={primaryTenant?.name ?? 'Detalle'} />

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
        <RowStatusBadge status={contract.status} urgency={audit.urgency} hasRent={embudo.rent > 0} hasNote={!!note.body.trim()} />
      </div>

      {/* Audit banner — matches what made the row red on the list. Only shown
         when there's actually something pending. */}
      {(audit.urgency === 'critical' || audit.urgency === 'warning') && (
        <AuditBanner urgency={audit.urgency} reasons={audit.reasons} />
      )}

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

      {/* Próximo aumento callout — matches the "PROX. AUMENTO MAYO 2026"
         reminders Alejandro stuffs into the INQUILINOS cell of his ledger. */}
      {nextAdjustment && <NextAdjustmentCallout date={nextAdjustment} cadence={contract.cadence} />}

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

      {/* Observaciones del período — Alejandro's DEUDA scratchpad */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">
            Observaciones · {PERIOD_LABEL(period)}
          </h2>
          <p className="text-[12px] text-slate mt-0.5">
            Notas libres por mes — recuperos pendientes, deudas, observaciones para el inquilino o el propietario.
          </p>
        </div>
        <div className="px-6 py-5">
          <PeriodNotesEditor
            contractId={id}
            period={period}
            periodLabel={PERIOD_LABEL(period)}
            initialBody={note.body}
            initialUpdatedAt={note.updatedAt}
            initialUpdatedBy={note.updatedBy}
          />
        </div>
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

/**
 * Detail-page status badge. Same urgency-aware logic as the list — so what
 * the client saw red on /contratos becomes "Sin pago" / "Vence pronto" /
 * etc. here instead of a stale "Activo" green.
 */
function RowStatusBadge({ status, urgency, hasRent, hasNote }: {
  status:   string
  urgency:  UrgencyTier
  hasRent:  boolean
  hasNote:  boolean
}) {
  if (status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>

  switch (urgency) {
    case 'critical':
      if (!hasRent) return <Badge tone="danger">Sin pago</Badge>
      return <Badge tone="danger">Vence pronto</Badge>
    case 'warning':
      if (!hasRent) return <Badge tone="warn">Sin pago</Badge>
      if (!hasNote) return <Badge tone="warn">Sin nota</Badge>
      return <Badge tone="warn">Por vencer</Badge>
    case 'recent':
      return <Badge tone="info">Activo · cambios</Badge>
    case 'upcoming':
      return <Badge tone="info">Aumento próximo</Badge>
    default:
      return <Badge tone="success">Activo</Badge>
  }
}

/**
 * Audit banner — surfaces the urgency reasons on the detail page, mirroring
 * the row tint from /contratos. Premium feel: subtle tint + thick left
 * border in deep jewel tone, list of reasons in slate-dark.
 */
function AuditBanner({ urgency, reasons }: { urgency: 'critical' | 'warning'; reasons: string[] }) {
  const palette = urgency === 'critical'
    ? { border: 'border-l-red-900',    bg: 'bg-red-900/[0.07]',   text: 'text-red-900',    dot: 'bg-red-900',    label: 'Atención requerida' }
    : { border: 'border-l-amber-800',  bg: 'bg-amber-800/[0.06]', text: 'text-amber-800',  dot: 'bg-amber-800',  label: 'Verificar' }

  return (
    <section className={`mt-6 ${palette.bg} border border-line border-l-[4px] ${palette.border} rounded shadow-card p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${palette.dot}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className={`label-cap ${palette.text}`}>{palette.label}</p>
          <ul className="mt-2 space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="text-[13px] text-slate-dark leading-snug">{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s }

function NextAdjustmentCallout({ date, cadence }: { date: string; cadence: string }) {
  const days = daysUntil(date)
  const soon = days <= 30
  return (
    <section
      className={[
        'mt-6 rounded border shadow-card p-4 flex items-center justify-between gap-4 flex-wrap',
        soon ? 'bg-cream-2 border-ink/30' : 'bg-paper border-line',
      ].join(' ')}
    >
      <div className="flex items-baseline gap-3">
        <span className="label-cap">Próximo aumento</span>
        <span className={`font-display text-[18px] ${soon ? 'text-ink font-medium' : 'text-slate-dark'} tabular-nums`}>
          {fmtMonthYear(date)}
        </span>
        <span className="text-[12px] text-slate">
          ({days <= 0 ? 'vencido' : days === 1 ? 'mañana' : `en ${days} días`})
        </span>
      </div>
      <span className="text-[11px] text-slate capitalize">según cadencia {cadence}</span>
    </section>
  )
}
