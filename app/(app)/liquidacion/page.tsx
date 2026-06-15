import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { listTransactionPeriods, listTransactions } from '@/lib/entities/queries'
import { getCurrentPeriod, periodLabel, periodShort } from '@/lib/period'
import { getLiquidacionGridForPeriod, type LiquidacionStatus } from '@/lib/liquidacion/queries'
import { getReconciliationByDestination } from '@/lib/reconciliation/queries'
import { listLandlordOptions } from '@/lib/landlord/queries'
import { listTenantOptions } from '@/lib/tenant/queries'
import { LiquidacionGrid } from '@/components/liquidacion/LiquidacionGrid'
import { ResumenView } from '@/components/liquidacion/ResumenView'
import { MovimientosView } from '@/components/liquidacion/MovimientosView'
import { DestinosView } from '@/components/liquidacion/DestinosView'
import { fmtMoney as fmt } from '@/lib/format'

type StatusFilter = 'todas' | LiquidacionStatus
type View         = 'grilla' | 'resumen' | 'movimientos' | 'destinos'

interface PageProps {
  searchParams: Promise<{ period?: string; status?: string; view?: string }>
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'grilla',      label: 'Grilla' },
  { key: 'resumen',     label: 'Resumen del período' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'destinos',    label: 'Por cuenta destino' },
]

export default async function LiquidacionPage({ searchParams }: PageProps) {
  const { period: paramPeriod, status: paramStatus, view: paramView } = await searchParams
  const period = paramPeriod ?? getCurrentPeriod()
  const statusFilter: StatusFilter =
    paramStatus === 'draft' || paramStatus === 'sent' || paramStatus === 'paid'
      ? paramStatus
      : 'todas'
  const view: View =
    paramView === 'resumen' || paramView === 'movimientos' || paramView === 'destinos'
      ? paramView
      : 'grilla'

  // The grid data is needed for the grid view AND for the resumen view
  // (totals derive from the same rows). Periods always. Landlord/tenant
  // option lists feed the autocomplete in the editable Propietario/Inquilino
  // cells — only loaded when the grilla tab is active.
  const periods = await listTransactionPeriods()
  const needsGrid = view === 'grilla' || view === 'resumen'
  const [allRows, txns, buckets, landlordOptions, tenantOptions] = await Promise.all([
    needsGrid              ? getLiquidacionGridForPeriod(period)    : Promise.resolve([]),
    view === 'movimientos' ? listTransactions(period)                : Promise.resolve([]),
    view === 'destinos'    ? getReconciliationByDestination(period)  : Promise.resolve([]),
    view === 'grilla'      ? listLandlordOptions()                   : Promise.resolve([]),
    view === 'grilla'      ? listTenantOptions()                     : Promise.resolve([]),
  ])

  // Status filter — applies to the grid view (only)
  const counts = {
    todas: allRows.length,
    draft: allRows.filter(r => r.status === 'draft').length,
    sent:  allRows.filter(r => r.status === 'sent').length,
    paid:  allRows.filter(r => r.status === 'paid').length,
  }
  const rows = statusFilter === 'todas' ? allRows : allRows.filter(r => r.status === statusFilter)

  // KPIs — header strip uses the grid totals when available, falls back when not
  const baseRows      = view === 'grilla' ? rows : allRows
  const cobrados      = baseRows.filter(r => !!r.fechaBanco).length
  const pendientes    = baseRows.length - cobrados
  const totalIngresos = baseRows.reduce((s, r) => s + r.ingresos, 0)
  const totalAdmi     = baseRows.reduce((s, r) => s + r.admi, 0)
  const conAumento    = baseRows.filter(r => r.hasUpcomingAdjustment).length

  const linkWith = (overrides: Partial<{ period: string; status: StatusFilter; view: View }>) => {
    const merged = { period, status: statusFilter, view, ...overrides }
    const qs = new URLSearchParams()
    if (merged.period)                                  qs.set('period', merged.period)
    if (merged.status && merged.status !== 'todas')     qs.set('status', merged.status)
    if (merged.view   && merged.view   !== 'grilla')    qs.set('view',   merged.view)
    return qs.size > 0 ? `/liquidacion?${qs.toString()}` : '/liquidacion'
  }

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Liquidación</strong>
            {' · '}
            {periodLabel(period)}
          </p>
        </div>

        {/* Tabs — the four ways to look at the same period's liquidación.
            The grilla is the daily-work view; the others are flows. */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden mb-3">
          {VIEWS.map(v => (
            <Link
              key={v.key}
              href={linkWith({ view: v.key })}
              className={[
                'inline-flex items-center px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors shrink-0 border',
                v.key === view
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-slate-dark border-line hover:bg-cream-2 hover:text-ink',
              ].join(' ')}
            >
              {v.label}
            </Link>
          ))}
        </div>

        <StickyKPIStrip cols={4}>
          <StickyKPIStripItem>
            <KPICard
              label="Cobrados este mes"
              value={`${cobrados} / ${baseRows.length}`}
              delta={pendientes > 0 ? `${pendientes} sin cobrar` : 'todo cobrado'}
              deltaTone={pendientes > 0 ? 'negative' : 'positive'}
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Total cobrado"
              value={fmt(totalIngresos)}
              delta={`${periodShort(period)} · ingresos`}
              deltaTone="neutral"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Comisión administración"
              value={fmt(totalAdmi)}
              delta={totalIngresos > 0 ? `${(totalAdmi / totalIngresos * 100).toFixed(1)}% efectivo` : '—'}
              deltaTone="positive"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Avisos de aumento"
              value={conAumento.toString()}
              delta={conAumento > 0 ? 'contratos con aumento ≤30d' : 'sin aumentos próximos'}
              deltaTone={conAumento > 0 ? 'positive' : 'neutral'}
            />
          </StickyKPIStripItem>
        </StickyKPIStrip>
      </StickyHeader>

      {/* Period selector (always visible). Status filter only on the Grilla view. */}
      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Período</span>
          {periods.map(p => (
            <Link
              key={p}
              href={linkWith({ period: p })}
              className={[
                'inline-flex items-center px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors shrink-0',
                p === period
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
              ].join(' ')}
            >
              {periodShort(p)}
            </Link>
          ))}
        </div>

        {view === 'grilla' && (
          <>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="label-cap text-slate mr-1">Estado</span>
              <StatusPill href={linkWith({ status: 'todas' })} active={statusFilter === 'todas'} label="Todas"     count={counts.todas} />
              <StatusPill href={linkWith({ status: 'draft' })} active={statusFilter === 'draft'} label="Borrador"  count={counts.draft} tone="slate" />
              <StatusPill href={linkWith({ status: 'sent'  })} active={statusFilter === 'sent'}  label="Enviadas"  count={counts.sent}  tone="success" />
              <StatusPill href={linkWith({ status: 'paid'  })} active={statusFilter === 'paid'}  label="Pagadas"   count={counts.paid}  tone="info" />
            </div>
            <p className="mt-3 text-[11px] text-slate">
              <span className="inline-block w-2 h-2 rounded-full bg-warn mr-1.5 align-middle" />
              Celdas naranjas = contrato con aumento de alquiler en ≤30 días.
              {' · '}
              <span className="text-slate-dark">Texto gris</span> = pendiente.
              {' · '}
              <span className="text-ink font-medium">Texto oscuro</span> = cobrado/transferido.
            </p>
          </>
        )}
      </section>

      {/* Tab content */}
      <div className="mt-6">
        {view === 'grilla'      && <LiquidacionGrid rows={rows} period={period} landlordOptions={landlordOptions} tenantOptions={tenantOptions} />}
        {view === 'resumen'     && <ResumenView    rows={allRows} period={period} />}
        {view === 'movimientos' && <MovimientosView txns={txns}   period={period} />}
        {view === 'destinos'    && <DestinosView   buckets={buckets} period={period} />}
      </div>
    </>
  )
}

function StatusPill({
  href, active, label, count, tone = 'neutral',
}: {
  href:   string
  active: boolean
  label:  string
  count:  number
  tone?:  'neutral' | 'slate' | 'success' | 'info'
}) {
  const dotCls =
    tone === 'success' ? 'bg-success' :
    tone === 'info'    ? 'bg-info'    :
    tone === 'slate'   ? 'bg-slate'   :
                         'bg-slate/40'
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors',
        active
          ? 'bg-cream-2 text-ink border-ink/40 ring-1 ring-ink/20 hover:bg-cream'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      {label}
      <span className="inline-flex items-center justify-center text-[10px] font-medium tabular-nums px-1.5 rounded bg-line/60 text-slate-dark">
        {count}
      </span>
    </Link>
  )
}
